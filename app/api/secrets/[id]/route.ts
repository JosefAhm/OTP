import { NextResponse } from "next/server";

import { applyRateLimit } from "@/lib/rate-limit";
import { getAdminClient } from "@/lib/supabase";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
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

  try {
    const supabase = getAdminClient();
    const nowIso = new Date().toISOString();

    const { data, error } = await supabase
      .from("secrets")
      .select("expires_at")
      .eq("id", params.id)
      .gt("expires_at", nowIso)
      .maybeSingle();

    if (error) {
      console.error("Failed to get secret expiry", error);
      return respond({ error: "Unexpected error" }, { status: 500 });
    }

    if (!data) {
      return respond({ error: "Secret not found or expired" }, { status: 404 });
    }

    return respond({ expiresAt: data.expires_at });
  } catch (error) {
    console.error("Unexpected failure", error);
    return respond({ error: "Internal error" }, { status: 500 });
  }
}