import { describe, expect, it } from 'vitest';
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  cellAt,
  corridorNeighbours,
  DOORS,
  isCorridor,
  ROOM_LAYOUTS,
  squareKey,
  START_SQUARES,
} from './board';
import { Deduction, chooseBotAction } from './bot';
import { CardName, ROOMS, SECRET_PASSAGES, Suspect, SUSPECTS, WEAPONS } from './constants';
import { applyAction, GameAction, GameState, optionsFor, RuleError, SeatConfig, skipTurn, startGame } from './engine';
import { legalMoves, roomTarget, squareTarget } from './movement';
import { seededRng } from './rng';
import { eventsFor, viewFor } from './view';

const rng = seededRng(1234);

function seats(...suspects: Suspect[]): SeatConfig[] {
  return suspects.map((suspect, i) => ({ id: `p${i}`, name: `Player ${i}`, suspect, isBot: false }));
}

function game(...suspects: Suspect[]): GameState {
  return startGame(seats(...suspects), seededRng(42), 0).state;
}

function act(state: GameState, id: string, action: GameAction) {
  return applyAction(state, id, action, rng, 0);
}

function idOf(state: GameState, suspect: Suspect): string {
  return state.players.find((p) => p.suspect === suspect)!.id;
}

describe('board', () => {
  it('is the classic 24 x 25 board with 17 doors', () => {
    expect(BOARD_WIDTH).toBe(24);
    expect(BOARD_HEIGHT).toBe(25);
    expect(DOORS).toHaveLength(17);
    for (const door of DOORS) {
      const inside = cellAt(door.inside.x, door.inside.y);
      expect(inside.kind === 'room' && inside.room).toBe(door.room);
      expect(isCorridor(door.outside.x, door.outside.y)).toBe(true);
      expect(Math.abs(door.inside.x - door.outside.x) + Math.abs(door.inside.y - door.outside.y)).toBe(1);
    }
  });

  it('places the starting squares on the classic edges', () => {
    expect(START_SQUARES['Miss Scarlet']).toEqual({ x: 7, y: 24 });
    expect(START_SQUARES['Colonel Mustard']).toEqual({ x: 0, y: 17 });
    expect(START_SQUARES['Mrs. White']).toEqual({ x: 9, y: 0 });
    expect(START_SQUARES['Mr. Green']).toEqual({ x: 14, y: 0 });
    expect(START_SQUARES['Mrs. Peacock']).toEqual({ x: 23, y: 6 });
    expect(START_SQUARES['Professor Plum']).toEqual({ x: 23, y: 19 });
  });

  it('connects every starting square to every room', () => {
    for (const suspect of SUSPECTS) {
      const seen = new Set([squareKey(START_SQUARES[suspect])]);
      const queue = [START_SQUARES[suspect]];
      for (let i = 0; i < queue.length; i++) {
        for (const n of corridorNeighbours(queue[i])) {
          if (!seen.has(squareKey(n))) {
            seen.add(squareKey(n));
            queue.push(n);
          }
        }
      }
      for (const room of ROOMS) {
        expect(ROOM_LAYOUTS[room].doors.some((d) => seen.has(squareKey(d.outside)))).toBe(true);
      }
    }
  });

  it('has secret passages between opposite corners', () => {
    expect(SECRET_PASSAGES).toEqual({ Kitchen: 'Study', Study: 'Kitchen', Lounge: 'Conservatory', Conservatory: 'Lounge' });
  });
});

