import { normaliseRoomCode, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '../src/game/protocol';
import { GameRoom } from './GameRoom';

export { GameRoom };

export interface Env {
  ROOMS: DurableObjectNamespace<GameRoom>;
  ASSETS: Fetcher;
}

// The site may also be served from elsewhere (e.g. Vercel), so the API allows any origin.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS } });
}

function randomCode(): string {
  const bytes = new Uint8Array(ROOM_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ROOM_CODE_ALPHABET[b % ROOM_CODE_ALPHABET.length]).join('');
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    if (pathname.startsWith('/api/')) {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

      if (pathname === '/api/health') return json({ ok: true });

      if (pathname === '/api/rooms' && request.method === 'POST') {
        for (let attempt = 0; attempt < 8; attempt++) {
          const code = randomCode();
          if (await env.ROOMS.get(env.ROOMS.idFromName(code)).create(code)) return json({ code });
        }
        return json({ error: 'Could not allocate a room code, please try again.' }, 503);
      }

      const route = pathname.match(/^\/api\/rooms\/([A-Za-z0-9]+)(\/ws)?$/);
      if (route) {
        const code = normaliseRoomCode(route[1]);
        if (code.length !== ROOM_CODE_LENGTH) return json({ error: 'Invalid room code.' }, 400);
        const room = env.ROOMS.get(env.ROOMS.idFromName(code));
        if (route[2]) return room.fetch(request);
        return (await room.exists()) ? json({ code }) : json({ error: `There is no room ${code}.` }, 404);
      }

      return json({ error: 'Not found' }, 404);
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
