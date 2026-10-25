import { chooseBotAction } from '../src/game/bot';
import { isSuspect, MAX_PLAYERS, MIN_PLAYERS, Suspect, SUSPECTS } from '../src/game/constants';
import { applyAction, GameAction, GameEvent, GameState, skipTurn, Stage, startGame } from '../src/game/engine';
import { AnyAction, ChatMessage, RoomView } from '../src/game/protocol';
import { Rng } from '../src/game/rng';
import { viewFor } from '../src/game/view';

export class RoomError extends Error {
  constructor(
    message: string,
    readonly fatal = false
  ) {
    super(message);
  }
}

export interface Member {
  id: string;
  token: string;
  name: string;
  suspect: Suspect;
  isBot: boolean;
}

export interface RoomData {
  code: string;
  createdAt: number;
  updatedAt: number;
  status: 'lobby' | 'playing' | 'over';
  hostId: string | null;
  members: Member[];
  nextMemberNo: number;
  game: GameState | null;
  chat: ChatMessage[];
  nextChatId: number;
  botDueAt: number | null;
  away: { memberId: string; deadline: number } | null;
}

/** How long a bot "thinks" before acting, long enough for the dice and walking animations to finish. */
const BOT_DELAY: Record<Stage, number> = { roll: 1200, move: 1800, suggest: 2400, disprove: 1800, end: 1900 };
/** How long the game waits for a disconnected player before acting for them. */
const AWAY_GRACE = { disprove: 45_000, turn: 90_000 };
export const ROOM_TTL = 7 * 24 * 60 * 60 * 1000;

const BOT_NAMES = ['Inspector Gray', 'Sergeant Hobbs', 'Lady Ashworth', 'Dr. Finch', 'Captain Reeve', 'Miss Marlowe'];
const GAME_ACTIONS = new Set(['roll', 'move', 'passage', 'suggest', 'show', 'accuse', 'endTurn']);
const MAX_CHAT = 60;

export function createRoomData(code: string, now: number): RoomData {
  return {
    code,
    createdAt: now,
    updatedAt: now,
    status: 'lobby',
    hostId: null,
    members: [],
    nextMemberNo: 1,
    game: null,
    chat: [],
    nextChatId: 1,
    botDueAt: null,
    away: null,
  };
}

function cleanName(raw: unknown): string {
  const name = String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 20);
  return name || 'Detective';
}

export class RoomCore {
  constructor(
    readonly data: RoomData,
    private readonly rng: Rng,
    private readonly makeToken: () => string
  ) {}

  member(id: string | null): Member | undefined {
    return id ? this.data.members.find((m) => m.id === id) : undefined;
  }

  /** Joins a new player, or resumes the seat that belongs to `token`. */
  hello(msg: { token?: unknown; name?: unknown; suspect?: unknown }, now: number): Member {
    const d = this.data;
    const existing = typeof msg.token === 'string' ? d.members.find((m) => !m.isBot && m.token === msg.token) : undefined;
    if (existing) return existing;

    if (d.status !== 'lobby') {
      throw new RoomError('This game is already under way. Ask the host to start a rematch so you can join.', true);
    }
    if (d.members.length >= MAX_PLAYERS) throw new RoomError('This room is full (6 detectives).', true);

    const member: Member = {
      id: `m${d.nextMemberNo++}`,
      token: this.makeToken(),
      name: cleanName(msg.name),
      suspect: this.freeSuspect(isSuspect(msg.suspect) ? msg.suspect : undefined),
      isBot: false,
    };
    d.members.push(member);
    d.hostId ??= member.id;
    d.updatedAt = now;
    return member;
  }

