import React, { useState } from 'react';
import {
  ALL_SUSPECTS,
  ALL_WEAPONS,
  Room,
  SUSPECT_COLORS,
  Suspect,
  Weapon,
} from '../../types/cluedo';
import { CHARACTER_DETAILS, WEAPON_DETAILS } from '../../engine/assets';
import { Sparkles, X, ShieldAlert, ArrowRight } from 'lucide-react';

interface SuggestionModalProps {
  isOpen: boolean;
  currentRoom: Room;
  onSuggest: (suspect: Suspect, weapon: Weapon) => void;
  onPass: () => void;
  onSkipAndEndTurn?: () => void;
}

export const SuggestionModal: React.FC<SuggestionModalProps> = ({
  isOpen,
  currentRoom,
  onSuggest,
  onPass,
  onSkipAndEndTurn,
}) => {
  const [selectedSuspect, setSelectedSuspect] = useState<Suspect>(ALL_SUSPECTS[0]);
  const [selectedWeapon, setSelectedWeapon] = useState<Weapon>(ALL_WEAPONS[0]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in">
      <div
        id="suggestion-modal"
        className="relative w-full max-w-2xl rounded-2xl bg-[#251610] border-2 border-[#d4af37] p-6 shadow-[0_16px_48px_rgba(0,0,0,0.9)] text-[#f4e4bc] flex flex-col space-y-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#d4af37]/30 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-[#d4af37]/20 border border-[#d4af37] flex items-center justify-center text-[#d4af37]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-deco font-bold text-xl text-[#f4e4bc] tracking-wider uppercase">
                FORMULATE A SUGGESTION
              </h3>
              <p className="text-xs text-[#baa479] font-serif-vintage italic">
                Locked Scene of Investigation: <span className="font-bold text-[#d4af37] not-italic">{currentRoom}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onPass}
            className="p-1.5 rounded-lg bg-[#1a0f0d] hover:bg-[#3d2013] text-[#baa479] hover:text-[#f4e4bc] border border-[#d4af37]/30 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1. Locked Room Card */}
        <div className="p-3 rounded-xl bg-[#1a0f0d] border border-[#d4af37]/40 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">🏛️</span>
            <div>
              <span className="text-[10px] font-deco tracking-widest text-[#d4af37] uppercase">Current Room (Fixed)</span>
              <h4 className="font-deco font-bold text-base text-[#f4e4bc]">{currentRoom}</h4>
            </div>
          </div>
          <span className="text-xs font-deco px-2.5 py-1 rounded bg-[#251610] text-[#d4af37] border border-[#d4af37]/40 uppercase tracking-wider">
            Scene of Crime
          </span>
        </div>

        {/* Selectors Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Suspect Selector */}
          <div className="flex flex-col space-y-2">
            <label className="text-xs font-deco uppercase tracking-wider text-[#d4af37] font-bold">
              1. Choose Accused Suspect
            </label>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
              {ALL_SUSPECTS.map((s) => {
                const color = SUSPECT_COLORS[s];
                const isSelected = selectedSuspect === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSelectedSuspect(s)}
                    className={`p-2 rounded-lg border text-left flex items-center space-x-2 transition-all ${
                      isSelected
                        ? 'bg-[#1a0f0d] border-[#d4af37] ring-2 ring-[#d4af37]/60 shadow-[0_0_10px_rgba(212,175,55,0.3)]'
                        : 'bg-[#1a0f0d]/60 border-[#d4af37]/20 hover:border-[#d4af37]/50'
                    }`}
                  >
                    <div
                      className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-[10px] shadow"
                      style={{ backgroundColor: color.hex }}
                    >
                      {s.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate text-[#f4e4bc]">{s}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Weapon Selector */}
          <div className="flex flex-col space-y-2">
            <label className="text-xs font-deco uppercase tracking-wider text-[#d4af37] font-bold">
              2. Choose Murder Weapon
            </label>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
              {ALL_WEAPONS.map((w) => {
                const isSelected = selectedWeapon === w;
                return (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setSelectedWeapon(w)}
                    className={`p-2 rounded-lg border text-left flex items-center space-x-2 transition-all ${
                      isSelected
                        ? 'bg-[#1a0f0d] border-[#d4af37] ring-2 ring-[#d4af37]/60 shadow-[0_0_10px_rgba(212,175,55,0.3)]'
                        : 'bg-[#1a0f0d]/60 border-[#d4af37]/20 hover:border-[#d4af37]/50'
                    }`}
                  >
                    <span className="text-base">🗡️</span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate text-[#f4e4bc]">{w}</p>
                      <p className="text-[9px] text-[#baa479] truncate font-serif-vintage italic">
                        {WEAPON_DETAILS[w].material}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Suggestion Summary Banner */}
        <div className="p-3.5 rounded-xl bg-[#1a0f0d] border border-[#d4af37]/50 text-center">
          <p className="text-xs font-serif-vintage italic text-[#baa479]">Your Formal Theory:</p>
          <p className="font-deco font-bold text-sm sm:text-base text-[#f4e4bc] mt-0.5">
            "I suggest the crime was committed by{' '}
            <span className="text-[#d4af37] underline decoration-[#d4af37]">{selectedSuspect}</span>, with the{' '}
            <span className="text-[#d4af37] underline decoration-[#d4af37]">{selectedWeapon}</span>, in the{' '}
            <span className="text-[#d4af37] underline decoration-[#d4af37]">{currentRoom}</span>."
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onPass}
              className="flex-1 sm:flex-initial px-3.5 py-2.5 rounded bg-[#1a0f0d] hover:bg-[#2d1b10] text-[#baa479] hover:text-[#f4e4bc] border border-[#d4af37]/30 text-xs font-deco uppercase tracking-wider transition-colors cursor-pointer"
              title="Close modal to check notes or accuse later"
            >
              Skip (Keep Turn)
            </button>

            {onSkipAndEndTurn && (
              <button
                type="button"
                onClick={onSkipAndEndTurn}
                className="flex-1 sm:flex-initial px-3.5 py-2.5 rounded bg-[#3b2012] hover:bg-[#5c321d] text-[#f4e4bc] border border-[#d4af37]/40 text-xs font-deco uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center space-x-1"
              >
                <span>Skip & Pass Turn</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#d4af37]" />
              </button>
            )}
          </div>

          <button
            id="submit-suggestion-btn"
            type="button"
            onClick={() => onSuggest(selectedSuspect, selectedWeapon)}
            className="w-full sm:w-auto px-6 py-2.5 rounded bg-[#d4af37] hover:bg-[#b8952e] text-[#1a0f0d] font-deco font-bold text-xs uppercase tracking-widest shadow-xl shadow-[#d4af37]/20 flex items-center justify-center space-x-2 transition-all cursor-pointer"
          >
            <span>Present Suggestion</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