describe('movement', () => {
  const scarletStart = { type: 'square' as const, ...START_SQUARES['Miss Scarlet'] };

  it('requires the exact roll for corridor destinations', () => {
    const keys = legalMoves(scarletStart, 2, new Set()).map((m) => m.key);
    expect(keys).not.toContain(squareTarget({ x: 7, y: 23 }));
    expect(keys.sort()).toEqual([squareTarget({ x: 7, y: 22 }), squareTarget({ x: 8, y: 23 })].sort());
  });

  it('never steps onto or through an occupied square', () => {
    expect(legalMoves(scarletStart, 6, new Set(['7,23']))).toEqual([]);
  });

  it('never visits the same square twice', () => {
    for (const m of legalMoves(scarletStart, 12, new Set())) {
      const keys = m.path.map(squareKey);
      expect(new Set(keys).size).toBe(keys.length);
      expect(keys).not.toContain(squareKey(scarletStart));
    }
  });

  it('allows entering a room with fewer steps than rolled', () => {
    const moves = legalMoves({ type: 'square', x: 6, y: 18 }, 9, new Set());
    const lounge = moves.find((m) => m.key === roomTarget('Lounge'));
    expect(lounge?.path).toEqual([]);
  });

  it('exits through a door and never re-enters the room just left', () => {
    const moves = legalMoves({ type: 'room', room: 'Lounge' }, 3, new Set());
    expect(moves.some((m) => m.key === roomTarget('Lounge'))).toBe(false);
    for (const m of moves) expect(m.path[0]).toEqual({ x: 6, y: 18 });
  });

  it('cannot leave a room whose doors are all blocked', () => {
    expect(legalMoves({ type: 'room', room: 'Lounge' }, 7, new Set(['6,18']))).toEqual([]);
  });
});

describe('setup', () => {
  it('seals one card of each kind and deals the other 18', () => {
    const g = game('Miss Scarlet', 'Colonel Mustard', 'Mrs. White');
    const dealt = g.players.flatMap((p) => p.hand);
    expect(dealt).toHaveLength(18);
    expect(dealt).not.toContain(g.envelope.suspect);
    expect(dealt).not.toContain(g.envelope.weapon);
    expect(dealt).not.toContain(g.envelope.room);
    expect(new Set(dealt).size).toBe(18);
    expect(g.players.map((p) => p.hand.length)).toEqual([6, 6, 6]);
  });

  it('deals uneven hands when the cards do not divide evenly', () => {
    const g = game('Miss Scarlet', 'Colonel Mustard', 'Mrs. White', 'Mr. Green');
    expect(g.players.map((p) => p.hand.length).sort()).toEqual([4, 4, 5, 5]);
  });

  it('seats players clockwise from Miss Scarlet, whatever order they joined in', () => {
    const g = game('Professor Plum', 'Mr. Green', 'Miss Scarlet', 'Colonel Mustard');
    expect(g.players.map((p) => p.suspect)).toEqual(['Miss Scarlet', 'Colonel Mustard', 'Mr. Green', 'Professor Plum']);
    expect(g.turn.playerId).toBe(idOf(g, 'Miss Scarlet'));
  });

  it('puts all six pawns on their starting squares and each weapon in a different room', () => {
    const g = game('Mrs. White', 'Mr. Green');
    for (const s of SUSPECTS) expect(g.pawns[s]).toEqual({ type: 'square', ...START_SQUARES[s] });
    expect(new Set(Object.values(g.weapons)).size).toBe(WEAPONS.length);
  });
});

describe('turns', () => {
  it('only lets the active player roll, then requires a legal destination', () => {
    const g = game('Miss Scarlet', 'Colonel Mustard');
    expect(() => act(g, idOf(g, 'Colonel Mustard'), { type: 'roll' })).toThrow(RuleError);
    const rolled = act(g, idOf(g, 'Miss Scarlet'), { type: 'roll' }).state;
    expect(rolled.turn.stage).toBe('move');
    expect(() => act(rolled, idOf(rolled, 'Miss Scarlet'), { type: 'move', target: 'sq:7,23' })).toThrow(RuleError);
  });

  it('follows seating order and skips eliminated players', () => {
    let g = game('Professor Plum', 'Miss Scarlet', 'Mr. Green');
    const order: Suspect[] = [];
    for (let i = 0; i < 3; i++) {
      order.push(g.players.find((p) => p.id === g.turn.playerId)!.suspect);
      g = skipTurn(g, 'is away.', 0).state;
    }
    expect(order).toEqual(['Miss Scarlet', 'Mr. Green', 'Professor Plum']);
    g.players.find((p) => p.suspect === 'Mr. Green')!.eliminated = true;
    g = skipTurn(g, 'is away.', 0).state;
    expect(g.turn.playerId).toBe(idOf(g, 'Professor Plum'));
  });

  it('does not let a player end the turn before moving', () => {
    const g = game('Miss Scarlet', 'Colonel Mustard');
    expect(() => act(g, idOf(g, 'Miss Scarlet'), { type: 'endTurn' })).toThrow(RuleError);
  });

  it('lets a player take a secret passage instead of rolling, then suggest', () => {
    const g = game('Miss Scarlet', 'Colonel Mustard');
    g.pawns['Miss Scarlet'] = { type: 'room', room: 'Lounge' };
    const after = act(g, idOf(g, 'Miss Scarlet'), { type: 'passage' }).state;
    expect(after.pawns['Miss Scarlet']).toEqual({ type: 'room', room: 'Conservatory' });
    expect(optionsFor(after, idOf(after, 'Miss Scarlet')).suggestIn).toBe('Conservatory');
  });
});

