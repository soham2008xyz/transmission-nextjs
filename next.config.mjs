/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // The proxy buffers request bodies and cuts them off at 10 MB by default.
    // .torrent uploads travel as base64 JSON, so allow more than
    // MAX_RPC_BODY_BYTES (src/lib/limits.ts, about 27 MB). The route enforces
    // the real cap and answers 413.
    proxyClientMaxBodySize: '32mb',
  },
};

export default nextConfig;
