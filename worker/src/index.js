import { WorldRoom } from './worldRoom.js';

export { WorldRoom };

function getCorsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowedRaw = env.ALLOWED_ORIGINS || '*';
  const allowedList = allowedRaw.split(',').map((s) => s.trim()).filter(Boolean);

  let allowOrigin = '*';
  if (allowedList.length > 0 && !allowedList.includes('*')) {
    if (origin && (allowedList.includes(origin) || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:'))) {
      allowOrigin = origin;
    } else {
      allowOrigin = allowedList[0];
    }
  } else if (origin) {
    allowOrigin = origin;
  }

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Upgrade, Connection',
    'Access-Control-Max-Age': '86400',
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = getCorsHeaders(request, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    // Lightweight health check — never wakes the Durable Object
    if (url.pathname === '/' || url.pathname === '/api/health') {
      return new Response(
        JSON.stringify({ ok: true, service: 'sehirfethetmeoyunu-worker', mode: 'ws-hibernation-delta' }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...cors } }
      );
    }

    // Room isolation: "main" for production GitHub Pages, "dev" for localhost sandbox
    const roomParam = (url.searchParams.get('room') || 'main').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24) || 'main';
    const roomId = env.WORLD_ROOM.idFromName(roomParam);
    const stub = env.WORLD_ROOM.get(roomId);

    if (url.pathname === '/ws') {
      if ((request.headers.get('Upgrade') || '').toLowerCase() !== 'websocket') {
        return new Response('Expected WebSocket Upgrade', { status: 426, headers: cors });
      }
      return stub.fetch(request);
    }

    if (url.pathname === '/api/stats') {
      const resp = await stub.fetch(request);
      const headers = new Headers(resp.headers);
      for (const [k, v] of Object.entries(cors)) headers.set(k, v);
      return new Response(resp.body, { status: resp.status, headers });
    }

    return new Response('Not Found', { status: 404, headers: cors });
  },
};
