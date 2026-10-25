import { Square, squareKey, START_SQUARES } from './board';
import {
  CardName,
  isCard,
  isRoom,
  isSuspect,
  isWeapon,
  Room,
  ROOMS,
  SECRET_PASSAGES,
  Suspect,
  SUSPECTS,
  Weapon,
  WEAPONS,
} from './constants';
import { legalMoves, Location, MoveOption } from './movement';
import { Rng, rollDie, shuffle } from './rng';

export interface Envelope {
  suspect: Suspect;
  weapon: Weapon;
  room: Room;
}

export interface SeatConfig {
  id: string;
  name: string;
  suspect: Suspect;
  isBot: boolean;
}

export interface SeenCard {
  card: CardName;
  fromId: string;
  turn: number;
}

export interface ShownCard {
  card: CardName;
  toId: string;
  turn: number;
}

export interface PlayerState {
  id: string;
  name: string;
  suspect: Suspect;
  isBot: boolean;
  hand: CardName[];
  eliminated: boolean;
  /** Set after a wrong accusation: that player has looked inside the envelope. */
  knowsEnvelope: boolean;
  /** Moved into a room by someone else's suggestion since this player's last turn. */
  summoned: boolean;
  seen: SeenCard[];
  shown: ShownCard[];
}

/** Public record of a suggestion. Never contains the card that was shown. */
export interface SuggestionRecord {
  turn: number;
  suggesterId: string;
  suspect: Suspect;
  weapon: Weapon;
  room: Room;
  passedIds: string[];
  disproverId: string | null;
  shownById: string | null;
}

export interface AccusationRecord {
  turn: number;
  playerId: string;
  suspect: Suspect;
  weapon: Weapon;
  room: Room;
  correct: boolean;
}

/**
 * roll     - start of turn: roll, take a secret passage, or (if summoned) suggest without moving
 * move     - dice rolled, choose a destination (or end the turn if boxed in)
 * suggest  - just entered a room: may suggest there
 * disprove - waiting for a player to show a card
 * end      - may accuse or end the turn
 */
export type Stage = 'roll' | 'move' | 'suggest' | 'disprove' | 'end';

export interface TurnState {
  playerId: string;
  number: number;
  stage: Stage;
  roll: [number, number] | null;
  moves: MoveOption[];
  /** Room in which a suggestion may be made this turn. */
  enteredRoom: Room | null;
  /** Started the turn in a room this player was summoned into, so may suggest without moving. */
  stayed: boolean;
  suggestion: SuggestionRecord | null;
}

export type LogKind = 'system' | 'turn' | 'roll' | 'move' | 'suggest' | 'pass' | 'show' | 'accuse' | 'win';

export interface LogEntry {
  id: number;
  at: number;
  kind: LogKind;
  text: string;
  playerId?: string;
}

export interface GameState {
  phase: 'playing' | 'over';
  players: PlayerState[];
  envelope: Envelope;
  pawns: Record<Suspect, Location>;
  weapons: Record<Weapon, Room>;
  turn: TurnState;
  history: SuggestionRecord[];
  accusations: AccusationRecord[];
  winnerId: string | null;
  log: LogEntry[];
  nextLogId: number;
}

export type GameAction =
  | { type: 'roll' }
  | { type: 'move'; target: string }
  | { type: 'passage' }
  | { type: 'suggest'; suspect: Suspect; weapon: Weapon }
  | { type: 'show'; card: CardName }
  | { type: 'accuse'; suspect: Suspect; weapon: Weapon; room: Room }
  | { type: 'endTurn' };

/** Something that happened, for clients to animate. `audience` limits who receives it. */
export type GameEvent = (
  | { type: 'turn'; playerId: string; number: number }
  | { type: 'rolled'; playerId: string; dice: [number, number] }
  | { type: 'moved'; suspect: Suspect; path: Square[]; to: Location; how: 'walk' | 'passage' | 'summoned' }
  | { type: 'weaponMoved'; weapon: Weapon; to: Room }
  | { type: 'suggested'; playerId: string; suspect: Suspect; weapon: Weapon; room: Room }
  | { type: 'cannotDisprove'; playerId: string }
  | { type: 'cardShown'; fromId: string; toId: string; card?: CardName }
  | { type: 'unrefuted'; playerId: string }
  | {
      type: 'accused';
      playerId: string;
      suspect: Suspect;
      weapon: Weapon;
      room: Room;
      correct: boolean;
      envelope?: Envelope;
    }
  | { type: 'gameOver'; winnerId: string | null; envelope: Envelope }
) & { audience?: string[] };

