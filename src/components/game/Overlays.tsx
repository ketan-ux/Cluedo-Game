import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Shield } from 'lucide-react';
import { SuggestionRecord } from '../../game/engine';
import { GameView, PublicPlayer } from '../../game/view';
import { Avatar } from '../art/Portraits';

function Pips({ value }: { value: number }) {
  const spots: Record<number, Array<[number, number]>> = {
    1: [[1, 1]],
    2: [[0, 0], [2, 2]],
    3: [[0, 0], [1, 1], [2, 2]],
    4: [[0, 0], [2, 0], [0, 2], [2, 2]],
    5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
    6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
  };
  return (
    <svg viewBox="0 0 3 3" className="w-full h-full">
      {spots[value]?.map(([x, y]) => (
        <circle key={`${x}${y}`} cx={x * 0.85 + 0.65} cy={y * 0.85 + 0.65} r={0.3} fill={value === 1 ? '#9b111e' : '#20120b'} />
      ))}
    </svg>
  );
}

export function DiceBadge({ roll, rolling }: { roll: [number, number] | null; rolling: boolean }) {
  if (!roll) return null;
  return (
    // Sits on the central staircase, where it covers nothing.
    <div className="absolute left-1/2 top-[52%] -translate-x-1/2 -translate-y-1/2 z-20 flex items-center gap-1.5 px-2 py-1.5 rounded-xl panel pointer-events-none">
      {roll.map((v, i) => (
        <div
          key={i}
          className={`w-6 h-6 sm:w-7 sm:h-7 rounded-md bg-gradient-to-br from-[#fffdf5] to-[#e4cead] border border-[#d4af37] p-0.5 ${rolling ? 'animate-dice' : ''}`}
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <Pips value={v} />
        </div>
      ))}
      <span className="font-deco font-black text-sm text-[#d4af37] pr-1">{roll[0] + roll[1]}</span>
    </div>
  );
}

/** What is being suggested right now and where it stands, in two short lines. Tap for who passed. */
export function SuggestionBanner({ suggestion, players }: { suggestion: SuggestionRecord | null; players: PublicPlayer[] }) {
  const [open, setOpen] = useState(false);
  const key = suggestion ? `${suggestion.turn}-${suggestion.suspect}-${suggestion.weapon}` : '';
  useEffect(() => {
    setOpen(false);
  }, [key]);
  if (!suggestion) return null;

  const name = (id: string | null) => players.find((p) => p.id === id)?.name ?? 'Someone';
  const suggester = players.find((p) => p.id === suggestion.suggesterId);
  const status = suggestion.disproverId
    ? `Waiting for ${name(suggestion.disproverId)} to show a card…`
    : suggestion.shownById
      ? `${name(suggestion.shownById)} showed ${name(suggestion.suggesterId)} a card.`
      : 'No one could disprove it!';

  return (
    <div className="absolute top-2 left-2 right-2 sm:right-auto sm:max-w-sm z-20">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full text-left rounded-2xl panel !border-[var(--gold)] bg-opacity-90 backdrop-blur text-[var(--parchment)] pl-1.5 pr-3 py-1.5 flex items-start gap-2"
      >
        {suggester && <Avatar suspect={suggester.suspect} size={34} className="mt-0.5" />}
        <span className="min-w-0 flex-1 space-y-0.5">
        <span className="flex items-center justify-between gap-2">
          <span className="text-[13px] truncate">
            <span className="font-deco font-bold text-[var(--gold-light)]">{name(suggestion.suggesterId)}:</span>{' '}
            {suggestion.suspect} · {suggestion.weapon} · {suggestion.room}
          </span>
          {open ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
        </span>
        <span className="flex items-center gap-1.5 text-[12px] text-amber-200">
          <Shield className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{status}</span>
        </span>
        {open && (
          <span className="block text-[12px] text-[var(--muted)] pt-0.5">
            {suggestion.passedIds.length ? `Couldn't disprove: ${suggestion.passedIds.map(name).join(', ')}` : 'Nobody passed.'}
          </span>
        )}
        </span>
      </button>
    </div>
  );
}

export interface Toast {
  id: number;
  text: string;
}

/** Sits at the foot of the board, so it never covers the controls. */
export function Toasts({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1.5 pointer-events-none w-[min(92%,26rem)]">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="px-3.5 py-2 rounded-xl panel text-[var(--parchment)] text-sm font-serif-vintage animate-fade-in text-center"
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}

/** Announces whose turn it is, then fades away by itself. */
export function TurnBanner({ game, youId }: { game: GameView; youId: string | null }) {
  if (game.phase !== 'playing') return null;
  const p = game.players.find((x) => x.id === game.turn.playerId);
  if (!p) return null;
  const mine = p.id === youId;
  return (
    <div key={game.turn.number} className="absolute inset-x-0 top-[34%] z-30 flex justify-center pointer-events-none px-4" aria-hidden="true">
      <div className="animate-banner panel gold-frame rounded-2xl pl-2 pr-5 py-2 flex items-center gap-3">
        <Avatar suspect={p.suspect} size={52} ring="turn" />
        <div className="leading-tight">
          <div className="font-deco font-black text-xl uppercase tracking-[0.12em] text-gold-gradient">{mine ? 'Your turn' : `${p.name}'s turn`}</div>
          <div className="text-sm italic text-[var(--muted)]">
            {p.suspect} · turn {game.turn.number}
          </div>
        </div>
      </div>
    </div>
  );
}
