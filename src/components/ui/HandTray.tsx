import React from 'react';
import { Card } from '../../types/cluedo';
import { CardView } from './CardView';
import { Shield, BookOpen } from 'lucide-react';

interface HandTrayProps {
  hand: Card[];
  onOpenNotebook: () => void;
}

export const HandTray: React.FC<HandTrayProps> = ({ hand, onOpenNotebook }) => {
  return (
    <div
      id="hand-tray"
      className="w-full max-w-5xl mx-auto rounded-xl bg-[#251610] border-2 border-[#d4af37]/40 p-3 shadow-[0_12px_36px_rgba(0,0,0,0.85)] flex flex-col space-y-2 select-none relative overflow-hidden"
    >
      {/* Subtle gold radial dot background */}
      <div className="absolute inset-0 artistic-radial-dots opacity-20 pointer-events-none" />

      <div className="relative z-10 flex items-center justify-between px-2 text-xs font-serif-vintage text-[#d4af37]">
        <div className="flex items-center space-x-2">
          <Shield className="w-4 h-4 text-[#d4af37]" />
          <span className="font-deco font-bold text-[#f4e4bc] uppercase tracking-[0.15em] text-xs">
            Confidential Dossier Hand ({hand.length} Cards)
          </span>
          <span className="text-[11px] font-serif-vintage italic text-[#baa479] hidden sm:inline">(Excluded from Murder Envelope)</span>
        </div>

        <button
          onClick={onOpenNotebook}
          className="text-xs text-[#d4af37] hover:text-[#fff2b2] flex items-center space-x-1.5 cursor-pointer font-bold tracking-wider uppercase font-deco transition-colors px-2.5 py-1 rounded border border-[#d4af37]/30 hover:bg-[#d4af37]/10"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Detective Ledger</span>
        </button>
      </div>

      <div className="relative z-10 flex items-center justify-center gap-3 overflow-x-auto py-2 px-2">
        {hand.length === 0 ? (
          <div className="py-5 text-center text-xs font-serif-vintage text-[#baa479] italic tracking-wide">
            Awaiting case evidence distribution...
          </div>
        ) : (
          hand.map((card, idx) => (
            <div
              key={card.id}
              className="transform hover:-translate-y-3 hover:scale-105 transition-all duration-300 shadow-xl"
              style={{
                transform: hand.length > 1 ? `rotate(${(idx - (hand.length - 1) / 2) * 2}deg)` : undefined
              }}
            >
              <CardView card={card} size="sm" />
            </div>
          ))
        )}
      </div>
    </div>
  );
};