export interface ActionResult {
  state: GameState;
  events: GameEvent[];
}

export class RuleError extends Error {}

const MAX_LOG = 300;

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

export function startGame(seats: SeatConfig[], rng: Rng, now = Date.now()): ActionResult {
  if (seats.length < 2 || seats.length > SUSPECTS.length) throw new RuleError('A game needs 2 to 6 players.');
  if (new Set(seats.map((s) => s.suspect)).size !== seats.length) throw new RuleError('Each player needs a different suspect.');

  const ordered = [...seats].sort((a, b) => SUSPECTS.indexOf(a.suspect) - SUSPECTS.indexOf(b.suspect));

  const envelope: Envelope = {
    suspect: shuffle(SUSPECTS, rng)[0],
    weapon: shuffle(WEAPONS, rng)[0],
    room: shuffle(ROOMS, rng)[0],
  };
  const deck = shuffle(
    ([...SUSPECTS, ...WEAPONS, ...ROOMS] as CardName[]).filter(
      (c) => c !== envelope.suspect && c !== envelope.weapon && c !== envelope.room
    ),
    rng
  );

  const players: PlayerState[] = ordered.map((s) => ({
    id: s.id,
    name: s.name,
    suspect: s.suspect,
    isBot: s.isBot,
    hand: [],
    eliminated: false,
    knowsEnvelope: false,
    summoned: false,
    seen: [],
    shown: [],
  }));
  // Deal clockwise from a random seat; with 4 or 5 players some hands get an extra card.
  const firstSeat = Math.floor(rng() * players.length);
  deck.forEach((card, i) => players[(firstSeat + i) % players.length].hand.push(card));

  const weaponRooms = shuffle(ROOMS, rng);
  const weapons = Object.fromEntries(WEAPONS.map((w, i) => [w, weaponRooms[i]])) as Record<Weapon, Room>;
  const pawns = Object.fromEntries(
    SUSPECTS.map((s) => [s, { type: 'square', x: START_SQUARES[s].x, y: START_SQUARES[s].y }])
  ) as Record<Suspect, Location>;

  const state: GameState = {
    phase: 'playing',
    players,
    envelope,
    pawns,
    weapons,
    turn: {
      playerId: players[0].id,
      number: 0,
      stage: 'roll',
      roll: null,
      moves: [],
      enteredRoom: null,
      stayed: false,
      suggestion: null,
    },
    history: [],
    accusations: [],
    winnerId: null,
    log: [],
    nextLogId: 1,
  };
  const events: GameEvent[] = [];
  addLog(state, now, 'system', 'The murder envelope has been sealed and the cards dealt.');
  beginTurn(state, 0, now, events);
  return { state, events };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function playerById(state: GameState, id: string): PlayerState | undefined {
  return state.players.find((p) => p.id === id);
}

export function activePlayer(state: GameState): PlayerState {
  return playerById(state, state.turn.playerId)!;
}

function pawnRoom(state: GameState, suspect: Suspect): Room | null {
  const loc = state.pawns[suspect];
  return loc.type === 'room' ? loc.room : null;
}

function occupiedSquares(state: GameState, except: Suspect): Set<string> {
  const set = new Set<string>();
  for (const s of SUSPECTS) {
    const loc = state.pawns[s];
    if (s !== except && loc.type === 'square') set.add(squareKey(loc));
  }
  return set;
}

export interface Options {
  roll: boolean;
  passage: Room | null;
  moves: MoveOption[];
  suggestIn: Room | null;
  show: CardName[];
  accuse: boolean;
  endTurn: boolean;
}

const NO_OPTIONS: Options = { roll: false, passage: null, moves: [], suggestIn: null, show: [], accuse: false, endTurn: false };

/** What `playerId` may do right now. Action validation and client buttons both use this. */
export function optionsFor(state: GameState, playerId: string): Options {
  if (state.phase !== 'playing') return NO_OPTIONS;
  const { turn } = state;

  if (turn.stage === 'disprove') {
    const s = turn.suggestion!;
    if (s.disproverId !== playerId) return NO_OPTIONS;
    const hand = playerById(state, playerId)!.hand;
    return { ...NO_OPTIONS, show: hand.filter((c) => c === s.suspect || c === s.weapon || c === s.room) };
  }
  if (turn.playerId !== playerId) return NO_OPTIONS;

  const me = activePlayer(state);
  const room = pawnRoom(state, me.suspect);
  const canSuggestHere = room !== null && turn.enteredRoom === room;
  return {
    roll: turn.stage === 'roll',
    passage: turn.stage === 'roll' && room ? (SECRET_PASSAGES[room] ?? null) : null,
    moves: turn.stage === 'move' ? turn.moves : [],
    suggestIn:
      canSuggestHere && (turn.stage === 'suggest' || (turn.stage === 'roll' && turn.stayed)) ? room : null,
    show: [],
    accuse: true,
    endTurn:
      turn.stage === 'end' ||
      turn.stage === 'suggest' ||
      (turn.stage === 'move' && turn.moves.length === 0) ||
      (turn.stage === 'roll' && turn.stayed),
  };
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export function applyAction(
  current: GameState,
  actorId: string,
  action: GameAction,
  rng: Rng,
  now = Date.now()
): ActionResult {
  if (current.phase !== 'playing') throw new RuleError('The game is over.');
  if (!playerById(current, actorId)) throw new RuleError('You are not in this game.');

  const state = structuredClone(current);
  const events: GameEvent[] = [];
  const opts = optionsFor(state, actorId);

  switch (action.type) {
    case 'roll': {
      if (!opts.roll) throw new RuleError('You cannot roll now.');
      const me = activePlayer(state);
      const dice: [number, number] = [rollDie(rng), rollDie(rng)];
      const total = dice[0] + dice[1];
      state.turn.roll = dice;
      state.turn.moves = legalMoves(state.pawns[me.suspect], total, occupiedSquares(state, me.suspect));
      state.turn.stage = 'move';
      state.turn.stayed = false;
      state.turn.enteredRoom = null;
      addLog(state, now, 'roll', `${me.name} rolled ${dice[0]} + ${dice[1]} = ${total}.`, me.id);
      if (state.turn.moves.length === 0) {
        addLog(state, now, 'move', `${me.name} is boxed in and cannot move this turn.`, me.id);
      }
      events.push({ type: 'rolled', playerId: me.id, dice });
      break;
    }

    case 'move': {
      const option = opts.moves.find((m) => m.key === action.target);
      if (!option) throw new RuleError('That square cannot be reached with this roll.');
      const me = activePlayer(state);
      const to: Location =
        option.kind === 'room' ? { type: 'room', room: option.room } : { type: 'square', x: option.x, y: option.y };
      state.pawns[me.suspect] = to;
      state.turn.moves = [];
      if (option.kind === 'room') {
        state.turn.enteredRoom = option.room;
        state.turn.stage = 'suggest';
        addLog(state, now, 'move', `${me.name} entered the ${option.room}.`, me.id);
      } else {
        state.turn.stage = 'end';
        addLog(state, now, 'move', `${me.name} moved ${option.path.length} squares.`, me.id);
      }
      events.push({ type: 'moved', suspect: me.suspect, path: option.path, to, how: 'walk' });
      break;
    }

    case 'passage': {
      if (!opts.passage) throw new RuleError('There is no secret passage to take.');
      const me = activePlayer(state);
      const from = pawnRoom(state, me.suspect)!;
      const to: Location = { type: 'room', room: opts.passage };
      state.pawns[me.suspect] = to;
      state.turn.enteredRoom = opts.passage;
      state.turn.stage = 'suggest';
      state.turn.stayed = false;
      addLog(state, now, 'move', `${me.name} took the secret passage from the ${from} to the ${opts.passage}.`, me.id);
      events.push({ type: 'moved', suspect: me.suspect, path: [], to, how: 'passage' });
      break;
    }

    case 'suggest': {
      if (!opts.suggestIn) throw new RuleError('You can only suggest in a room you have just entered.');
      if (!isSuspect(action.suspect) || !isWeapon(action.weapon)) throw new RuleError('Unknown suspect or weapon.');
      suggest(state, action.suspect, action.weapon, opts.suggestIn, now, events);
      break;
    }

    case 'show': {
      if (!isCard(action.card) || !opts.show.includes(action.card)) {
        throw new RuleError('You must show one of your cards that matches the suggestion.');
      }
      showCard(state, actorId, action.card, now, events);
      break;
    }

    case 'accuse': {
      if (!opts.accuse) throw new RuleError('You can only accuse on your own turn.');
      if (!isSuspect(action.suspect) || !isWeapon(action.weapon) || !isRoom(action.room)) {
        throw new RuleError('An accusation names one suspect, one weapon and one room.');
      }
      accuse(state, action.suspect, action.weapon, action.room, now, events);
      break;
    }

    case 'endTurn': {
      if (!opts.endTurn) throw new RuleError('You cannot end your turn yet.');
      advanceTurn(state, now, events);
      break;
    }

    default:
      throw new RuleError('Unknown action.');
  }

  return { state, events };
}

/** Server-side: skip the active player's turn (for example when they have disconnected). */
export function skipTurn(current: GameState, reason: string, now = Date.now()): ActionResult {
  if (current.phase !== 'playing' || current.turn.stage === 'disprove') return { state: current, events: [] };
  const state = structuredClone(current);
  const events: GameEvent[] = [];
  addLog(state, now, 'system', `${activePlayer(state).name} ${reason} Their turn is skipped.`, state.turn.playerId);
  advanceTurn(state, now, events);
  return { state, events };
}

function suggest(state: GameState, suspect: Suspect, weapon: Weapon, room: Room, now: number, events: GameEvent[]) {
  const me = activePlayer(state);
  const record: SuggestionRecord = {
    turn: state.turn.number,
    suggesterId: me.id,
    suspect,
    weapon,
    room,
    passedIds: [],
    disproverId: null,
    shownById: null,
  };
  state.turn.suggestion = record;
  state.turn.enteredRoom = null;
  state.turn.stayed = false;

  addLog(state, now, 'suggest', `${me.name} suggests it was ${suspect} in the ${room} with the ${weapon}.`, me.id);
  events.push({ type: 'suggested', playerId: me.id, suspect, weapon, room });

  // The named suspect's pawn and the weapon are brought into the room.
  if (pawnRoom(state, suspect) !== room) {
    state.pawns[suspect] = { type: 'room', room };
    const summoned = state.players.find((p) => p.suspect === suspect && p.id !== me.id);
    if (summoned) summoned.summoned = true;
    events.push({ type: 'moved', suspect, path: [], to: { type: 'room', room }, how: 'summoned' });
  }
  if (state.weapons[weapon] !== room) {
    state.weapons[weapon] = room;
    events.push({ type: 'weaponMoved', weapon, to: room });
  }

  // Ask each player in turn, starting on the suggester's left.
  const n = state.players.length;
  const start = state.players.findIndex((p) => p.id === me.id);
  for (let k = 1; k < n; k++) {
    const p = state.players[(start + k) % n];
    if (p.hand.some((c) => c === suspect || c === weapon || c === room)) {
      record.disproverId = p.id;
      state.turn.stage = 'disprove';
      addLog(state, now, 'show', `${p.name} can disprove and must show ${me.name} a card.`, p.id);
      return;
    }
    record.passedIds.push(p.id);
    addLog(state, now, 'pass', `${p.name} cannot disprove.`, p.id);
    events.push({ type: 'cannotDisprove', playerId: p.id });
  }

  state.history.push({ ...record });
  state.turn.stage = 'end';
  addLog(state, now, 'suggest', `No one could disprove ${me.name}'s suggestion!`, me.id);
  events.push({ type: 'unrefuted', playerId: me.id });
}

function showCard(state: GameState, disproverId: string, card: CardName, now: number, events: GameEvent[]) {
  const record = state.turn.suggestion!;
  const disprover = playerById(state, disproverId)!;
  const suggester = playerById(state, record.suggesterId)!;
  suggester.seen.push({ card, fromId: disprover.id, turn: record.turn });
  disprover.shown.push({ card, toId: suggester.id, turn: record.turn });
  record.disproverId = null;
  record.shownById = disprover.id;
  state.history.push({ ...record });
  state.turn.stage = 'end';

  addLog(state, now, 'show', `${disprover.name} showed ${suggester.name} a card.`, disprover.id);
  const pair = [disprover.id, suggester.id];
  events.push({ type: 'cardShown', fromId: disprover.id, toId: suggester.id, card, audience: pair });
  const others = state.players.filter((p) => !pair.includes(p.id)).map((p) => p.id);
  if (others.length) events.push({ type: 'cardShown', fromId: disprover.id, toId: suggester.id, audience: others });
}

function accuse(state: GameState, suspect: Suspect, weapon: Weapon, room: Room, now: number, events: GameEvent[]) {
  const me = activePlayer(state);
  const { envelope } = state;
  const correct = envelope.suspect === suspect && envelope.weapon === weapon && envelope.room === room;
  state.accusations.push({ turn: state.turn.number, playerId: me.id, suspect, weapon, room, correct });
  addLog(state, now, 'accuse', `${me.name} accuses ${suspect} in the ${room} with the ${weapon}!`, me.id);

  if (correct) {
    state.phase = 'over';
    state.winnerId = me.id;
    addLog(state, now, 'win', `${me.name} solved the case!`, me.id);
    events.push({ type: 'accused', playerId: me.id, suspect, weapon, room, correct, envelope });
    events.push({ type: 'gameOver', winnerId: me.id, envelope });
    return;
  }

  me.eliminated = true;
  me.knowsEnvelope = true;
  addLog(
    state,
    now,
    'accuse',
    `${me.name} was wrong and is out of the running, but must still show cards when asked.`,
    me.id
  );
  const others = state.players.filter((p) => p.id !== me.id).map((p) => p.id);
  events.push({ type: 'accused', playerId: me.id, suspect, weapon, room, correct, envelope, audience: [me.id] });
  events.push({ type: 'accused', playerId: me.id, suspect, weapon, room, correct, audience: others });

  if (state.players.every((p) => p.eliminated)) {
    state.phase = 'over';
    addLog(state, now, 'win', `Every detective was wrong. ${envelope.suspect} got away with it!`);
    events.push({ type: 'gameOver', winnerId: null, envelope });
    return;
  }
  advanceTurn(state, now, events);
}

function advanceTurn(state: GameState, now: number, events: GameEvent[]) {
  const n = state.players.length;
  const current = state.players.findIndex((p) => p.id === state.turn.playerId);
  for (let k = 1; k <= n; k++) {
    const idx = (current + k) % n;
    if (!state.players[idx].eliminated) {
      beginTurn(state, idx, now, events);
      return;
    }
  }
}

function beginTurn(state: GameState, index: number, now: number, events: GameEvent[]) {
  const p = state.players[index];
  const room = pawnRoom(state, p.suspect);
  const stayed = p.summoned && room !== null;
  p.summoned = false;
  state.turn = {
    playerId: p.id,
    number: state.turn.number + 1,
    stage: 'roll',
    roll: null,
    moves: [],
    enteredRoom: stayed ? room : null,
    stayed,
    suggestion: null,
  };
  addLog(state, now, 'turn', `Turn ${state.turn.number}: ${p.name} (${p.suspect}).`, p.id);
  events.push({ type: 'turn', playerId: p.id, number: state.turn.number });
}

function addLog(state: GameState, at: number, kind: LogKind, text: string, playerId?: string) {
  state.log.push({ id: state.nextLogId++, at, kind, text, playerId });
  if (state.log.length > MAX_LOG) state.log.splice(0, state.log.length - MAX_LOG);
}
