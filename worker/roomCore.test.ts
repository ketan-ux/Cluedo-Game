import { describe, expect, it } from 'vitest';
import { chooseBotAction } from '../src/game/bot';
import { CardName } from '../src/game/constants';
import { seededRng } from '../src/game/rng';
import { eventsFor, viewFor } from '../src/game/view';
import { createRoomData, RoomCore, RoomError } from './roomCore';

function room(seed = 7) {
  let n = 0;
  return new RoomCore(createRoomData('ABCDE', 0), seededRng(seed), () => `token-${++n}`);
}

const none = new Set<string>();

describe('lobby', () => {
  it('makes the first player host and gives everyone a different suspect', () => {
    const r = room();
    const a = r.hello({ name: 'Ana', suspect: 'Mrs. Peacock' }, 0);
    const b = r.hello({ name: 'Ben', suspect: 'Mrs. Peacock' }, 0);
    expect(r.data.hostId).toBe(a.id);
    expect(a.suspect).toBe('Mrs. Peacock');
    expect(b.suspect).not.toBe('Mrs. Peacock');
  });

  it('resumes a seat by token, never by name', () => {
    const r = room();
    const a = r.hello({ name: 'Ana' }, 0);
    expect(r.hello({ token: a.token, name: 'Someone else' }, 0).id).toBe(a.id);
    expect(r.hello({ name: 'Ana' }, 0).id).not.toBe(a.id);
  });

  it('refuses a seventh player and newcomers once the game has started', () => {
    const r = room();
    const ids = Array.from({ length: 6 }, (_, i) => r.hello({ name: `P${i}` }, 0).id);
    expect(() => r.hello({ name: 'Late' }, 0)).toThrow(RoomError);
    r.act(ids[0], { type: 'remove', memberId: ids[5] }, new Set([ids[0]]), 0);
    r.act(ids[0], { type: 'start' }, new Set([ids[0]]), 0);
    expect(() => r.hello({ name: 'Late' }, 0)).toThrow(RoomError);
  });

  it('keeps host-only actions for the host while the host is connected', () => {
    const r = room();
    const host = r.hello({ name: 'Host' }, 0);
    const guest = r.hello({ name: 'Guest' }, 0);
    const both = new Set([host.id, guest.id]);
    expect(() => r.act(guest.id, { type: 'addBot' }, both, 0)).toThrow('Only the host');
    expect(() => r.act(guest.id, { type: 'start' }, both, 0)).toThrow('Only the host');
    expect(() => r.act(guest.id, { type: 'remove', memberId: host.id }, both, 0)).toThrow('Only the host');

    // If the host drops off, someone else can carry on hosting.
    r.act(guest.id, { type: 'addBot' }, new Set([guest.id]), 0);
    expect(r.data.hostId).toBe(guest.id);
    expect(r.data.members.filter((m) => m.isBot)).toHaveLength(1);
  });

  it('needs two players to start, bots included', () => {
    const r = room();
    const host = r.hello({ name: 'Host' }, 0);
    expect(() => r.act(host.id, { type: 'start' }, none, 0)).toThrow('at least 2');
    r.act(host.id, { type: 'addBot' }, none, 0);
    r.act(host.id, { type: 'start' }, none, 0);
    expect(r.data.status).toBe('playing');
  });

  it('hands the host role on when the host leaves the lobby', () => {
    const r = room();
    const host = r.hello({ name: 'Host' }, 0);
    const guest = r.hello({ name: 'Guest' }, 0);
    r.leave(host.id, 0);
    expect(r.data.hostId).toBe(guest.id);
    expect(r.data.members.map((m) => m.id)).toEqual([guest.id]);
  });
});

