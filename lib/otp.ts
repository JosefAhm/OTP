import crypto from "crypto";

// Minimal Base32 (RFC4648) encode/decode for TOTP secrets
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buf: Buffer) {
  let bits = 0;
  let value = 0;
  let output = "";

  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i];
    bits += 8;

    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += ALPHABET[(value << (5 - bits)) & 31];
  }

  // pad to multiple of 8
  while (output.length % 8 !== 0) output += "=";
  return output;
}

function base32Decode(str: string) {
  const clean = str.replace(/=+$/g, "").toUpperCase();
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;

  for (let i = 0; i < clean.length; i++) {
    const idx = ALPHABET.indexOf(clean[i]);
    if (idx === -1) continue;

    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

export function generateSecret(length = 20) {
  const buf = crypto.randomBytes(length);
  return base32Encode(buf);
}

export function generateTOTP(secretBase32: string, digits = 6, step = 30, forTime?: number) {
  const key = base32Decode(secretBase32);
  const time = Math.floor((typeof forTime === 'number' ? forTime : Date.now() / 1000) / step);

  const buffer = Buffer.alloc(8);
  buffer.writeUInt32BE(Math.floor(time / Math.pow(2, 32)), 0); // high
  buffer.writeUInt32BE(time & 0xffffffff, 4); // low

  // TypeScript's lib typings prefer Uint8Array for crypto operations in some environments.
  // Cast the Node Buffer to Uint8Array to satisfy the compiler while keeping runtime behavior.
  // Work around strict typing differences between Node Buffer and the TypeScript lib typings for
  // BinaryLike by casting the inputs to `any`. This keeps runtime behavior unchanged while
  // satisfying the compiler in mixed environments.
  const hmac = crypto.createHmac('sha1', key as any).update(buffer as any).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);

  const otp = binary % Math.pow(10, digits);
  return otp.toString().padStart(digits, '0');
}

export function verifyTOTP(secretBase32: string, token: string, window = 1, digits = 6, step = 30) {
  const now = Math.floor(Date.now() / 1000);
  for (let errorWindow = -window; errorWindow <= window; errorWindow++) {
    const t = now + errorWindow * step;
    const candidate = generateTOTP(secretBase32, digits, step, t);
    if (candidate === token) return true;
  }
  return false;
}
