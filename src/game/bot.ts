import { corridorNeighbours, DOORS, squareKey } from './board';
import { CardName, cardKind, CardKind, ROOMS, Room, SECRET_PASSAGES, SUSPECTS, WEAPONS } from './constants';
import { Envelope, GameAction } from './engine';
import { MoveOption } from './movement';
import { pick, Rng } from './rng';
import { GameView } from './view';

const ENVELOPE = 'envelope';
type Owner = string;

/**
 * What a player can deduce from their own view: their hand, cards shown to them,
 * who could not disprove which suggestion, and who showed someone a card.
 */
export class Deduction {
  readonly possible = new Map<CardName, Set<Owner>>();

  constructor(view: GameView) {
    const ids = view.players.map((p) => p.id);
    const all: CardName[] = [...SUSPECTS, ...WEAPONS, ...ROOMS];
    for (const card of all) this.possible.set(card, new Set([...ids, ENVELOPE]));
    const me = view.me;
    if (!me) return;

    for (const card of me.hand) this.fix(card, me.id);
    for (const card of all) if (!me.hand.includes(card)) this.possible.get(card)!.delete(me.id);
    for (const s of me.seen) this.fix(s.card, s.fromId);
    if (view.envelope) {
      this.fix(view.envelope.suspect, ENVELOPE);
      this.fix(view.envelope.weapon, ENVELOPE);
      this.fix(view.envelope.room, ENVELOPE);
    }

    const atLeastOne: Array<{ owner: Owner; cards: CardName[] }> = [];
    for (const h of view.history) {
      const cards: CardName[] = [h.suspect, h.weapon, h.room];
      for (const passed of h.passedIds) for (const c of cards) this.possible.get(c)!.delete(passed);
      if (h.shownById && h.suggesterId !== me.id && h.shownById !== me.id) {
        atLeastOne.push({ owner: h.shownById, cards });
      }
    }

    const handSize = new Map(view.players.map((p) => [p.id, p.cardCount]));
    for (let changed = true, rounds = 0; changed && rounds < 50; rounds++) {
      changed = false;
      for (const [id, size] of handSize) {
        const known = all.filter((c) => this.ownerOf(c) === id);
        const maybe = all.filter((c) => this.possible.get(c)!.has(id));
        if (known.length === size) {
          for (const c of maybe) if (!known.includes(c)) changed = this.drop(c, id) || changed;
        } else if (maybe.length === size) {
          for (const c of maybe) changed = this.fix(c, id) || changed;
        }
      }
      for (const kind of ['suspect', 'weapon', 'room'] as CardKind[]) {
        const cards = all.filter((c) => cardKind(c) === kind);
        const inEnvelope = cards.filter((c) => this.possible.get(c)!.has(ENVELOPE));
        if (inEnvelope.length === 1) changed = this.fix(inEnvelope[0], ENVELOPE) || changed;
        const solved = cards.find((c) => this.ownerOf(c) === ENVELOPE);
        if (solved) for (const c of cards) if (c !== solved) changed = this.drop(c, ENVELOPE) || changed;
      }
      for (const { owner, cards } of atLeastOne) {
        if (cards.some((c) => this.ownerOf(c) === owner)) continue;
        const candidates = cards.filter((c) => this.possible.get(c)!.has(owner));
        if (candidates.length === 1) changed = this.fix(candidates[0], owner) || changed;
      }
    }
  }

  ownerOf(card: CardName): Owner | null {
    const set = this.possible.get(card)!;
    return set.size === 1 ? [...set][0] : null;
  }

  mightBeInEnvelope(card: CardName): boolean {
    return this.possible.get(card)!.has(ENVELOPE);
  }

  /** The solution, if every category has been narrowed to one card. */
  solution(): Envelope | null {
    const one = <T extends CardName>(list: readonly T[]): T | null => {
      const c = list.filter((x) => this.mightBeInEnvelope(x));
      return c.length === 1 ? c[0] : null;
    };
    const suspect = one(SUSPECTS);
    const weapon = one(WEAPONS);
    const room = one(ROOMS);
    return suspect && weapon && room ? { suspect, weapon, room } : null;
  }

