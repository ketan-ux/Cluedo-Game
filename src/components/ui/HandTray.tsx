import React from 'react';
import { BookOpen, Shield } from 'lucide-react';
import { CardName } from '../../game/constants';
import { CardView } from './CardView';

interface HandTrayProps {
  hand: CardName[];
  onOpenNotebook: () => void;
  className?: string;
}

/** Your own cards. Scrolls sideways on small screens, wraps into a grid on wide ones. */
export function HandTray({ hand, onOpenNotebook, className = '' }: HandTrayProps) {
  return (
    <section className={`rounded-xl bg-[#251610] border-2 border-[#d4af37]/40 p-2.5 shadow-xl flex flex-col gap-2 ${className}`}>
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2 min-w-0">
          <Shield className="w-4 h-4 text-[#d4af37] shrink-0" />
          <h2 className="font-deco font-bold text-[#f4e4bc] uppercase tracking-wider text-xs truncate">
            Your cards ({hand.length})
          </h2>
        </div>
        <button
          type="button"
          onClick={onOpenNotebook}
          className="text-xs text-[#d4af37] hover:text-[#fff2b2] flex items-center gap-1.5 font-bold uppercase font-deco px-2.5 py-1.5 rounded border border-[#d4af37]/40 hover:bg-[#d4af37]/10"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Notebook</span>
        </button>
      </div>
      <div className="flex lg:flex-wrap lg:justify-center gap-2 overflow-x-auto lg:overflow-visible pb-1 px-1 snap-x">
        {hand.map((card) => (
          <div key={card} className="snap-start">
            <CardView card={card} size="sm" />
          </div>
        ))}
      </div>
    </section>
  );
}