describe('suggestions', () => {
  function inLounge(...suspects: Suspect[]) {
    const g = game(...suspects);
    g.pawns['Miss Scarlet'] = { type: 'room', room: 'Lounge' };
    g.turn.stage = 'suggest';
    g.turn.enteredRoom = 'Lounge';
    return g;
  }

  function give(g: GameState, suspect: Suspect, hand: CardName[]) {
    g.players.find((p) => p.suspect === suspect)!.hand = hand;
  }

  it('asks players clockwise and stops at the first who can disprove', () => {
    const g = inLounge('Miss Scarlet', 'Colonel Mustard', 'Mrs. White', 'Mr. Green');
    give(g, 'Colonel Mustard', ['Kitchen']);
    give(g, 'Mrs. White', ['Rope', 'Mr. Green']);
    give(g, 'Mr. Green', ['Lounge']);
    const { state, events } = act(g, idOf(g, 'Miss Scarlet'), { type: 'suggest', suspect: 'Mr. Green', weapon: 'Rope' });
    expect(state.turn.stage).toBe('disprove');
    expect(state.turn.suggestion?.passedIds).toEqual([idOf(g, 'Colonel Mustard')]);
    expect(state.turn.suggestion?.disproverId).toBe(idOf(g, 'Mrs. White'));
    expect(events.filter((e) => e.type === 'cannotDisprove')).toHaveLength(1);
    expect(optionsFor(state, idOf(g, 'Mrs. White')).show.sort()).toEqual(['Mr. Green', 'Rope']);
  });

  it('brings the named suspect and weapon into the room', () => {
    const g = inLounge('Miss Scarlet', 'Colonel Mustard');
    const { state } = act(g, idOf(g, 'Miss Scarlet'), { type: 'suggest', suspect: 'Professor Plum', weapon: 'Wrench' });
    expect(state.pawns['Professor Plum']).toEqual({ type: 'room', room: 'Lounge' });
    expect(state.weapons.Wrench).toBe('Lounge');
  });

  it('shows the card only to the suggester and disprover', () => {
    const g = inLounge('Miss Scarlet', 'Colonel Mustard', 'Mrs. White');
    give(g, 'Colonel Mustard', ['Rope']);
    let r = act(g, idOf(g, 'Miss Scarlet'), { type: 'suggest', suspect: 'Mr. Green', weapon: 'Rope' });
    expect(() => act(r.state, idOf(g, 'Mrs. White'), { type: 'show', card: 'Rope' })).toThrow(RuleError);
    expect(() => act(r.state, idOf(g, 'Colonel Mustard'), { type: 'show', card: 'Kitchen' })).toThrow(RuleError);
    r = act(r.state, idOf(g, 'Colonel Mustard'), { type: 'show', card: 'Rope' });

    const scarlet = viewFor(r.state, idOf(g, 'Miss Scarlet'));
    const white = viewFor(r.state, idOf(g, 'Mrs. White'));
    expect(scarlet.me?.seen).toEqual([{ card: 'Rope', fromId: idOf(g, 'Colonel Mustard'), turn: 1 }]);
    expect(white.me?.seen).toEqual([]);
    expect(eventsFor(r.events, idOf(g, 'Miss Scarlet')).find((e) => e.type === 'cardShown')).toMatchObject({ card: 'Rope' });
    const whiteEvent = eventsFor(r.events, idOf(g, 'Mrs. White')).find((e) => e.type === 'cardShown');
    expect(whiteEvent).toBeDefined();
    expect(whiteEvent).not.toHaveProperty('card');
    expect(JSON.stringify(white)).not.toContain('"card":"Rope"');
    expect(r.state.turn.stage).toBe('end');
  });

  it('records an unrefuted suggestion', () => {
    const g = inLounge('Miss Scarlet', 'Colonel Mustard');
    give(g, 'Colonel Mustard', ['Kitchen']);
    const { state, events } = act(g, idOf(g, 'Miss Scarlet'), { type: 'suggest', suspect: 'Mr. Green', weapon: 'Rope' });
    expect(state.turn.stage).toBe('end');
    expect(events.some((e) => e.type === 'unrefuted')).toBe(true);
    expect(state.history.at(-1)?.passedIds).toEqual([idOf(g, 'Colonel Mustard')]);
  });

  it('blocks ending the turn or accusing while a card is owed', () => {
    const g = inLounge('Miss Scarlet', 'Colonel Mustard');
    give(g, 'Colonel Mustard', ['Rope']);
    const { state } = act(g, idOf(g, 'Miss Scarlet'), { type: 'suggest', suspect: 'Mr. Green', weapon: 'Rope' });
    expect(() => act(state, idOf(g, 'Miss Scarlet'), { type: 'endTurn' })).toThrow(RuleError);
    expect(() =>
      act(state, idOf(g, 'Miss Scarlet'), { type: 'accuse', suspect: 'Mr. Green', weapon: 'Rope', room: 'Lounge' })
    ).toThrow(RuleError);
  });

  it('allows only one suggestion per room entry', () => {
    const g = inLounge('Miss Scarlet', 'Colonel Mustard');
    give(g, 'Colonel Mustard', []);
    const { state } = act(g, idOf(g, 'Miss Scarlet'), { type: 'suggest', suspect: 'Mr. Green', weapon: 'Rope' });
    expect(() => act(state, idOf(g, 'Miss Scarlet'), { type: 'suggest', suspect: 'Mr. Green', weapon: 'Rope' })).toThrow(
      RuleError
    );
  });

  it('lets a summoned player suggest on their next turn without moving, once', () => {
    const g = inLounge('Miss Scarlet', 'Colonel Mustard');
    give(g, 'Colonel Mustard', []);
    const scarlet = idOf(g, 'Miss Scarlet');
    const mustard = idOf(g, 'Colonel Mustard');
    let s = act(g, scarlet, { type: 'suggest', suspect: 'Colonel Mustard', weapon: 'Rope' }).state;
    s = act(s, scarlet, { type: 'endTurn' }).state;
    expect(s.turn.playerId).toBe(mustard);
    expect(optionsFor(s, mustard).suggestIn).toBe('Lounge');
    expect(optionsFor(s, mustard).endTurn).toBe(true);

    // Rolling instead forfeits the right to suggest without moving.
    const rolled = act(s, mustard, { type: 'roll' }).state;
    expect(optionsFor(rolled, mustard).suggestIn).toBeNull();

    // And a player who simply stays in a room cannot suggest there again on a later turn.
    s = act(s, mustard, { type: 'endTurn' }).state;
    s = skipTurn(s, 'is away.', 0).state;
    expect(s.turn.playerId).toBe(mustard);
    expect(optionsFor(s, mustard).suggestIn).toBeNull();
  });
});

