import { Suspect } from '../game/constants';
import { AnyAction, ClientMessage, ServerMessage } from '../game/protocol';

// Empty means "same origin": the Cloudflare Worker serves both the site and the API.
// Set VITE_ROOM_SERVER_URL when the site is hosted elsewhere (e.g. Vercel).
const SERVER = ((import.meta.env.VITE_ROOM_SERVER_URL as string | undefined) ?? '').replace(/\/$/, '');

function wsUrl(code: string): string {
  const base = SERVER || window.location.origin;
  return `${base.replace(/^http/, 'ws')}/api/rooms/${code}/ws`;
}

export async function createRoom(): Promise<string> {
  const res = await fetch(`${SERVER}/api/rooms`, { method: 'POST' });
  const body = (await res.json().catch(() => ({}))) as { code?: string; error?: string };
  if (!res.ok || !body.code) throw new Error(body.error ?? 'Could not create a room. Please try again.');
  return body.code;
}

export type ConnectionStatus = 'connecting' | 'open' | 'reconnecting' | 'closed';

interface Handlers {
  onMessage: (msg: ServerMessage) => void;
  onStatus: (status: ConnectionStatus) => void;
}

/** Keeps a WebSocket to one room open, reconnecting with backoff and resuming the seat by token. */
export class RoomClient {
  private ws: WebSocket | null = null;
  private stopped = false;
  private everOpened = false;
  private attempt = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    readonly code: string,
    private hello: { name: string; suspect?: Suspect; token?: string },
    private handlers: Handlers
  ) {
    document.addEventListener('visibilitychange', this.wake);
    window.addEventListener('online', this.wake);
    this.open();
  }

  setToken(token: string) {
    this.hello = { ...this.hello, token };
  }

  send(action: AnyAction) {
    this.raw({ t: 'act', action });
  }

  leave() {
    this.raw({ t: 'leave' });
    this.stop();
  }

  stop() {
    this.stopped = true;
    document.removeEventListener('visibilitychange', this.wake);
    window.removeEventListener('online', this.wake);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.ws?.close();
    this.ws = null;
    this.handlers.onStatus('closed');
  }

  private raw(msg: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  private open() {
    if (this.stopped) return;
    this.handlers.onStatus(this.attempt === 0 ? 'connecting' : 'reconnecting');
    const ws = new WebSocket(wsUrl(this.code));
    this.ws = ws;

    ws.onopen = () => {
      this.attempt = 0;
      this.everOpened = true;
      ws.send(JSON.stringify({ t: 'hello', ...this.hello } satisfies ClientMessage));
      if (this.pingTimer) clearInterval(this.pingTimer);
      this.pingTimer = setInterval(() => ws.readyState === WebSocket.OPEN && ws.send('ping'), 25_000);
    };
    ws.onmessage = (e) => {
      if (e.data === 'pong') return;
      let msg: ServerMessage;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      if (msg.t === 'welcome') {
        this.setToken(msg.token);
        this.handlers.onStatus('open');
      }
      if (msg.t === 'removed' || (msg.t === 'error' && msg.fatal)) this.stopped = true;
      this.handlers.onMessage(msg);
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      if (this.pingTimer) clearInterval(this.pingTimer);
      if (this.stopped) {
        this.handlers.onStatus('closed');
        return;
      }
      this.scheduleRetry();
    };
  }

  private async scheduleRetry() {
    // A failed upgrade looks like a network drop, so check whether the room exists at all.
    if (!this.everOpened && this.attempt === 1) {
      const res = await fetch(`${SERVER}/api/rooms/${this.code}`).catch(() => null);
      if (res?.status === 404) {
        this.stopped = true;
        this.handlers.onMessage({ t: 'error', message: `There is no room ${this.code}. Check the code with your host.`, fatal: true });
        this.handlers.onStatus('closed');
        return;
      }
    }
    if (this.stopped) return;
    const delay = Math.min(8000, 500 * 2 ** this.attempt++);
    this.handlers.onStatus('reconnecting');
    this.retryTimer = setTimeout(() => this.open(), delay);
  }

  /** Phones drop sockets in the background; reconnect straight away when the page is visible again. */
  private wake = () => {
    if (this.stopped || document.visibilityState !== 'visible') return;
    if (this.ws && this.ws.readyState <= WebSocket.OPEN) return;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.attempt = 0;
    this.open();
  };
}
