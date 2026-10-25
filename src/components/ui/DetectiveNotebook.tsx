import React, { useEffect, useState } from 'react';
import { Check, HelpCircle, Lock, Star, X } from 'lucide-react';
import { CardName, ROOMS, SUSPECTS, WEAPONS } from '../../game/constants';
import { SeenCard } from '../../game/engine';
import { PublicPlayer } from '../../game/view';
import { readLocal, writeLocal } from '../../net/session';
import { sounds } from '../../utils/audio';
import { Avatar } from '../art/Portraits';

type Mark = '' | 'has' | 'not' | 'maybe';

const NEXT: Record<Mark, Mark> = { '': 'has', has: 'not', not: 'maybe', maybe: '' };

const SECTIONS: Array<{ title: string; cards: readonly CardName[] }> = [
  { title: 'Who?', cards: SUSPECTS },
  { title: 'What?', cards: WEAPONS },
  { title: 'Where?', cards: ROOMS },
];

/** Your pencil marks and jottings for one game, kept on this device. */
export function useNotebook(roomCode: string, myId: string) {
  const key = `cluedo.notebook.${roomCode}.${myId}`;
  const [marks, setMarks] = useState<Record<string, Mark>>(() => readLocal(key, {}));
  const [memo, setMemo] = useState<string>(() => readLocal(`${key}.memo`, ''));
  useEffect(() => {
    writeLocal(key, marks);
  }, [key, marks]);
  useEffect(() => {
    writeLocal(`${key}.memo`, memo);
  }, [key, memo]);
  return {
    marks,
    memo,
    setMemo,
    cycle(k: string) {
      sounds.playPencilMark();
      setMarks((m) => ({ ...m, [k]: NEXT[m[k] ?? ''] }));
    },
  };
}

export type Notebook = ReturnType<typeof useNotebook>;

function MarkIcon({ mark, small }: { mark: Mark; small: boolean }) {
  const size = small ? 'w-3.5 h-3.5' : 'w-4 h-4';
  if (mark === 'has') return <Check className={`${size} text-emerald-800 stroke-[3.5]`} />;
  if (mark === 'not') return <X className={`${size} text-[var(--crimson)] stroke-[3.5]`} />;
  if (mark === 'maybe') return <HelpCircle className={`${size} text-amber-700 stroke-[2.5]`} />;
  return null;
}

interface NotesProps {
  notebook: Notebook;
  myId: string;
  hand: CardName[];
  seen: SeenCard[];
  players: PublicPlayer[];
  /** Smaller boxes, for the desktop column. */
  compact?: boolean;
  /** Leave the heading off when the sheet around it already has one. */
  titled?: boolean;
}

/** The detective's scoresheet. Facts you know for certain are filled in and locked. */
export function DetectiveNotes({ notebook, myId, hand, seen, players, compact = false, titled = true }: NotesProps) {
  const known = (card: CardName, playerId: string): Mark | null => {
    if (playerId === myId) return hand.includes(card) ? 'has' : 'not';
    if (seen.some((s) => s.card === card && s.fromId === playerId)) return 'has';
    if (hand.includes(card) || seen.some((s) => s.card === card)) return 'not';
    return null;
  };
  const markFor = (card: CardName, playerId: string): Mark => known(card, playerId) ?? notebook.marks[`${card}|${playerId}`] ?? '';
  const cleared = (card: CardName) => players.some((p) => markFor(card, p.id) === 'has');
  const box = compact ? 'w-6 h-6' : 'w-8 h-8';

  return (
    <div className="parchment rounded-xl shadow-inner font-typewriter text-[#2d1b10] p-2 sm:p-3 space-y-3">
      <div className="text-center">
        {titled && <div className="font-deco font-black tracking-[0.3em] text-[var(--crimson)] text-sm">DETECTIVE NOTES</div>}
        <div className="text-[11px] font-serif-vintage italic text-[#6b4b33]">Tap a box: ✓ has it · ✗ hasn’t · ? maybe. Locked boxes are certain.</div>
      </div>
      {SECTIONS.map((section) => {
        const open = section.cards.filter((c) => !cleared(c));
        const solved = open.length === 1 ? open[0] : null;
        return (
          <table key={section.title} className="w-full border-collapse table-fixed">
            <colgroup>
              <col />
              {players.map((p) => (
                <col key={p.id} className={compact ? 'w-7' : 'w-10'} />
              ))}
            </colgroup>
            <thead>
              <tr className="border-b-2 border-[#2d1b10]">
                <th className="text-left font-deco font-black text-[13px] tracking-[0.2em] pb-1 pl-1">{section.title.toUpperCase()}</th>
                {players.map((p) => (
                  <th key={p.id} className="pb-1 px-0.5 font-normal" title={p.id === myId ? 'You' : p.name}>
                    <Avatar suspect={p.suspect} size={compact ? 20 : 26} className="mx-auto block" />
                    <span className="sr-only">{p.id === myId ? 'You' : p.name}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.cards.map((card) => (
                <tr key={card} className={`border-b border-[#8a6e4d]/35 ${solved === card ? 'bg-[var(--gold)]/35' : ''}`}>
                  <td className={`pl-1 pr-1 ${compact ? 'text-[12px]' : 'text-[14px]'} leading-tight ${cleared(card) ? 'line-through decoration-2 decoration-[#7a5a3a] opacity-50' : 'font-bold'}`}>
                    <span className="flex items-center gap-1">
                      {solved === card && <Star className="w-3.5 h-3.5 shrink-0 fill-[var(--crimson)] text-[var(--crimson)]" aria-label="must be in the envelope" />}
                      {card}
                    </span>
                  </td>
                  {players.map((p) => {
                    const locked = known(card, p.id) !== null;
                    return (
                      <td key={p.id} className="py-0.5 px-0.5 text-center">
                        <button
                          type="button"
                          onClick={() => !locked && notebook.cycle(`${card}|${p.id}`)}
                          disabled={locked}
                          className={`relative ${box} mx-auto rounded-[4px] border flex items-center justify-center ${
                            locked ? 'bg-[#d9c79e]/70 border-[#8a6e4d]/30 cursor-default' : 'bg-[#fffaf0] border-[#8a6e4d]/60 active:scale-90'
                          }`}
                          aria-label={`${card}, ${p.id === myId ? 'you' : p.name}: ${markFor(card, p.id) || 'blank'}`}
                        >
                          <MarkIcon mark={markFor(card, p.id)} small={compact} />
                          {locked && <Lock className="absolute -top-1 -right-1 w-2.5 h-2.5 text-[#7a5a3a]" />}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        );
      })}
      <label className="block">
        <span className="font-deco font-black text-[13px] tracking-[0.2em]">NOTES</span>
        <textarea
          value={notebook.memo}
          onChange={(e) => notebook.setMemo(e.target.value)}
          rows={compact ? 3 : 4}
          placeholder="Who asked about what, hunches, suspicions…"
          className="mt-1 w-full resize-y rounded-md bg-[repeating-linear-gradient(transparent_0_1.45rem,rgba(138,110,77,0.35)_1.45rem_1.5rem)] bg-transparent leading-[1.5rem] px-1 text-[14px] focus:outline-none placeholder:text-[#8a6e4d]/70"
        />
      </label>
    </div>
  );
}
