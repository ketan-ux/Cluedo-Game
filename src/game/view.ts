import { CardName, Room, Suspect, Weapon } from './constants';
import {
  AccusationRecord,
  Envelope,
  GameEvent,
  GameState,
  LogEntry,
  Options,
  optionsFor,
  SeenCard,
  ShownCard,
  Stage,
  SuggestionRecord,
} from './engine';
import { Location } from './movement';

export interface PublicPlayer {
  id: string;
  name: string;
  suspect: Suspect;
  isBot: boolean;
  eliminated: boolean;
  cardCount: number;
}

export interface MyInfo {
  id: string;
  hand: CardName[];
  seen: SeenCard[];
  shown: ShownCard[];
}

/** Everything one player is allowed to know. Built on the server for each recipient. */
export interface GameView {
  phase: 'playing' | 'over';
  players: PublicPlayer[];
  pawns: Record<Suspect, Location>;
  weapons: Record<Weapon, Room>;
  turn: {
    playerId: string;
    number: number;
    stage: Stage;
    roll: [number, number] | null;
    suggestion: SuggestionRecord | null;
  };
  history: SuggestionRecord[];
  accusations: AccusationRecord[];
  winnerId: string | null;
  /** Revealed when the game is over, or to a player who has accused wrongly. */
  envelope: Envelope | null;
  log: LogEntry[];
  me: MyInfo | null;
  options: Options;
}

const VIEW_LOG = 150;

export function viewFor(state: GameState, viewerId: string | null): GameView {
  const me = viewerId ? state.players.find((p) => p.id === viewerId) : undefined;
  return {
    phase: state.phase,
    players: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      suspect: p.suspect,
      isBot: p.isBot,
      eliminated: p.eliminated,
      cardCount: p.hand.length,
    })),
    pawns: state.pawns,
    weapons: state.weapons,
    turn: {
      playerId: state.turn.playerId,
      number: state.turn.number,
      stage: state.turn.stage,
      roll: state.turn.roll,
      suggestion: state.turn.suggestion,
    },
    history: state.history,
    accusations: state.accusations,
    winnerId: state.winnerId,
    envelope: state.phase === 'over' || me?.knowsEnvelope ? state.envelope : null,
    log: state.log.slice(-VIEW_LOG),
    me: me ? { id: me.id, hand: me.hand, seen: me.seen, shown: me.shown } : null,
    options: optionsFor(state, me?.id ?? ''),
  };
}

export function eventsFor(events: GameEvent[], viewerId: string | null): GameEvent[] {
  return events
    .filter((e) => !e.audience || (viewerId !== null && e.audience.includes(viewerId)))
    .map(({ audience: _audience, ...e }) => e as GameEvent);
}
