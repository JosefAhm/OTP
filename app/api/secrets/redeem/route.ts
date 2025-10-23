import { NextResponse } from "next/server";

import { applyRateLimit } from "@/lib/rate-limit";
import { getAdminClient } from "@/lib/supabase";

type RedeemBody = {
  id?: string;
};

export async function POST(request: Request) {
  const rateLimit = applyRateLimit(request, { limit: 60, windowMs: 60_000 });
  const respond = (body: unknown, init?: ResponseInit) => {
    const response = NextResponse.json(body, init);
    for (const [key, value] of Object.entries(rateLimit.headers)) {
      response.headers.set(key, value);
    }
    return response;
  };

  if (!rateLimit.success) {
    return respond(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  let body: RedeemBody;

  try {
    body = await request.json();
  } catch {
    return respond({ error: "Invalid request payload" }, { status: 400 });
  }

  if (!body.id || typeof body.id !== "string") {
    return respond({ error: "Secret id is required" }, { status: 400 });
  }

  try {
    const supabase = getAdminClient();
    const nowIso = new Date().toISOString();

    const { data, error } = await supabase
      .from("secrets")
      .delete()
      .eq("id", body.id)
      .gt("expires_at", nowIso)
      .select("ciphertext, iv, auth_tag, expires_at")
      .maybeSingle();

    if (error) {
      console.error("Failed to redeem secret", error);
      return respond({ error: "Unexpected error" }, { status: 500 });
    }

    if (!data) {
      const { data: existing } = await supabase
        .from("secrets")
        .select("expires_at")
        .eq("id", body.id)
        .maybeSingle();

      if (existing) {
        await supabase.from("secrets").delete().eq("id", body.id);
        return respond({ error: "Secret expired" }, { status: 410 });
      }

      return respond({ error: "Secret missing" }, { status: 404 });
    }

    return respond({
      ciphertext: data.ciphertext,
      iv: data.iv,
      authTag: data.auth_tag,
      expiresAt: data.expires_at
    });
  } catch (error) {
    console.error("Unexpected failure while redeeming secret", error);
    return respond({ error: "Internal error" }, { status: 500 });
  }
}