describe('accusations', () => {
  it('a correct accusation wins and reveals the envelope to everyone', () => {
    const g = game('Miss Scarlet', 'Colonel Mustard');
    const { state, events } = act(g, idOf(g, 'Miss Scarlet'), { type: 'accuse', ...g.envelope });
    expect(state.phase).toBe('over');
    expect(state.winnerId).toBe(idOf(g, 'Miss Scarlet'));
    expect(viewFor(state, idOf(g, 'Colonel Mustard')).envelope).toEqual(g.envelope);
    expect(events.some((e) => e.type === 'gameOver')).toBe(true);
  });

  it('a wrong accusation eliminates the player, who still has to show cards', () => {
    const g = game('Miss Scarlet', 'Colonel Mustard', 'Mrs. White');
    const wrong = { suspect: SUSPECTS.find((s) => s !== g.envelope.suspect)!, weapon: g.envelope.weapon, room: g.envelope.room };
    const scarlet = idOf(g, 'Miss Scarlet');
    const { state, events } = act(g, scarlet, { type: 'accuse', ...wrong });
    expect(state.players[0].eliminated).toBe(true);
    expect(state.turn.playerId).toBe(idOf(g, 'Colonel Mustard'));
    expect(viewFor(state, scarlet).envelope).toEqual(g.envelope);
    expect(viewFor(state, idOf(g, 'Colonel Mustard')).envelope).toBeNull();
    expect(eventsFor(events, idOf(g, 'Mrs. White')).find((e) => e.type === 'accused')).not.toHaveProperty('envelope');
    expect(eventsFor(events, scarlet).find((e) => e.type === 'accused')).toHaveProperty('envelope');

    // Mustard suggests something Scarlet holds: Scarlet must still disprove.
    state.pawns['Colonel Mustard'] = { type: 'room', room: 'Hall' };
    state.turn.stage = 'suggest';
    state.turn.enteredRoom = 'Hall';
    state.players[0].hand = ['Rope'];
    state.players[2].hand = [];
    const s = act(state, idOf(g, 'Colonel Mustard'), { type: 'suggest', suspect: 'Mr. Green', weapon: 'Rope' }).state;
    expect(s.turn.suggestion?.disproverId).toBe(scarlet);
  });

  it('ends with no winner when everyone accuses wrongly', () => {
    let g = game('Miss Scarlet', 'Colonel Mustard');
    const wrong = { suspect: g.envelope.suspect, weapon: WEAPONS.find((w) => w !== g.envelope.weapon)!, room: g.envelope.room };
    g = act(g, idOf(g, 'Miss Scarlet'), { type: 'accuse', ...wrong }).state;
    g = act(g, idOf(g, 'Colonel Mustard'), { type: 'accuse', ...wrong }).state;
    expect(g.phase).toBe('over');
    expect(g.winnerId).toBeNull();
  });
});

