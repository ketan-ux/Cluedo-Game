import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Shield } from 'lucide-react';
import { SuggestionRecord } from '../../game/engine';
import { PublicPlayer } from '../../game/view';

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
    <div className="absolute left-1/2 top-[52%] -translate-x-1/2 -translate-y-1/2 z-20 flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-[#1b100a]/90 border border-[#d4af37]/70 shadow-lg pointer-events-none">
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

/** What is being suggested right now, who could not disprove it, and who is about to. */
export function SuggestionBanner({ suggestion, players }: { suggestion: SuggestionRecord | null; players: PublicPlayer[] }) {
  const [collapsed, setCollapsed] = useState(false);
  const key = suggestion ? `${suggestion.turn}-${suggestion.suspect}-${suggestion.weapon}` : '';
  useEffect(() => {
    setCollapsed(false);
  }, [key]);
  if (!suggestion) return null;

  const name = (id: string | null) => players.find((p) => p.id === id)?.name ?? 'Someone';
  const status = suggestion.disproverId
    ? `Waiting for ${name(suggestion.disproverId)} to show a card…`
    : suggestion.shownById
      ? `${name(suggestion.shownById)} showed ${name(suggestion.suggesterId)} a card.`
      : 'No one could disprove it!';

  return (
    <div className="absolute top-2 left-2 right-2 sm:right-auto sm:max-w-sm z-20">
      <div className="rounded-xl border-2 border-[#d4af37] bg-[#1a0e08]/95 backdrop-blur shadow-xl text-[#f4ecd8] overflow-hidden">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="w-full flex items-center justify-between gap-2 px-3 py-1.5 bg-[#251610] text-left"
        >
          <span className="font-deco font-bold text-[11px] uppercase tracking-wider text-[#d4af37] truncate">
            {name(suggestion.suggesterId)} suggests
          </span>
          {collapsed ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronUp className="w-4 h-4 shrink-0" />}
        </button>
        {!collapsed && (
          <div className="px-3 py-2 space-y-1.5 text-xs">
            <p className="font-deco">
              {suggestion.suspect} · {suggestion.weapon} · {suggestion.room}
            </p>
            {suggestion.passedIds.length > 0 && (
              <p className="text-[#baa479]">Couldn't disprove: {suggestion.passedIds.map(name).join(', ')}</p>
            )}
            <p className="flex items-center gap-1.5 text-amber-200">
              <Shield className="w-3.5 h-3.5 shrink-0" />
              {status}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export interface Toast {
  id: number;
  text: string;
}

export function Toasts({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="fixed bottom-24 lg:bottom-auto lg:top-14 left-1/2 -translate-x-1/2 z-[60] flex flex-col items-center gap-1.5 pointer-events-none w-[min(92vw,26rem)]">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="px-3 py-2 rounded-lg bg-[#1a0e08]/95 border border-[#d4af37]/70 text-[#f4e4bc] text-xs font-serif-vintage shadow-xl animate-fade-in text-center"
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
