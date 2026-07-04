// Admin-portal passcode wall. A second factor ON TOP of the operator role: /admin renders only for
// operators who have also entered ADMIN_PASSCODE this browser. The cookie stores an HMAC derived
// from the passcode (never the passcode itself), so rotating the env value invalidates every session.
import 'server-only';
import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';

const COOKIE = 'tf_admin_gate';
const MAX_AGE_S = 60 * 60 * 24 * 30; // 30 days

function expectedToken(): string | null {
  const pass = process.env.ADMIN_PASSCODE;
  if (!pass || !pass.trim()) return null;
  return createHmac('sha256', pass.trim()).update('tf-admin-portal-v1').digest('hex');
}

export function isPasscodeConfigured(): boolean {
  return expectedToken() != null;
}

// True when no passcode is configured (gate off) or the browser holds the valid cookie.
export async function hasAdminGateAccess(): Promise<boolean> {
  const expect = expectedToken();
  if (!expect) return true; // env not set: role check alone guards /admin
  const jar = await cookies();
  const got = jar.get(COOKIE)?.value;
  if (!got || got.length !== expect.length) return false;
  try {
    return timingSafeEqual(Buffer.from(got, 'hex'), Buffer.from(expect, 'hex'));
  } catch {
    return false;
  }
}

// Verify a submitted passcode; on success set the gate cookie. Returns ok.
export async function verifyAndSetAdminGate(input: string): Promise<boolean> {
  const pass = process.env.ADMIN_PASSCODE;
  const expect = expectedToken();
  if (!pass || !expect) return true;
  const a = Buffer.from(input.trim());
  const b = Buffer.from(pass.trim());
  const match = a.length === b.length && timingSafeEqual(a, b);
  if (!match) return false;
  const jar = await cookies();
  jar.set(COOKIE, expect, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/admin',
    maxAge: MAX_AGE_S,
  });
  return true;
}