  /** Applies a lobby or game action. Returns the game events it produced. */
  act(memberId: string, raw: unknown, connected: ReadonlySet<string>, now: number): { events: GameEvent[]; removed?: string } {
    const me = this.member(memberId);
    if (!me) throw new RoomError('You are not in this room.', true);
    if (!raw || typeof raw !== 'object' || typeof (raw as { type?: unknown }).type !== 'string') {
      throw new RoomError('Malformed action.');
    }
    const action = raw as AnyAction;
    const d = this.data;
    d.updatedAt = now;

    if (GAME_ACTIONS.has(action.type)) {
      if (d.status !== 'playing' || !d.game) throw new RoomError('The game has not started.');
      return { events: this.applyGame(memberId, action as GameAction, now) };
    }

    switch (action.type) {
      case 'chat': {
        const text = String(action.text ?? '').trim().slice(0, 300);
        if (!text) return { events: [] };
        d.chat.push({ id: d.nextChatId++, at: now, memberId, name: me.name, text });
        if (d.chat.length > MAX_CHAT) d.chat.splice(0, d.chat.length - MAX_CHAT);
        return { events: [] };
      }
      case 'pickSuspect': {
        this.requireLobby();
        if (!isSuspect(action.suspect)) throw new RoomError('Unknown suspect.');
        if (d.members.some((m) => m.suspect === action.suspect && m.id !== memberId)) {
          throw new RoomError(`${action.suspect} has already been taken.`);
        }
        me.suspect = action.suspect;
        return { events: [] };
      }
      case 'addBot': {
        this.requireHost(memberId, connected);
        this.requireLobby();
        if (d.members.length >= MAX_PLAYERS) throw new RoomError('The room is full.');
        const used = new Set(d.members.map((m) => m.name));
        d.members.push({
          id: `m${d.nextMemberNo++}`,
          token: '',
          name: BOT_NAMES.find((n) => !used.has(n)) ?? 'Constable',
          suspect: this.freeSuspect(isSuspect(action.suspect) ? action.suspect : undefined),
          isBot: true,
        });
        return { events: [] };
      }
      case 'remove': {
        this.requireHost(memberId, connected);
        this.requireLobby();
        if (action.memberId === memberId) throw new RoomError('Use Leave to leave the room.');
        if (!this.member(action.memberId)) throw new RoomError('That player has already left.');
        d.members = d.members.filter((m) => m.id !== action.memberId);
        return { events: [], removed: action.memberId };
      }
      case 'start': {
        this.requireHost(memberId, connected);
        this.requireLobby();
        if (d.members.length < MIN_PLAYERS) throw new RoomError('You need at least 2 players (bots count).');
        const { state, events } = startGame(
          d.members.map((m) => ({ id: m.id, name: m.name, suspect: m.suspect, isBot: m.isBot })),
          this.rng,
          now
        );
        d.game = state;
        d.status = 'playing';
        d.botDueAt = null;
        d.away = null;
        return { events };
      }
      case 'rematch': {
        this.requireHost(memberId, connected);
        if (d.status !== 'over') throw new RoomError('The current game is still being played.');
        d.status = 'lobby';
        d.game = null;
        d.botDueAt = null;
        d.away = null;
        return { events: [] };
      }
      default:
        throw new RoomError('Unknown action.');
    }
  }

  /** A player chose to leave. In the lobby their seat is freed; mid-game it stays theirs. */
  leave(memberId: string, now: number) {
    const d = this.data;
    if (d.status !== 'lobby' || !this.member(memberId)) return;
    d.members = d.members.filter((m) => m.id !== memberId);
    if (!d.members.some((m) => !m.isBot)) d.members = [];
    if (d.hostId === memberId) d.hostId = d.members.find((m) => !m.isBot)?.id ?? null;
    d.updatedAt = now;
  }

  view(memberId: string | null, connected: ReadonlySet<string>): RoomView {
    const d = this.data;
    return {
      code: d.code,
      status: d.status,
      youId: memberId,
      hostId: d.hostId,
      members: d.members.map((m) => ({
        id: m.id,
        name: m.name,
        suspect: m.suspect,
        isBot: m.isBot,
        isHost: m.id === d.hostId,
        connected: m.isBot || connected.has(m.id),
      })),
      chat: d.chat,
      game: d.game ? viewFor(d.game, memberId) : null,
      away: d.away,
    };
  }

