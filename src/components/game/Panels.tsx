import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, Dices, DoorOpen, Gavel, ScrollText, MessageCircle, Send, Sparkles, WifiOff } from 'lucide-react';
import { MoveOption } from '../../game/movement';
import { GameView } from '../../game/view';
import { ChatMessage, MemberView, RoomView } from '../../game/protocol';
import { Avatar } from '../art/Portraits';
import { Button } from '../ui/Modal';

export function PlayersStrip({ room, className = '' }: { room: RoomView; className?: string }) {
  const game = room.game!;
  const member = (id: string): MemberView | undefined => room.members.find((m) => m.id === id);
  const waitingOn = game.turn.stage === 'disprove' ? game.turn.suggestion?.disproverId : null;
  return (
    <div className={`flex gap-1.5 overflow-x-auto no-scrollbar px-2 py-1.5 ${className}`}>
      {game.players.map((p) => {
        const active = p.id === game.turn.playerId && game.phase === 'playing';
        const waiting = waitingOn === p.id;
        const m = member(p.id);
        return (
          <div
            key={p.id}
            className={`flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full border shrink-0 transition-colors ${
              active
                ? 'bg-[var(--mahogany-3)] border-[var(--gold)]'
                : waiting
                  ? 'bg-[var(--mahogany-2)] border-amber-500/70'
                  : 'bg-[var(--mahogany)]/80 border-[var(--gold)]/20'
            }`}
            title={`${p.name} (${p.suspect}) · ${p.cardCount} cards`}
          >
            <Avatar suspect={p.suspect} size={30} ring={active ? 'turn' : waiting ? 'wait' : 'none'} dim={p.eliminated} />
            <div className="leading-tight min-w-0">
              <div className={`text-[12px] font-deco font-bold max-w-[6.5rem] truncate ${p.eliminated ? 'line-through text-red-300/80' : ''}`}>
                {p.id === room.youId ? 'You' : p.name}
              </div>
              <div className="text-[11px] text-[var(--muted)] flex items-center gap-1">
                {p.eliminated ? 'Out' : `${p.cardCount} cards`}
                {m && !m.connected && <WifiOff className="w-3 h-3 text-red-400" aria-label="disconnected" />}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function statusLine(room: RoomView): string {
  const game = room.game!;
  const name = (id: string | null | undefined) => game.players.find((p) => p.id === id)?.name ?? 'Someone';
  const { turn, options } = game;
  const mine = turn.playerId === room.youId;
  if (game.phase === 'over') return 'The case is closed.';
  if (turn.stage === 'disprove') {
    return turn.suggestion?.disproverId === room.youId
      ? 'Choose a card to show.'
      : `Waiting for ${name(turn.suggestion?.disproverId)} to show a card…`;
  }
  if (!mine) {
    return turn.roll && turn.stage === 'move'
      ? `${name(turn.playerId)} rolled ${turn.roll[0] + turn.roll[1]}.`
      : `${name(turn.playerId)} is taking their turn.`;
  }
  if (turn.stage === 'roll') {
    if (options.suggestIn) return `You were brought into the ${options.suggestIn}. Suggest here, or roll to leave.`;
    return options.passage ? `Roll the dice, or take the secret passage to the ${options.passage}.` : 'Your turn. Roll the dice.';
  }
  if (turn.stage === 'move') {
    return options.moves.length
      ? `You rolled ${turn.roll![0] + turn.roll![1]}. Tap a glowing square, or enter a room.`
      : 'You are boxed in and cannot move.';
  }
  if (turn.stage === 'suggest') return `You are in the ${options.suggestIn}. Make a suggestion?`;
  return 'Accuse, or end your turn.';
}

export function ActionBar({
  room,
  selected,
  onMove,
  onClearSelection,
  onRoll,
  onPassage,
  onSuggest,
  onAccuse,
  onEndTurn,
}: {
  room: RoomView;
  selected: string | null;
  onMove: (target: string) => void;
  onClearSelection: () => void;
  onRoll: () => void;
  onPassage: () => void;
  onSuggest: () => void;
  onAccuse: () => void;
  onEndTurn: () => void;
}) {
  const game = room.game!;
  const o = game.options;
  const rooms = o.moves.filter((m): m is Extract<MoveOption, { kind: 'room' }> => m.kind === 'room');
  const chosen = o.moves.find((m) => m.key === selected);
  const myTurn = game.turn.playerId === room.youId && game.phase === 'playing';
  const anything = !!chosen || rooms.length > 0 || o.roll || !!o.passage || !!o.suggestIn || o.endTurn || o.accuse;
  return (
    <div className={`w-full panel rounded-2xl p-2 flex flex-col gap-2 ${myTurn ? 'border-[var(--gold)]/80' : ''}`}>
      <p className="text-[15px] leading-snug font-serif-vintage text-[var(--parchment)] px-1.5 flex items-start gap-2" aria-live="polite">
        <span className={`mt-[0.35em] w-2 h-2 shrink-0 rotate-45 ${myTurn ? 'bg-[var(--gold-light)]' : 'bg-[var(--muted)]/50'}`} aria-hidden="true" />
        <span>
          {chosen
            ? chosen.kind === 'room'
              ? `Enter the ${chosen.room}?`
              : `Move ${chosen.path.length} squares here?`
            : statusLine(room)}
        </span>
      </p>
      {chosen && (
        <div className="flex gap-2">
          <Button id="confirm-move" onClick={() => onMove(chosen.key)} className="flex-1">
            <Check className="w-4 h-4" /> {chosen.kind === 'room' ? `Enter ${chosen.room}` : 'Move here'}
          </Button>
          <Button variant="secondary" onClick={onClearSelection}>
            Cancel
          </Button>
        </div>
      )}
      {!chosen && rooms.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {rooms.map((m) => (
            <button
              key={m.key}
              type="button"
              data-move={m.key}
              onClick={() => onMove(m.key)}
              className="min-h-10 px-3.5 rounded-full bg-[var(--gold)]/15 border border-[var(--gold)] text-[var(--gold-light)] text-xs font-deco font-bold uppercase tracking-wide flex items-center gap-1.5 active:scale-95"
            >
              <DoorOpen className="w-3.5 h-3.5" /> Enter {m.room}
            </button>
          ))}
        </div>
      )}
      {/* Every destination as a button, for screen readers and keyboard players. */}
      <div className="sr-only">
        {o.moves
          .filter((m) => m.kind === 'square')
          .map((m) => (
            <button key={m.key} type="button" data-move={m.key} onClick={() => onMove(m.key)}>
              Move to square {m.key.slice(3)}
            </button>
          ))}
      </div>
      {anything && !chosen && (
        <div className="flex flex-wrap gap-2">
          {o.roll && (
            <Button id="roll" onClick={onRoll} className="flex-1 min-h-12 text-sm animate-pulse-glow">
              <Dices className="w-5 h-5" /> Roll the dice
            </Button>
          )}
          {o.passage && (
            <Button id="passage" variant="secondary" onClick={onPassage} className="flex-1">
              <DoorOpen className="w-4 h-4" /> Passage to {o.passage}
            </Button>
          )}
          {o.suggestIn && (
            <Button id="suggest" onClick={onSuggest} className="flex-1">
              <Sparkles className="w-4 h-4" /> Suggest
            </Button>
          )}
          {o.endTurn && (
            <Button id="end-turn" variant="secondary" onClick={onEndTurn} className="flex-1">
              End turn <ArrowRight className="w-4 h-4" />
            </Button>
          )}
          {o.accuse && (
            <Button id="accuse" variant="danger" onClick={onAccuse}>
              <Gavel className="w-4 h-4" /> Accuse
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function CaseLog({ game }: { game: GameView }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [game.log.length]);
  const suspectOf = (id?: string) => game.players.find((p) => p.id === id)?.suspect;
  return (
    <div className="space-y-0.5 text-[15px] leading-snug font-serif-vintage">
      {game.log.map((l) => {
        if (l.kind === 'turn') {
          const s = suspectOf(l.playerId);
          return (
            <div key={l.id} className="flex items-center gap-2 pt-3 pb-1">
              {s && <Avatar suspect={s} size={22} />}
              <span className="font-deco font-bold text-xs uppercase tracking-wider text-[var(--gold)]">{l.text}</span>
              <span className="deco-rule flex-1 opacity-60" />
            </div>
          );
        }
        return (
          <p
            key={l.id}
            className={`px-2 py-1 rounded-lg ${
              l.kind === 'accuse' || l.kind === 'win'
                ? 'bg-[var(--crimson)]/25 text-red-100 font-semibold'
                : l.kind === 'suggest'
                  ? 'bg-[var(--felt)]/60 text-emerald-50'
                  : l.kind === 'show' || l.kind === 'pass'
                    ? 'text-amber-100/90 italic'
                    : 'text-[var(--parchment)]/85'
            }`}
          >
            {l.text}
          </p>
        );
      })}
      <div ref={end} />
    </div>
  );
}

export function Chat({ messages, youId, onSend }: { messages: ChatMessage[]; youId: string | null; onSend: (text: string) => void }) {
  const [text, setText] = useState('');
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1">
        {messages.length === 0 && <p className="text-[var(--muted)] italic px-2 py-6 text-center">No one has said anything yet. Accuse someone of something.</p>}
        {messages.map((m) => {
          const mine = m.memberId === youId;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <p
                className={`max-w-[85%] px-3 py-1.5 rounded-2xl text-[15px] leading-snug ${
                  mine ? 'bg-[var(--gold)]/20 border border-[var(--gold)]/40 rounded-br-sm' : 'bg-[var(--mahogany-3)]/70 border border-white/5 rounded-bl-sm'
                }`}
              >
                {!mine && <span className="block text-[11px] font-deco font-bold text-[var(--gold)]">{m.name}</span>}
                <span className="break-words">{m.text}</span>
              </p>
            </div>
          );
        })}
        <div ref={end} />
      </div>
      <form
        className="flex gap-2 pt-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) onSend(text.trim());
          setText('');
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={300}
          placeholder="Say something…"
          enterKeyHint="send"
          className="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-[var(--ink)]/70 border border-[var(--gold)]/40 text-base focus:outline-none focus:border-[var(--gold-light)]"
        />
        <button type="submit" className="w-11 rounded-xl bg-[var(--gold)] text-[#1f120a] flex items-center justify-center" aria-label="Send">
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}

/** Unread chat count since the chat was last open. */
export function useUnread(count: number, open: boolean): number {
  const [seen, setSeen] = useState(count);
  useEffect(() => {
    if (open) setSeen(count);
  }, [open, count]);
  return Math.max(0, count - seen);
}

/** Desktop right-hand column: the case log and chat. */
export function SidePanel({ room, onChat }: { room: RoomView; onChat: (text: string) => void }) {
  const [tab, setTab] = useState<'log' | 'chat'>('log');
  const unread = useUnread(room.chat.length, tab === 'chat');
  return (
    <div className="flex flex-col min-h-0 h-full w-full panel rounded-2xl overflow-hidden">
      <div className="flex border-b border-[var(--gold)]/25" role="tablist">
        {(['log', 'chat'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 font-deco font-bold text-xs uppercase tracking-[0.16em] flex items-center justify-center gap-1.5 border-b-2 ${
              tab === t ? 'border-[var(--gold)] text-[var(--gold-light)]' : 'border-transparent text-[var(--muted)]'
            }`}
          >
            {t === 'log' ? <ScrollText className="w-4 h-4" /> : <MessageCircle className="w-4 h-4" />}
            {t === 'log' ? 'Case log' : 'Chat'}
            {t === 'chat' && unread > 0 && <span className="px-1.5 rounded-full bg-[var(--crimson-light)] text-white text-[10px] font-mono">{unread}</span>}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-3">
        {tab === 'log' ? <CaseLog game={room.game!} /> : <Chat messages={room.chat} youId={room.youId} onSend={onChat} />}
      </div>
    </div>
  );
}
