import { NextRequest, NextResponse } from 'next/server';

// Opt-in basic auth. Set APP_USERNAME and APP_PASSWORD to turn it on.
const username = process.env.APP_USERNAME;
const password = process.env.APP_PASSWORD;

function safeEqual(a: string, b: string) {
  let diff = a.length ^ b.length;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
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

  const header = req.headers.get('authorization') || '';
  const [scheme, encoded] = header.split(' ');
  if (scheme?.toLowerCase() !== 'basic' || !encoded) return unauthorized();

  let decoded = '';
  try {
    decoded = atob(encoded);
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
