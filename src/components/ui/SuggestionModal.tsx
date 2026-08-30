import React, { useState } from 'react';
import {
  ALL_SUSPECTS,
  ALL_WEAPONS,
  Card,
  Room,
  SUSPECT_COLORS,
  Suspect,
  Weapon,
} from '../../types/cluedo';
import { WEAPON_DETAILS } from '../../engine/assets';
import { Sparkles, X, ArrowRight, BookOpen, Shield } from 'lucide-react';

interface SuggestionModalProps {
  isOpen: boolean;
  currentRoom: Room;
  myHand?: Card[];
  onSuggest: (suspect: Suspect, weapon: Weapon) => void;
  onPass: () => void;
  onSkipAndEndTurn?: () => void;
  onOpenNotebook?: () => void;
}

export const SuggestionModal: React.FC<SuggestionModalProps> = ({
  isOpen,
  currentRoom,
  myHand = [],
  onSuggest,
  onPass,
  onSkipAndEndTurn,
  onOpenNotebook,
}) => {
  const [selectedSuspect, setSelectedSuspect] = useState<Suspect>(ALL_SUSPECTS[0]);
  const [selectedWeapon, setSelectedWeapon] = useState<Weapon>(ALL_WEAPONS[0]);

  if (!isOpen) return null;

  const handCardNames = new Set(myHand.map((c) => c.name));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 overflow-y-auto animate-fade-in">
      <div
        id="suggestion-modal"
        className="relative w-full max-w-2xl max-h-[95vh] overflow-y-auto rounded-2xl bg-[#251610] border-2 border-[#d4af37] p-4 sm:p-6 shadow-[0_16px_48px_rgba(0,0,0,0.9)] text-[#f4e4bc] flex flex-col space-y-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#d4af37]/30 pb-3">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-full bg-[#d4af37]/20 border border-[#d4af37] flex items-center justify-center text-[#d4af37]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-deco font-bold text-lg sm:text-xl text-[#f4e4bc] tracking-wider uppercase">
                FORMULATE A SUGGESTION
              </h3>
              <p className="text-xs text-[#baa479] font-serif-vintage italic">
                Locked Scene of Investigation: <span className="font-bold text-[#d4af37] not-italic">{currentRoom}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {onOpenNotebook && (
              <button
                type="button"
                onClick={onOpenNotebook}
                className="px-2.5 py-1.5 rounded-lg bg-[#1a0f0d] hover:bg-[#3d2013] text-[#d4af37] border border-[#d4af37]/40 text-xs font-mono font-bold flex items-center space-x-1 transition-colors cursor-pointer"
                title="Open Detective Ledger"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Ledger (N)</span>
              </button>
            )}
            <button
              onClick={onPass}
              className="p-1.5 rounded-lg bg-[#1a0f0d] hover:bg-[#3d2013] text-[#baa479] hover:text-[#f4e4bc] border border-[#d4af37]/30 transition-colors cursor-pointer"
              title="Close modal (you can reopen it anytime while in this room)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 1. Locked Room Card */}
        <div className="p-2.5 rounded-xl bg-[#1a0f0d] border border-[#d4af37]/40 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <span className="text-xl">🏛️</span>
            <div>
              <span className="text-[9px] font-deco tracking-widest text-[#d4af37] uppercase">Current Room (Fixed)</span>
              <h4 className="font-deco font-bold text-sm sm:text-base text-[#f4e4bc] flex items-center space-x-2">
                <span>{currentRoom}</span>
                {handCardNames.has(currentRoom) && (
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-950/80 text-amber-300 border border-amber-600/50">
                    In Your Hand
                  </span>
                )}
              </h4>
            </div>
          </div>
          <span className="text-[10px] font-deco px-2 py-0.5 rounded bg-[#251610] text-[#d4af37] border border-[#d4af37]/40 uppercase tracking-wider">
            Crime Scene
          </span>
        </div>

        {/* Selectors Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Suspect Selector */}
          <div className="flex flex-col space-y-1.5">
            <label className="text-xs font-deco uppercase tracking-wider text-[#d4af37] font-bold flex items-center justify-between">
              <span>1. Choose Accused Suspect</span>
            </label>
            <div className="grid grid-cols-2 gap-1.5 max-h-44 overflow-y-auto pr-1">
              {ALL_SUSPECTS.map((s) => {
                const color = SUSPECT_COLORS[s];
                const isSelected = selectedSuspect === s;
                const inHand = handCardNames.has(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSelectedSuspect(s)}
                    className={`p-2 rounded-lg border text-left flex items-center space-x-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#1a0f0d] border-[#d4af37] ring-2 ring-[#d4af37]/60 shadow-[0_0_10px_rgba(212,175,55,0.3)]'
                        : 'bg-[#1a0f0d]/60 border-[#d4af37]/20 hover:border-[#d4af37]/50'
                    }`}
                  >
                    <div
                      className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-[9px] shadow"
                      style={{ backgroundColor: color.hex }}
                    >
                      {s.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate text-[#f4e4bc]">{s}</p>
                      {inHand && (
                        <span className="text-[9px] font-mono text-amber-400 font-bold block leading-tight">
                          (In Hand)
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Weapon Selector */}
          <div className="flex flex-col space-y-1.5">
            <label className="text-xs font-deco uppercase tracking-wider text-[#d4af37] font-bold flex items-center justify-between">
              <span>2. Choose Murder Weapon</span>
            </label>
            <div className="grid grid-cols-2 gap-1.5 max-h-44 overflow-y-auto pr-1">
              {ALL_WEAPONS.map((w) => {
                const isSelected = selectedWeapon === w;
                const inHand = handCardNames.has(w);
                return (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setSelectedWeapon(w)}
                    className={`p-2 rounded-lg border text-left flex items-center space-x-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#1a0f0d] border-[#d4af37] ring-2 ring-[#d4af37]/60 shadow-[0_0_10px_rgba(212,175,55,0.3)]'
                        : 'bg-[#1a0f0d]/60 border-[#d4af37]/20 hover:border-[#d4af37]/50'
                    }`}
                  >
                    <span className="text-sm">🗡️</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate text-[#f4e4bc]">{w}</p>
                      <p className="text-[9px] text-[#baa479] truncate font-serif-vintage italic">
                        {inHand ? (
                          <span className="text-amber-400 font-mono font-bold not-italic">(In Hand)</span>
                        ) : (
                          WEAPON_DETAILS[w].material
                        )}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Hand Cards Quick Reference Bar */}
        {myHand.length > 0 && (
          <div className="p-2.5 rounded-xl bg-[#170c08] border border-[#d4af37]/30 flex flex-col space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-mono text-[#baa479]">
              <span className="flex items-center space-x-1.5 text-[#d4af37] font-bold">
                <Shield className="w-3.5 h-3.5" />
                <span>Your Hand Evidence ({myHand.length} Cards):</span>
              </span>
              <span className="text-[10px] text-[#baa479]/80 italic">Cannot be in the murder envelope</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {myHand.map((c) => (
                <span
                  key={c.id}
                  className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                    c.type === 'SUSPECT'
                      ? 'bg-red-950/60 text-red-200 border-red-800/60'
                      : c.type === 'WEAPON'
                      ? 'bg-amber-950/60 text-amber-200 border-amber-800/60'
                      : 'bg-emerald-950/60 text-emerald-200 border-emerald-800/60'
                  }`}
                >
                  {c.type === 'SUSPECT' ? '👤 ' : c.type === 'WEAPON' ? '🗡️ ' : '🏛️ '}
                  {c.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Suggestion Summary Banner */}
        <div className="p-3 rounded-xl bg-[#1a0f0d] border border-[#d4af37]/50 text-center">
          <p className="text-[11px] font-serif-vintage italic text-[#baa479]">Your Formal Theory:</p>
          <p className="font-deco font-bold text-xs sm:text-sm text-[#f4e4bc] mt-0.5">
            "I suggest the crime was committed by{' '}
            <span className="text-[#d4af37] underline decoration-[#d4af37]">{selectedSuspect}</span>, with the{' '}
            <span className="text-[#d4af37] underline decoration-[#d4af37]">{selectedWeapon}</span>, in the{' '}
            <span className="text-[#d4af37] underline decoration-[#d4af37]">{currentRoom}</span>."
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-1">
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onPass}
              className="flex-1 sm:flex-initial px-3 py-2 rounded bg-[#1a0f0d] hover:bg-[#2d1b10] text-[#baa479] hover:text-[#f4e4bc] border border-[#d4af37]/30 text-xs font-deco uppercase tracking-wider transition-colors cursor-pointer"
              title="Close modal to inspect board/cards (you can reopen it anytime)"
            >
              View Board / Cards
            </button>

            {onSkipAndEndTurn && (
              <button
                type="button"
                onClick={onSkipAndEndTurn}
                className="flex-1 sm:flex-initial px-3 py-2 rounded bg-[#3b2012] hover:bg-[#5c321d] text-[#f4e4bc] border border-[#d4af37]/40 text-xs font-deco uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center space-x-1"
              >
                <span>Pass Turn</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#d4af37]" />
              </button>
            )}
          </div>

          <button
            id="submit-suggestion-btn"
            type="button"
            onClick={() => onSuggest(selectedSuspect, selectedWeapon)}
            className="w-full sm:w-auto px-5 py-2.5 rounded bg-[#d4af37] hover:bg-[#b8952e] text-[#1a0f0d] font-deco font-bold text-xs uppercase tracking-widest shadow-xl shadow-[#d4af37]/20 flex items-center justify-center space-x-2 transition-all cursor-pointer transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <span>Present Suggestion</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
