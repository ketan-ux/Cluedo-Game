import React from 'react';
import { Card } from '../../types/cluedo';
import { CardView } from './CardView';
import { Shield, BookOpen } from 'lucide-react';

interface HandTrayProps {
  hand: Card[];
  onOpenNotebook: () => void;
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

export const HandTray: React.FC<HandTrayProps> = ({
  hand,
  onOpenNotebook,
  orientation = 'horizontal',
  className = '',
}) => {
  if (orientation === 'vertical') {
    return (
      <div
        id="hand-tray-vertical"
        className={`w-full rounded-xl bg-[#251610] border-2 border-[#d4af37]/40 p-3 shadow-xl flex flex-col space-y-3 select-none relative overflow-hidden ${className}`}
      >
        <div className="absolute inset-0 artistic-radial-dots opacity-20 pointer-events-none" />

        <div className="relative z-10 flex items-center justify-between border-b border-[#d4af37]/30 pb-2">
          <div className="flex items-center space-x-2">
            <Shield className="w-4 h-4 text-[#d4af37]" />
            <span className="font-deco font-bold text-[#f4e4bc] uppercase tracking-wider text-xs">
              Confidential Hand
            </span>
          </div>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#1a0f0d] text-[#d4af37] border border-[#d4af37]/40">
            {hand.length} Cards
          </span>
        </div>

        <p className="relative z-10 text-[10px] font-serif-vintage italic text-[#baa479]">
          Your private evidence cards. These are 100% ruled out from the confidential Murder Envelope.
        </p>

        {/* Cards Vertical Stack */}
        <div className="relative z-10 flex-1 overflow-y-auto space-y-2 pr-1 max-h-[calc(100vh-320px)]">
          {hand.length === 0 ? (
            <div className="py-6 text-center text-xs font-serif-vintage text-[#baa479] italic">
              Awaiting case evidence distribution...
            </div>
          ) : (
            hand.map((card) => {
              const typeColor =
                card.type === 'SUSPECT'
                  ? 'border-red-600/70 bg-red-950/40 text-red-200'
                  : card.type === 'WEAPON'
                  ? 'border-amber-600/70 bg-amber-950/40 text-amber-200'
                  : 'border-emerald-600/70 bg-emerald-950/40 text-emerald-200';

              const icon =
                card.type === 'SUSPECT' ? '👤' : card.type === 'WEAPON' ? '🗡️' : '🏛️';

              return (
                <div
                  key={card.id}
                  className={`p-2.5 rounded-lg border flex items-center justify-between shadow-md transition-all hover:scale-[1.02] ${typeColor}`}
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <span className="text-base flex-shrink-0">{icon}</span>
                    <div className="min-w-0">
                      <p className="font-deco font-bold text-xs truncate text-[#f4e4bc]">
                        {card.name}
                      </p>
                      <span className="text-[9px] font-mono tracking-widest uppercase opacity-80">
                        {card.type}
                      </span>
                    </div>
                  </div>
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#1a0f0d]/80 text-[#d4af37] border border-[#d4af37]/30 flex-shrink-0">
                    Ruled Out
                  </span>
                </div>
              );
            })
          )}
        </div>

        <button
          onClick={onOpenNotebook}
          className="relative z-10 w-full py-2 px-3 rounded-lg bg-[#1a0f0d] hover:bg-[#3d2013] text-[#d4af37] hover:text-[#fff2b2] border border-[#d4af37]/40 flex items-center justify-center space-x-2 text-xs font-deco font-bold uppercase tracking-wider transition-all cursor-pointer shadow"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Open Detective Ledger (N)</span>
        </button>
      </div>
    );
  }

  // Default horizontal dock
  return (
    <div
      id="hand-tray"
      className={`w-full max-w-5xl mx-auto rounded-xl bg-[#251610] border-2 border-[#d4af37]/40 p-2.5 sm:p-3 shadow-[0_12px_36px_rgba(0,0,0,0.85)] flex flex-col space-y-1.5 select-none relative overflow-hidden ${className}`}
    >
      {/* Subtle gold radial dot background */}
      <div className="absolute inset-0 artistic-radial-dots opacity-20 pointer-events-none" />

      <div className="relative z-10 flex items-center justify-between px-2 text-xs font-serif-vintage text-[#d4af37]">
        <div className="flex items-center space-x-2">
          <Shield className="w-4 h-4 text-[#d4af37]" />
          <span className="font-deco font-bold text-[#f4e4bc] uppercase tracking-[0.15em] text-xs">
            Confidential Dossier Hand ({hand.length} Cards)
          </span>
          <span className="text-[11px] font-serif-vintage italic text-[#baa479] hidden sm:inline">
            (Excluded from Murder Envelope)
          </span>
        </div>

        <button
          onClick={onOpenNotebook}
          className="text-xs text-[#d4af37] hover:text-[#fff2b2] flex items-center space-x-1.5 cursor-pointer font-bold tracking-wider uppercase font-deco transition-colors px-2.5 py-1 rounded border border-[#d4af37]/30 hover:bg-[#d4af37]/10"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Detective Ledger</span>
        </button>
      </div>

      <div className="relative z-10 flex items-center justify-center gap-2.5 sm:gap-3 overflow-x-auto py-1.5 px-2">
        {hand.length === 0 ? (
          <div className="py-4 text-center text-xs font-serif-vintage text-[#baa479] italic tracking-wide">
            Awaiting case evidence distribution...
          </div>
        ) : (
          hand.map((card, idx) => (
            <div
              key={card.id}
              className="transform hover:-translate-y-2 hover:scale-105 transition-all duration-300 shadow-xl"
              style={{
                transform:
                  hand.length > 1 ? `rotate(${(idx - (hand.length - 1) / 2) * 2}deg)` : undefined,
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
