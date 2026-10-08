import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { formatBytes } from '@/lib/utils';
import { MAX_RPC_BODY_BYTES, MAX_TORRENT_FILE_BYTES } from '@/lib/limits';

const baseUrl = process.env.TRANSMISSION_RPC_URL;
const transmissionRpcUrl = baseUrl + '/transmission/rpc';
const username = process.env.TRANSMISSION_RPC_USERNAME;
const password = process.env.TRANSMISSION_RPC_PASSWORD;

let sessionId = '';

const client = axios.create({
  baseURL: transmissionRpcUrl,
  auth: {
    username: username || '',
    password: password || '',
  },
});

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Retry once with the new session id. A second 409, or a 409 without
    // the header, fails instead of looping.
    const newSessionId = error.response?.headers?.['x-transmission-session-id'];
    if (error.response?.status === 409 && newSessionId && !error.config._retried) {
      sessionId = newSessionId;
      error.config._retried = true;
      error.config.headers['X-Transmission-Session-Id'] = sessionId;
      return client.request(error.config);
    }
    throw error;
  }
);

client.interceptors.request.use((config) => {
  if (sessionId) {
    config.headers['X-Transmission-Session-Id'] = sessionId;
  }
  return config;
});

// Only the methods the UI uses. Everything else gets a 403.
const ALLOWED_METHODS = new Set([
  'torrent-get',
  'torrent-start-now',
  'torrent-stop',
  'torrent-remove',
  'torrent-add',
  'torrent-set',
  'free-space',
]);

// Per-method limits on arguments, for methods that can do more than the UI needs.
const ALLOWED_ARGUMENTS: Record<string, string[]> = {
  'torrent-set': ['ids', 'files-wanted', 'files-unwanted'],
  'torrent-add': ['filename', 'metainfo', 'download-dir', 'paused'],
};

function forbidden(message: string) {
  return NextResponse.json({ result: message }, { status: 403 });
}

function tooLarge() {
  return NextResponse.json(
    { result: `request too large (.torrent files are limited to ${formatBytes(MAX_TORRENT_FILE_BYTES)})` },
    { status: 413 }
  );
}

// Returns an error response if the RPC body may not be forwarded, or null if it may.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- parsed JSON body
function rejectBody(body: any): NextResponse | null {
  const method = body?.method;
  if (typeof method !== 'string' || !ALLOWED_METHODS.has(method)) {
    return forbidden('method not allowed');
  }
  const allowedArgs = ALLOWED_ARGUMENTS[method];
  if (allowedArgs && body.arguments && typeof body.arguments === 'object') {
    const extra = Object.keys(body.arguments).filter((k) => !allowedArgs.includes(k));
    if (extra.length > 0) return forbidden('argument not allowed');
  }
  // Enforce the file cap on the decoded data too; the body limit has slack.
  const metainfo = body.arguments?.metainfo;
  if (method === 'torrent-add' && typeof metainfo === 'string') {
    const padding = Number(metainfo.endsWith('=')) + Number(metainfo.endsWith('=='));
    if ((metainfo.length * 3) / 4 - padding > MAX_TORRENT_FILE_BYTES) return tooLarge();
  }
  return null;
}

export async function POST(req: NextRequest) {
  if (!baseUrl) {
    console.error('TRANSMISSION_RPC_URL is not set');
    return NextResponse.json({ result: 'server is not configured' }, { status: 500 });
  }

  // Forms can't send application/json cross-site without a CORS preflight.
  if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return NextResponse.json({ result: 'content type must be application/json' }, { status: 415 });
  }

  const declaredLength = Number(req.headers.get('content-length'));
  if (declaredLength > MAX_RPC_BODY_BYTES) return tooLarge();

  let body;
  try {
    const text = await req.text();
    if (Buffer.byteLength(text, 'utf8') > MAX_RPC_BODY_BYTES) return tooLarge();
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ result: 'invalid JSON body' }, { status: 400 });
  }

  try {
    const rejection = rejectBody(body);
    if (rejection) return rejection;

    const { data } = await client.post('', body);
    return NextResponse.json(data);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- axios error shape is not typed here
  } catch (error: any) {
    // Log details server-side only; they can include internal hostnames.
    console.error('Transmission RPC request failed:', error?.message);
    if (error?.response) {
      return NextResponse.json({ result: 'Transmission returned an error' }, { status: error.response.status });
    }
    return NextResponse.json({ result: 'Transmission is unreachable' }, { status: 502 });
  }
}
