import { NextRequest, NextResponse } from 'next/server';

// Opt-in basic auth. Set APP_USERNAME and APP_PASSWORD to turn it on.
const username = process.env.APP_USERNAME;
const password = process.env.APP_PASSWORD;

function safeEqual(a: string, b: string) {
  let diff = a.length ^ b.length;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    diff |= (a.codePointAt(i) ?? 0) ^ (b.codePointAt(i) ?? 0);
  }
  return diff === 0;
}

function unauthorized() {
  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Transmission", charset="UTF-8"' },
  });
}

export function proxy(req: NextRequest) {
  if (!username || !password) return NextResponse.next();

  // Browsers resend cached basic-auth credentials on cross-site requests,
  // so refuse state-changing requests that come from another origin.
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const origin = req.headers.get('origin');
    if (origin && origin !== req.nextUrl.origin) {
      return new NextResponse('Cross-origin request blocked', { status: 403 });
    }
  }

  const header = req.headers.get('authorization') || '';
  const [scheme, encoded] = header.split(' ');
  if (scheme?.toLowerCase() !== 'basic' || !encoded) return unauthorized();

  let decoded = '';
  try {
    const bytes = Uint8Array.from(atob(encoded), (c) => c.codePointAt(0) ?? 0);
    decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return unauthorized();
  }
  const sep = decoded.indexOf(':');
  if (sep < 0) return unauthorized();

  const okUser = safeEqual(decoded.slice(0, sep), username);
  const okPass = safeEqual(decoded.slice(sep + 1), password);
  return okUser && okPass ? NextResponse.next() : unauthorized();
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico).*)',
};
