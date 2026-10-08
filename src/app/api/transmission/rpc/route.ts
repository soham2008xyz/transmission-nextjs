import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const transmissionRpcUrl = process.env.TRANSMISSION_RPC_URL + '/transmission/rpc';
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
    if (error.response && error.response.status === 409) {
      sessionId = error.response.headers['x-transmission-session-id'];
      error.config.headers['X-Transmission-Session-Id'] = sessionId;
      return client.request(error.config);
    }
    return Promise.reject(error);
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const method = body?.method;
    if (typeof method !== 'string' || !ALLOWED_METHODS.has(method)) {
      return forbidden('method not allowed');
    }
    const allowedArgs = ALLOWED_ARGUMENTS[method];
    if (allowedArgs && body.arguments && typeof body.arguments === 'object') {
      const extra = Object.keys(body.arguments).filter((k) => !allowedArgs.includes(k));
      if (extra.length > 0) return forbidden('argument not allowed');
    }

    const { data } = await client.post('', body);
    return NextResponse.json(data);
  } catch (error: any) { // Changed type to any
    return new NextResponse(error.message, { status: error.response?.status || 500 });
  }
}