describe('privacy', () => {
  it('never puts another player’s hand or the envelope in a view', () => {
    const g = game('Miss Scarlet', 'Colonel Mustard', 'Mrs. White');
    for (const viewer of g.players) {
      const view = viewFor(g, viewer.id);
      const json = JSON.stringify(view);
      expect(json.match(/"hand":/g)).toHaveLength(1);
      expect(view.me?.hand).toEqual(viewer.hand);
      expect(view.envelope).toBeNull();
      expect(json).not.toContain('"envelope":{');
    }
  });
});

describe('bots', () => {
  function simulate(seed: number, suspects: Suspect[]) {
    const r = seededRng(seed);
    let state = startGame(
      suspects.map((s, i) => ({ id: `b${i}`, name: `Bot ${i}`, suspect: s, isBot: true })),
      r,
      0
    ).state;
    for (let step = 0; step < 5000 && state.phase === 'playing'; step++) {
      const actorId = state.turn.stage === 'disprove' ? state.turn.suggestion!.disproverId! : state.turn.playerId;
      const view = viewFor(state, actorId);

      // Deductions must never contradict the truth.
      const know = new Deduction(view);
      for (const p of state.players) for (const c of p.hand) expect(know.possible.get(c)!.has(p.id)).toBe(true);
      expect(know.mightBeInEnvelope(state.envelope.suspect)).toBe(true);
      expect(know.mightBeInEnvelope(state.envelope.weapon)).toBe(true);
      expect(know.mightBeInEnvelope(state.envelope.room)).toBe(true);

      const action = chooseBotAction(view, r);
      expect(action).not.toBeNull();
      state = applyAction(state, actorId, action!, r, 0).state;
    }
    return state;
  }

  it.each([
    [1, 3],
    [2, 4],
    [3, 5],
    [4, 6],
    [5, 2],
  ])('seed %i with %i bots plays to a correct solution', (seed, count) => {
    const state = simulate(seed, SUSPECTS.slice(0, count) as Suspect[]);
    expect(state.phase).toBe('over');
    expect(state.winnerId).not.toBeNull();
    expect(state.accusations.every((a) => a.correct)).toBe(true);
  });
});
