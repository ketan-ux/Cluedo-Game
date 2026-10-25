import { DurableObject } from 'cloudflare:workers';
import { GameEvent, RuleError } from '../src/game/engine';
import { ClientMessage, ServerMessage } from '../src/game/protocol';
import { cryptoRng } from '../src/game/rng';
import { eventsFor } from '../src/game/view';
import { createRoomData, ROOM_TTL, RoomCore, RoomData, RoomError } from './roomCore';
import type { Env } from './index';

interface Attachment {
  memberId: string | null;
}

const MAX_MESSAGE_BYTES = 4096;

function makeToken(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * One Durable Object per room code. It is the only place the full game state (including the
 * envelope and every hand) exists; each socket is sent only its own player's view.
 * Uses the WebSocket Hibernation API, so idle rooms cost nothing.
 */
export class GameRoom extends DurableObject<Env> {
  private core: RoomCore | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    ctx.blockConcurrencyWhile(async () => {
      const data = await ctx.storage.get<RoomData>('room');
      if (data) this.core = new RoomCore(data, cryptoRng, makeToken);
    });
  }

  /** Called by the Worker when a new room code is issued. Returns false if the code is taken. */
  async create(code: string): Promise<boolean> {
    if (this.core) return false;
    this.core = new RoomCore(createRoomData(code, Date.now()), cryptoRng, makeToken);
    await this.save();
    await this.ctx.storage.setAlarm(Date.now() + ROOM_TTL);
    return true;
  }

  async exists(): Promise<boolean> {
    return this.core !== null;
  }

  async fetch(request: Request): Promise<Response> {
    if (!this.core) return new Response('Room not found', { status: 404 });
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('Expected a WebSocket upgrade', { status: 426 });
    }
    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ memberId: null } satisfies Attachment);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    const core = this.core;
    if (!core) return ws.close(4404, 'Room not found');
    if (typeof raw !== 'string' || raw.length > MAX_MESSAGE_BYTES) return this.send(ws, { t: 'error', message: 'Message rejected.' });

    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw);
    } catch {
      return this.send(ws, { t: 'error', message: 'Malformed message.' });
    }
    const now = Date.now();
    const attachment = ws.deserializeAttachment() as Attachment;

    try {
      if (msg.t === 'hello') {
        const member = core.hello(msg, now);
        ws.serializeAttachment({ memberId: member.id } satisfies Attachment);
        this.send(ws, { t: 'welcome', memberId: member.id, token: member.token });
        await this.commit([]);
      } else if (msg.t === 'act') {
        if (!attachment.memberId) throw new RoomError('Say hello first.');
        const { events, removed } = core.act(attachment.memberId, msg.action, this.connectedIds(), now);
        if (removed) this.disconnectMember(removed);
        await this.commit(events);
      } else if (msg.t === 'leave') {
        if (attachment.memberId) core.leave(attachment.memberId, now);
        ws.serializeAttachment({ memberId: null } satisfies Attachment);
        ws.close(1000, 'Left the room');
        await this.commit([]);
      }
    } catch (err) {
      if (err instanceof RoomError || err instanceof RuleError) {
        this.send(ws, { t: 'error', message: err.message, fatal: err instanceof RoomError && err.fatal });
        if (err instanceof RoomError && err.fatal) ws.close(4400, 'Rejected');
      } else {
        console.error('Room error', err);
        this.send(ws, { t: 'error', message: 'Something went wrong on the server.' });
      }
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string) {
    try {
      ws.close(code, reason);
    } catch {
      // Already closed.
    }
    await this.commit([]);
  }

  async webSocketError() {
    await this.commit([]);
  }

  async alarm() {
    const core = this.core;
    if (!core) return;
    const now = Date.now();
    const connected = this.connectedIds();
    if (connected.size === 0 && now - core.data.updatedAt >= ROOM_TTL) {
      await this.ctx.storage.deleteAll();
      this.core = null;
      return;
    }
    const events = core.tick(connected, now);
    await this.commit(events ?? []);
  }

  /** Saves, sends every connected player their own view, and arms the next alarm. */
  private async commit(events: GameEvent[]) {
    const core = this.core;
    if (!core) return;
    const connected = this.connectedIds();
    const now = Date.now();
    const due = core.schedule(connected, now);
    await this.save();
    for (const ws of this.ctx.getWebSockets()) {
      const { memberId } = ws.deserializeAttachment() as Attachment;
      if (!memberId || ws.readyState !== WebSocket.OPEN) continue;
      this.send(ws, { t: 'state', room: core.view(memberId, connected), events: eventsFor(events, memberId) });
    }
    await this.ctx.storage.setAlarm(due ?? core.data.updatedAt + ROOM_TTL);
  }

  private connectedIds(): Set<string> {
    const ids = new Set<string>();
    for (const ws of this.ctx.getWebSockets()) {
      const { memberId } = ws.deserializeAttachment() as Attachment;
      if (memberId && ws.readyState === WebSocket.OPEN) ids.add(memberId);
    }
    return ids;
  }

  private disconnectMember(memberId: string) {
    for (const ws of this.ctx.getWebSockets()) {
      if ((ws.deserializeAttachment() as Attachment).memberId !== memberId) continue;
      ws.serializeAttachment({ memberId: null } satisfies Attachment);
      this.send(ws, { t: 'removed' });
      ws.close(4001, 'Removed by host');
    }
  }

  private send(ws: WebSocket, msg: ServerMessage) {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      // The socket closed between listing and sending; the next commit will skip it.
    }
  }

  private async save() {
    if (this.core) await this.ctx.storage.put('room', this.core.data);
  }
}