describe('pacing', () => {
  it('lets bots act only once their thinking time has passed', () => {
    const r = room();
    const host = r.hello({ name: 'Host', suspect: 'Professor Plum' }, 0);
    r.act(host.id, { type: 'addBot', suspect: 'Miss Scarlet' }, new Set([host.id]), 0);
    r.act(host.id, { type: 'start' }, new Set([host.id]), 0);
    const connected = new Set([host.id]);
    const due = r.schedule(connected, 0)!;
    expect(due).toBeGreaterThan(0);
    expect(r.tick(connected, due - 1)).toBeNull();
    expect(r.tick(connected, due)?.some((e) => e.type === 'rolled')).toBe(true);
  });

  it('skips the turn of a player who has disconnected, after a grace period', () => {
    const r = room();
    const a = r.hello({ name: 'Ana', suspect: 'Miss Scarlet' }, 0);
    const b = r.hello({ name: 'Ben', suspect: 'Colonel Mustard' }, 0);
    r.act(a.id, { type: 'start' }, new Set([a.id, b.id]), 0);
    const onlyBen = new Set([b.id]);
    const deadline = r.schedule(onlyBen, 1000)!;
    expect(r.view(b.id, onlyBen).away).toEqual({ memberId: a.id, deadline });
    expect(r.tick(onlyBen, deadline - 1)).toBeNull();
    r.tick(onlyBen, deadline);
    expect(r.data.game!.turn.playerId).toBe(b.id);
    expect(r.schedule(onlyBen, deadline)).toBeNull();
  });

  it('cancels the countdown when the player comes back', () => {
    const r = room();
    const a = r.hello({ name: 'Ana', suspect: 'Miss Scarlet' }, 0);
    const b = r.hello({ name: 'Ben' }, 0);
    r.act(a.id, { type: 'start' }, new Set([a.id, b.id]), 0);
    r.schedule(new Set([b.id]), 0);
    expect(r.schedule(new Set([a.id, b.id]), 10)).toBeNull();
    expect(r.data.away).toBeNull();
  });
});

describe('privacy across a whole game', () => {
  it('only ever sends a player their own hand, their own shown cards, and the envelope when allowed', () => {
    const r = room(99);
    const humans = ['Ana', 'Ben', 'Cy'].map((name) => r.hello({ name }, 0));
    const everyone = new Set(humans.map((h) => h.id));
    r.act(humans[0].id, { type: 'addBot' }, everyone, 0);
    let { events } = r.act(humans[0].id, { type: 'start' }, everyone, 0);
    const actRng = seededRng(5);

    for (let step = 0; step < 4000 && r.data.status === 'playing'; step++) {
      const game = r.data.game!;
      for (const m of r.data.members) {
        const view = r.view(m.id, everyone);
        const json = JSON.stringify(view);
        const me = game.players.find((p) => p.id === m.id)!;
        expect(view.game!.me!.hand).toEqual(me.hand);
        expect(json.match(/"hand":/g)).toHaveLength(1);

        const allowedCards = new Set<CardName>([...me.hand, ...me.seen.map((s) => s.card)]);
        for (const match of json.matchAll(/"card":"([^"]+)"/g)) expect(allowedCards.has(match[1] as CardName)).toBe(true);
        if (!me.knowsEnvelope && game.phase !== 'over') expect(json).not.toContain('"envelope":{');

        for (const e of eventsFor(events, m.id)) {
          if (e.type === 'cardShown' && e.card) expect([e.fromId, e.toId]).toContain(m.id);
          if (e.type === 'accused' && e.envelope && !e.correct) expect(e.playerId).toBe(m.id);
        }
      }

      const actorId = game.turn.stage === 'disprove' ? game.turn.suggestion!.disproverId! : game.turn.playerId;
      const actor = r.member(actorId)!;
      if (actor.isBot) {
        events = r.tick(everyone, Number.MAX_SAFE_INTEGER) ?? [];
        r.schedule(everyone, 0);
      } else {
        const action = chooseBotAction(viewFor(game, actorId), actRng)!;
        events = r.act(actorId, action, everyone, 0).events;
      }
    }
    expect(r.data.status).toBe('over');
  });
});

describe('rematch', () => {
  it('returns everyone to the lobby with the same seats', () => {
    const r = room();
    const host = r.hello({ name: 'Host' }, 0);
    r.act(host.id, { type: 'addBot' }, none, 0);
    r.act(host.id, { type: 'start' }, none, 0);
    expect(() => r.act(host.id, { type: 'rematch' }, none, 0)).toThrow(RoomError);
    r.act(host.id, { type: 'accuse', ...r.data.game!.envelope }, none, 0);
    expect(r.data.status).toBe('over');
    r.act(host.id, { type: 'rematch' }, none, 0);
    expect(r.data.status).toBe('lobby');
    expect(r.data.game).toBeNull();
    expect(r.data.members).toHaveLength(2);
  });
});
