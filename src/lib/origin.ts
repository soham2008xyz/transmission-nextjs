// Same-origin check for state-changing requests (CSRF defence for basic auth).

export type OriginPolicy = {
  /** Take the host from X-Forwarded-Host instead of Host. Only safe behind a proxy you control. */
  trustProxy: boolean;
  /** Extra origins to accept, such as the public URL behind a reverse proxy. */
  allowedOrigins: string[];
};

function parseOrigin(value: string): string | null {
  try {
    const url = new URL(value.trim());
    // Opaque origins (`null`, data:, file:) have no usable host.
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.origin : null;
  } catch {
    return null;
  }
}

export function originPolicyFromEnv(env: Record<string, string | undefined>): OriginPolicy {
  return {
    trustProxy: env.APP_TRUST_PROXY?.trim().toLowerCase() === 'true',
    allowedOrigins: (env.APP_ORIGIN ?? '')
      .split(',')
      .map(parseOrigin)
      .filter((o): o is string => o !== null),
  };
}

/**
 * Decide whether a request's Origin header matches the app.
 *
 * `next start` reports req.nextUrl.origin as http://localhost:<port> whatever
 * the browser used, so compare with the host the browser sent instead. A
 * browser sets Host itself and a cross-site page cannot change it. The scheme
 * is not compared: behind TLS termination the app only sees http.
 *
 * X-Forwarded-Host is a plain request header that any client can set, so it is
 * only read when the operator opts in with trustProxy.
 */
export function isAllowedOrigin(headers: Headers, policy: OriginPolicy): boolean {
  const origin = headers.get('origin');
  if (!origin) return true; // Not a cross-site browser request; unchanged.

  const parsed = parseOrigin(origin);
  if (!parsed) return false;
  if (policy.allowedOrigins.includes(parsed)) return true;

  const forwarded = policy.trustProxy
    ? headers.get('x-forwarded-host')?.split(',')[0].trim()
    : undefined;
  const host = (forwarded || headers.get('host'))?.trim();
  if (!host) return false;
  const { protocol, host: originHost } = new URL(parsed);
  // Parse Host with the Origin's scheme so `nas.lan:443` and `nas.lan` compare
  // equal for https (and `:80` for http), as URL does for the Origin.
  try {
    return new URL(`${protocol}//${host}`).host === originHost;
  } catch {
    return false;
  }
}