  /** Recomputes bot and away deadlines. Returns when the next job is due, if any. */
  schedule(connected: ReadonlySet<string>, now: number): number | null {
    const d = this.data;
    const actor = this.member(this.pendingActorId());
    const stage = d.game?.turn.stage;

    if (actor?.isBot && stage) d.botDueAt ??= now + BOT_DELAY[stage];
    else d.botDueAt = null;

    if (actor && !actor.isBot && !connected.has(actor.id)) {
      if (d.away?.memberId !== actor.id) {
        d.away = { memberId: actor.id, deadline: now + (stage === 'disprove' ? AWAY_GRACE.disprove : AWAY_GRACE.turn) };
      }
    } else {
      d.away = null;
    }

    const due = [d.botDueAt, d.away?.deadline].filter((t): t is number => t != null);
    return due.length ? Math.min(...due) : null;
  }

  /** Runs whichever bot move or away-player fallback is due. Returns null when nothing ran. */
  tick(connected: ReadonlySet<string>, now: number): GameEvent[] | null {
    const d = this.data;
    const actorId = this.pendingActorId();
    const actor = this.member(actorId);
    if (!d.game || !actor) return null;

    if (actor.isBot && d.botDueAt != null && now >= d.botDueAt) {
      d.botDueAt = null;
      const action = chooseBotAction(viewFor(d.game, actor.id), this.rng);
      try {
        if (action) return this.applyGame(actor.id, action, now);
      } catch (err) {
        console.error('Bot action rejected', action, err);
      }
      // Never let a confused bot stall the table.
      return this.skip('could not decide what to do.', now);
    }

    if (d.away && d.away.memberId === actor.id && now >= d.away.deadline && !connected.has(actor.id)) {
      d.away = null;
      if (d.game.turn.stage === 'disprove') {
        // Show a card on their behalf rather than stall everyone else.
        const action = chooseBotAction(viewFor(d.game, actor.id), this.rng);
        if (action) return this.applyGame(actor.id, action, now);
        return null;
      }
      return this.skip('has been away for a while.', now);
    }
    return null;
  }

  private skip(reason: string, now: number): GameEvent[] {
    const { state, events } = skipTurn(this.data.game!, reason, now);
    this.data.game = state;
    return events;
  }

  private applyGame(memberId: string, action: GameAction, now: number): GameEvent[] {
    const d = this.data;
    const { state, events } = applyAction(d.game!, memberId, action, this.rng, now);
    d.game = state;
    d.botDueAt = null;
    d.updatedAt = now;
    if (state.phase === 'over') d.status = 'over';
    return events;
  }

  private pendingActorId(): string | null {
    const g = this.data.game;
    if (this.data.status !== 'playing' || !g || g.phase !== 'playing') return null;
    return g.turn.stage === 'disprove' ? g.turn.suggestion!.disproverId : g.turn.playerId;
  }

  private freeSuspect(preferred?: Suspect): Suspect {
    const taken = new Set(this.data.members.map((m) => m.suspect));
    if (preferred && !taken.has(preferred)) return preferred;
    const free = SUSPECTS.find((s) => !taken.has(s));
    if (!free) throw new RoomError('This room is full (6 detectives).', true);
    return free;
  }

  private requireLobby() {
    if (this.data.status !== 'lobby') throw new RoomError('That can only be done in the lobby.');
  }

  /** Host-only actions. If the host has disconnected, another player may take over as host. */
  private requireHost(memberId: string, connected: ReadonlySet<string>) {
    const d = this.data;
    if (d.hostId === memberId) return;
    if (d.hostId && connected.has(d.hostId)) throw new RoomError('Only the host can do that.');
    d.hostId = memberId;
  }
}
