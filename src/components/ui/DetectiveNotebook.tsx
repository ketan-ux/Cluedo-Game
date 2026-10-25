import React, { useEffect, useState } from 'react';
import { BookOpen, Check, HelpCircle, Lock, X, XCircle } from 'lucide-react';
import { CardName, ROOMS, SUSPECTS, WEAPONS } from '../../game/constants';
import { SeenCard } from '../../game/engine';
import { PublicPlayer } from '../../game/view';
import { readLocal, writeLocal } from '../../net/session';
import { sounds } from '../../utils/audio';

type Mark = '' | 'has' | 'not' | 'maybe';

interface NotebookProps {
  open: boolean;
  onClose: () => void;
  roomCode: string;
  myId: string;
  hand: CardName[];
  seen: SeenCard[];
  players: PublicPlayer[];
}

const NEXT: Record<Mark, Mark> = { '': 'has', has: 'not', not: 'maybe', maybe: '' };

const SECTIONS: Array<{ title: string; cards: readonly CardName[] }> = [
  { title: 'Who?', cards: SUSPECTS },
  { title: 'What?', cards: WEAPONS },
  { title: 'Where?', cards: ROOMS },
];

function MarkIcon({ mark }: { mark: Mark }) {
  if (mark === 'has') return <Check className="w-4 h-4 text-emerald-800 stroke-[3]" />;
  if (mark === 'not') return <X className="w-4 h-4 text-red-800 stroke-[3]" />;
  if (mark === 'maybe') return <HelpCircle className="w-4 h-4 text-amber-700" />;
  return null;
}

/** A detective's scoresheet. Facts you know for certain are filled in and locked. */
export function DetectiveNotebook({ open, onClose, roomCode, myId, hand, seen, players }: NotebookProps) {
  const key = `cluedo.notebook.${roomCode}.${myId}`;
  const [marks, setMarks] = useState<Record<string, Mark>>(() => readLocal(key, {}));
  const [notes, setNotes] = useState<Record<string, string>>(() => readLocal(`${key}.notes`, {}));

  useEffect(() => {
    writeLocal(key, marks);
  }, [key, marks]);
  useEffect(() => {
    writeLocal(`${key}.notes`, notes);
  }, [key, notes]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const known = (card: CardName, playerId: string): Mark | null => {
    if (playerId === myId) return hand.includes(card) ? 'has' : 'not';
    if (seen.some((s) => s.card === card && s.fromId === playerId)) return 'has';
    if (hand.includes(card) || seen.some((s) => s.card === card)) return 'not';
    return null;
  };
  const markFor = (card: CardName, playerId: string): Mark => known(card, playerId) ?? marks[`${card}|${playerId}`] ?? '';
  const cleared = (card: CardName) => players.some((p) => markFor(card, p.id) === 'has');

  const cycle = (card: CardName, playerId: string) => {
    if (known(card, playerId)) return;
    sounds.playPencilMark();
    const k = `${card}|${playerId}`;
    setMarks((m) => ({ ...m, [k]: NEXT[m[k] ?? ''] }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Detective notebook"
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-4xl h-[92dvh] sm:h-auto sm:max-h-[90vh] flex flex-col rounded-t-2xl sm:rounded-xl overflow-hidden shadow-2xl border-4 border-[#5a381e] parchment-texture text-[#2b1f17]"
      >
        <header className="bg-[#24130b] text-[#f4ecd8] px-4 py-3 border-b-2 border-[#d4af37] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-[#d4af37]" />
            <div>
              <h2 className="font-deco font-bold tracking-wider text-[#fff4d1]">Detective Notebook</h2>
              <p className="text-[11px] text-[#baa479]">Tap a box: ✓ has it · ✗ doesn't · ? maybe. Locked boxes are certain.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#3a2012]" aria-label="Close notebook">
            <XCircle className="w-6 h-6" />
          </button>
        </header>

        <div className="flex-1 overflow-auto p-2 sm:p-4 space-y-4 font-typewriter">
          {SECTIONS.map((section) => (
            <table key={section.title} className="w-full border-collapse text-xs bg-[#faf6eb]/80 rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-[#4a2e18] text-[#f4ecd8]">
                  <th className="sticky left-0 bg-[#4a2e18] p-2 text-left font-deco text-sm min-w-[8.5rem]">{section.title}</th>
                  {players.map((p) => (
                    <th key={p.id} className="p-1.5 font-normal min-w-[3.25rem]">
                      <div className="truncate max-w-[4.5rem] mx-auto font-bold">{p.id === myId ? 'You' : p.name}</div>
                    </th>
                  ))}
                  <th className="p-2 text-left font-normal min-w-[8rem]">Notes</th>
                </tr>
              </thead>
              <tbody>
                {section.cards.map((card) => (
                  <tr key={card} className="border-b border-[#c8b38b]/60">
                    <td className={`sticky left-0 bg-[#f3ead4] p-2 font-semibold ${cleared(card) ? 'line-through opacity-50' : ''}`}>
                      {card}
                    </td>
                    {players.map((p) => {
                      const locked = known(card, p.id) !== null;
                      return (
                        <td key={p.id} className="p-1 text-center">
                          <button
                            type="button"
                            onClick={() => cycle(card, p.id)}
                            className={`relative w-8 h-8 mx-auto border rounded flex items-center justify-center ${
                              locked ? 'bg-[#e9dcc0] border-[#8a6e4d]/30' : 'bg-[#fffdf7] border-[#8a6e4d]/50 hover:bg-[#f3e6c4]'
                            }`}
                            aria-label={`${card}, ${p.name}`}
                          >
                            <MarkIcon mark={markFor(card, p.id)} />
                            {locked && <Lock className="absolute -top-1 -right-1 w-2.5 h-2.5 text-[#8a6e4d]" />}
                          </button>
                        </td>
                      );
                    })}
                    <td className="p-1">
                      <input
                        value={notes[card] ?? ''}
                        onChange={(e) => setNotes((n) => ({ ...n, [card]: e.target.value }))}
                        placeholder="…"
                        className="w-full px-2 py-1 bg-transparent border-b border-dashed border-[#8a6e4d]/40 focus:outline-none focus:border-[#4a2e18]"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        </div>
      </div>
    </div>
  );
}
