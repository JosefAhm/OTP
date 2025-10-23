import { NextResponse } from "next/server";
import { generateSecret, generateTOTP, verifyTOTP } from "@/lib/otp";

export async function GET() {
  // Generate a new secret and a sample code for display
  const secret = generateSecret();
  const code = generateTOTP(secret);
  return NextResponse.json({ secret, code });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { secret, token } = body as { secret?: string; token?: string };
    if (!secret || !token) return NextResponse.json({ ok: false, error: 'missing secret or token' }, { status: 400 });

    const ok = verifyTOTP(secret, token);
    return NextResponse.json({ ok });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