  private fix(card: CardName, owner: Owner): boolean {
    const set = this.possible.get(card)!;
    if (set.size === 1 && set.has(owner)) return false;
    set.clear();
    set.add(owner);
    return true;
  }

  private drop(card: CardName, owner: Owner): boolean {
    const set = this.possible.get(card)!;
    return set.size > 1 && set.delete(owner);
  }
}

// Shortest corridor distance from each square to each room (stepping through its door).
const ROOM_DISTANCE: Record<Room, Map<string, number>> = Object.fromEntries(
  ROOMS.map((room) => {
    const dist = new Map<string, number>();
    const queue = DOORS.filter((d) => d.room === room).map((d) => d.outside);
    for (const s of queue) dist.set(squareKey(s), 1);
    for (let i = 0; i < queue.length; i++) {
      const at = queue[i];
      const d = dist.get(squareKey(at))!;
      for (const n of corridorNeighbours(at)) {
        if (!dist.has(squareKey(n))) {
          dist.set(squareKey(n), d + 1);
          queue.push(n);
        }
      }
    }
    return [room, dist];
  })
) as Record<Room, Map<string, number>>;

/** Chooses the next action for a computer player, using only that player's view. */
export function chooseBotAction(view: GameView, rng: Rng): GameAction | null {
  const me = view.me;
  if (!me) return null;
  const o = view.options;
  const know = new Deduction(view);

  if (o.show.length) return { type: 'show', card: chooseCardToShow(view, o.show, rng) };

  const solved = know.solution();
  if (o.accuse && solved) return { type: 'accuse', ...solved };

  const wanted = (room: Room) => know.mightBeInEnvelope(room);

  if (o.suggestIn) return { type: 'suggest', ...chooseSuggestion(know, rng) };
  if (o.roll) {
    if (o.passage && wanted(o.passage)) return { type: 'passage' };
    return { type: 'roll' };
  }
  if (o.moves.length) return { type: 'move', target: chooseMove(o.moves, wanted, rng).key };
  if (o.endTurn) return { type: 'endTurn' };
  return null;
}

function chooseSuggestion(know: Deduction, rng: Rng) {
  const choose = <T extends CardName>(list: readonly T[]): T => {
    const unknown = list.filter((c) => know.mightBeInEnvelope(c) && know.ownerOf(c) === null);
    if (unknown.length) return pick(unknown, rng);
    const solved = list.filter((c) => know.mightBeInEnvelope(c));
    return pick(solved.length ? solved : list, rng);
  };
  return { suspect: choose(SUSPECTS), weapon: choose(WEAPONS) };
}

function chooseMove(moves: MoveOption[], wanted: (r: Room) => boolean, rng: Rng): MoveOption {
  const rooms = moves.filter((m): m is Extract<MoveOption, { kind: 'room' }> => m.kind === 'room');
  const goodRooms = rooms.filter((m) => wanted(m.room));
  if (goodRooms.length) return pick(goodRooms, rng);

  const targets = ROOMS.filter(wanted);
  const goal = targets.length ? targets : [...ROOMS];
  const score = (m: MoveOption) => {
    if (m.kind === 'room') return goal.includes(m.room) ? 0 : 50;
    const key = squareKey(m);
    const viaPassage = (r: Room) => {
      const other = SECRET_PASSAGES[r];
      return other && goal.includes(other) ? (ROOM_DISTANCE[r].get(key) ?? 99) + 1 : 99;
    };
    return Math.min(...goal.map((r) => ROOM_DISTANCE[r].get(key) ?? 99), ...ROOMS.map(viaPassage));
  };
  const best = Math.min(...moves.map(score));
  return pick(
    moves.filter((m) => score(m) === best),
    rng
  );
}

function chooseCardToShow(view: GameView, cards: CardName[], rng: Rng): CardName {
  const suggesterId = view.turn.suggestion?.suggesterId;
  const shown = view.me?.shown ?? [];
  const toSame = cards.filter((c) => shown.some((s) => s.card === c && s.toId === suggesterId));
  if (toSame.length) return pick(toSame, rng);
  const toAnyone = cards.filter((c) => shown.some((s) => s.card === c));
  if (toAnyone.length) return pick(toAnyone, rng);
  return pick(cards, rng);
}
