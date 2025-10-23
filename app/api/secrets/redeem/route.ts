import { getAdminClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

type RedeemBody = {
  id?: string;
};

export async function POST(request: Request) {
  let body: RedeemBody;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }

  if (!body.id || typeof body.id !== "string") {
    return NextResponse.json({ error: "Secret id is required" }, { status: 400 });
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
      return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
    }

    if (!data) {
      const { data: existing } = await supabase
        .from("secrets")
        .select("expires_at")
        .eq("id", body.id)
        .maybeSingle();

      if (existing) {
        await supabase.from("secrets").delete().eq("id", body.id);
        return NextResponse.json({ error: "Secret expired" }, { status: 410 });
      }

      return NextResponse.json({ error: "Secret missing" }, { status: 404 });
    }

    return NextResponse.json({
      ciphertext: data.ciphertext,
      iv: data.iv,
      authTag: data.auth_tag
    });
  } catch (error) {
    console.error("Unexpected failure while redeeming secret", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
