import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, BookOpen, Check, Dices, DoorOpen, Gavel, Send, Sparkles, WifiOff } from 'lucide-react';
import { SUSPECT_COLORS } from '../../game/constants';
import { MoveOption } from '../../game/movement';
import { GameView } from '../../game/view';
import { ChatMessage, MemberView, RoomView } from '../../game/protocol';
import { Button } from '../ui/Modal';

export function PlayersStrip({ room }: { room: RoomView }) {
  const game = room.game!;
  const member = (id: string): MemberView | undefined => room.members.find((m) => m.id === id);
  const waitingOn = game.turn.stage === 'disprove' ? game.turn.suggestion?.disproverId : null;
  return (
    <div className="flex gap-1.5 overflow-x-auto px-2 py-1.5 bg-[#1f120c] border-b border-[#d4af37]/20">
      {game.players.map((p) => {
        const active = p.id === game.turn.playerId && game.phase === 'playing';
        const m = member(p.id);
        return (
          <div
            key={p.id}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border shrink-0 ${
              active
                ? 'bg-[#3d2012] border-[#d4af37] ring-1 ring-[#d4af37]'
                : waitingOn === p.id
                  ? 'bg-[#2a1a10] border-amber-500/70'
                  : 'bg-[#150d09] border-[#d4af37]/20'
            } ${p.eliminated ? 'opacity-60' : ''}`}
            title={`${p.name} (${p.suspect}) · ${p.cardCount} cards`}
          >
            <span className="w-4 h-4 rounded-full border border-black/40 shrink-0" style={{ backgroundColor: SUSPECT_COLORS[p.suspect] }} />
            <span className={`text-[11px] font-deco max-w-[6rem] truncate ${p.eliminated ? 'line-through text-red-300' : ''}`}>
              {p.id === room.youId ? 'You' : p.name}
            </span>
            <span className="text-[10px] font-mono px-1 rounded bg-[#0d0705] text-[#d4af37]/90">{p.cardCount}</span>
            {m && !m.connected && <WifiOff className="w-3 h-3 text-red-400" aria-label="disconnected" />}
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
      ? `You rolled ${turn.roll![0] + turn.roll![1]}. Pick a glowing square, or enter a room.`
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
  onNotebook,
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
  onNotebook: () => void;
}) {
  const o = room.game!.options;
  const rooms = o.moves.filter((m): m is Extract<MoveOption, { kind: 'room' }> => m.kind === 'room');
  const chosen = o.moves.find((m) => m.key === selected);
  return (
    <div className="w-full rounded-xl bg-[#1a0f0d] border-2 border-[#d4af37]/50 p-2 flex flex-col gap-2 shadow-xl">
      <p className="text-xs sm:text-sm font-serif-vintage text-[#f4e4bc] px-1" aria-live="polite">
        {chosen
          ? chosen.kind === 'room'
            ? `Enter the ${chosen.room}?`
            : `Move ${chosen.path.length} squares here?`
          : statusLine(room)}
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
              className="min-h-10 px-3 rounded-full bg-[#d4af37]/15 border border-[#d4af37] text-[#ffe08a] text-xs font-deco font-bold uppercase tracking-wide flex items-center gap-1.5"
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
      <div className="flex flex-wrap gap-2">
        {o.roll && (
          <Button id="roll" onClick={onRoll} className="flex-1 animate-pulse-glow">
            <Dices className="w-4 h-4" /> Roll dice
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
        <Button variant="secondary" onClick={onNotebook} className="lg:hidden">
          <BookOpen className="w-4 h-4" />
          <span className="sr-only">Notebook</span>
        </Button>
      </div>
    </div>
  );
}

function LogList({ game }: { game: GameView }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [game.log.length]);
  return (
    <div className="space-y-1 text-xs font-serif-vintage">
      {game.log.map((l) => (
        <p
          key={l.id}
          className={`px-2 py-1 rounded ${
            l.kind === 'turn'
              ? 'text-[#d4af37] font-deco font-bold mt-2'
              : l.kind === 'accuse' || l.kind === 'win'
                ? 'bg-[#9b111e]/20 text-red-200'
                : l.kind === 'suggest'
                  ? 'text-emerald-200'
                  : 'text-[#e8d9b5]'
          }`}
        >
          {l.text}
        </p>
      ))}
      <div ref={end} />
    </div>
  );
}

function Chat({ messages, youId, onSend }: { messages: ChatMessage[]; youId: string | null; onSend: (text: string) => void }) {
  const [text, setText] = useState('');
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto space-y-1 text-xs pr-1">
        {messages.length === 0 && <p className="text-[#baa479] italic px-2">No messages yet.</p>}
        {messages.map((m) => (
          <p key={m.id} className="px-2 py-1">
            <span className={`font-bold ${m.memberId === youId ? 'text-[#d4af37]' : 'text-[#f4e4bc]'}`}>{m.name}: </span>
            <span className="text-[#e8d9b5] break-words">{m.text}</span>
          </p>
        ))}
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
          className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-[#251610] border border-[#d4af37]/40 text-sm focus:outline-none focus:border-[#d4af37]"
        />
        <button type="submit" className="px-3 rounded-lg bg-[#d4af37] text-[#1a0f0d]" aria-label="Send">
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}

export function SidePanel({
  room,
  onChat,
  hand,
}: {
  room: RoomView;
  onChat: (text: string) => void;
  hand?: React.ReactNode;
}) {
  const tabs = [...(hand ? (['cards'] as const) : []), 'log', 'chat'] as const;
  const [tab, setTab] = useState<(typeof tabs)[number]>(tabs[0]);
  const [seenChat, setSeenChat] = useState(room.chat.length);
  useEffect(() => {
    if (tab === 'chat') setSeenChat(room.chat.length);
  }, [tab, room.chat.length]);
  const unread = room.chat.length - seenChat;

  return (
    <div className="flex flex-col min-h-0 h-full rounded-xl bg-[#251610] border-2 border-[#d4af37]/40 overflow-hidden">
      <div className="flex border-b border-[#d4af37]/30">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 font-deco text-xs uppercase tracking-wider ${
              tab === t ? 'bg-[#3d2013] text-[#d4af37]' : 'text-[#baa479]'
            }`}
          >
            {t === 'cards' ? 'My cards' : t === 'log' ? 'Case log' : `Chat${unread > 0 && tab !== 'chat' ? ` (${unread})` : ''}`}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-2">
        {tab === 'cards' && hand}
        {tab === 'log' && <LogList game={room.game!} />}
        {tab === 'chat' && <Chat messages={room.chat} youId={room.youId} onSend={onChat} />}
      </div>
    </div>
  );
}
