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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { data } = await client.post('', body);
    return NextResponse.json(data);
  } catch (error: any) { // Changed type to any
    return new NextResponse(error.message, { status: error.response?.status || 500 });
  }
}
