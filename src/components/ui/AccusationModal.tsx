import React, { useState } from 'react';
import {
  ALL_ROOMS,
  ALL_SUSPECTS,
  ALL_WEAPONS,
  Card,
  Room,
  SUSPECT_COLORS,
  Suspect,
  Weapon,
} from '../../types/cluedo';
import { AlertTriangle, X, ShieldCheck, Flame, BookOpen, Shield } from 'lucide-react';

interface AccusationModalProps {
  isOpen: boolean;
  myHand?: Card[];
  prefilledSuspect?: Suspect;
  prefilledWeapon?: Weapon;
  prefilledRoom?: Room;
  onAccuse: (suspect: Suspect, weapon: Weapon, room: Room) => void;
  onClose: () => void;
  onOpenNotebook?: () => void;
}

export const AccusationModal: React.FC<AccusationModalProps> = ({
  isOpen,
  myHand = [],
  prefilledSuspect,
  prefilledWeapon,
  prefilledRoom,
  onAccuse,
  onClose,
  onOpenNotebook,
}) => {
  const [selectedSuspect, setSelectedSuspect] = useState<Suspect>(prefilledSuspect || ALL_SUSPECTS[0]);
  const [selectedWeapon, setSelectedWeapon] = useState<Weapon>(prefilledWeapon || ALL_WEAPONS[0]);
  const [selectedRoom, setSelectedRoom] = useState<Room>(prefilledRoom || ALL_ROOMS[0]);

  React.useEffect(() => {
    if (isOpen) {
      if (prefilledSuspect) setSelectedSuspect(prefilledSuspect);
      if (prefilledWeapon) setSelectedWeapon(prefilledWeapon);
      if (prefilledRoom) setSelectedRoom(prefilledRoom);
    }
  }, [isOpen, prefilledSuspect, prefilledWeapon, prefilledRoom]);

  if (!isOpen) return null;

  const handCardNames = new Set(myHand.map((c) => c.name));

  const hasSelectedCardInHand =
    handCardNames.has(selectedSuspect) ||
    handCardNames.has(selectedWeapon) ||
    handCardNames.has(selectedRoom);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-3 sm:p-4 overflow-y-auto animate-fade-in">
      <div
        id="accusation-modal"
        className="relative w-full max-w-3xl max-h-[95vh] overflow-y-auto rounded-2xl bg-[#251610] border-2 border-[#9b111e] p-4 sm:p-6 shadow-[0_16px_48px_rgba(0,0,0,0.9)] text-[#f4e4bc] flex flex-col space-y-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#9b111e]/40 pb-3">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-full bg-[#9b111e]/20 border border-[#9b111e] flex items-center justify-center text-red-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-deco font-bold text-lg sm:text-xl text-red-200 tracking-wider uppercase">
                MAKE A FINAL ACCUSATION
              </h3>
              <p className="text-xs text-red-300 font-serif-vintage italic">
                High-Stakes Murder Envelope Confrontation
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {onOpenNotebook && (
              <button
                type="button"
                onClick={onOpenNotebook}
                className="px-2.5 py-1.5 rounded-lg bg-[#1a0f0d] hover:bg-[#3d1a10] text-[#d4af37] border border-[#d4af37]/40 text-xs font-mono font-bold flex items-center space-x-1 transition-colors cursor-pointer"
                title="Open Detective Ledger"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Ledger (N)</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-[#1a0f0d] hover:bg-[#3d1a10] text-[#baa479] hover:text-white border border-[#9b111e]/30 transition-colors cursor-pointer"
              title="Close Accusation Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Severe Warning Alert */}
        <div className="p-3 rounded-xl bg-[#1a0f0d] border border-[#9b111e]/80 flex items-start space-x-2.5 text-red-200 text-xs leading-relaxed font-serif-vintage">
          <Flame className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5 not-italic" />
          <div>
            <strong className="text-[#f4e4bc] font-deco font-bold uppercase tracking-wider block mb-0.5">PROCEED WITH UTMOST CAUTION:</strong>
            If your accusation matches the Murder Envelope EXACTLY, you immediately WIN. If even ONE element is incorrect, you will be PERMANENTLY ELIMINATED from taking turns!
          </div>
        </div>

        {/* In-Hand Warning if user selects a card from their own hand */}
        {hasSelectedCardInHand && (
          <div className="p-2.5 rounded-lg bg-amber-950/80 border border-amber-600/60 text-amber-200 text-xs flex items-center space-x-2 font-mono">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>
              <strong>Note:</strong> You hold one or more of these cards in your own hand! Since cards in your hand were excluded from the confidential envelope, this accusation cannot be fully correct.
            </span>
          </div>
        )}

        {/* 3 Selectors (Suspect, Weapon, Room) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* 1. Suspect */}
          <div className="flex flex-col space-y-1.5">
            <label className="text-[11px] font-deco uppercase tracking-wider text-[#d4af37] font-bold">
              1. Accused Suspect
            </label>
            <div className="flex flex-col space-y-1 max-h-44 overflow-y-auto pr-1">
              {ALL_SUSPECTS.map((s) => {
                const isSelected = selectedSuspect === s;
                const color = SUSPECT_COLORS[s];
                const inHand = handCardNames.has(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSelectedSuspect(s)}
                    className={`p-2 rounded-lg border text-left flex items-center space-x-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#9b111e]/30 border-red-500 ring-2 ring-red-500 shadow'
                        : 'bg-[#1a0f0d] border-[#d4af37]/20 hover:border-[#d4af37]/50'
                    }`}
                  >
                    <div
                      className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-[9px]"
                      style={{ backgroundColor: color.hex }}
                    >
                      {s.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-semibold truncate text-[#f4e4bc] block">{s}</span>
                      {inHand && (
                        <span className="text-[9px] font-mono text-amber-400 font-bold block">(In Hand)</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Weapon */}
          <div className="flex flex-col space-y-1.5">
            <label className="text-[11px] font-deco uppercase tracking-wider text-[#d4af37] font-bold">
              2. Murder Weapon
            </label>
            <div className="flex flex-col space-y-1 max-h-44 overflow-y-auto pr-1">
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
                        ? 'bg-[#9b111e]/30 border-red-500 ring-2 ring-red-500 shadow'
                        : 'bg-[#1a0f0d] border-[#d4af37]/20 hover:border-[#d4af37]/50'
                    }`}
                  >
                    <span className="text-sm">🗡️</span>
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-semibold truncate text-[#f4e4bc] block">{w}</span>
                      {inHand && (
                        <span className="text-[9px] font-mono text-amber-400 font-bold block">(In Hand)</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Room */}
          <div className="flex flex-col space-y-1.5">
            <label className="text-[11px] font-deco uppercase tracking-wider text-[#d4af37] font-bold">
              3. Crime Scene Room
            </label>
            <div className="flex flex-col space-y-1 max-h-44 overflow-y-auto pr-1">
              {ALL_ROOMS.map((r) => {
                const isSelected = selectedRoom === r;
                const inHand = handCardNames.has(r);
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setSelectedRoom(r)}
                    className={`p-2 rounded-lg border text-left flex items-center space-x-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#9b111e]/30 border-red-500 ring-2 ring-red-500 shadow'
                        : 'bg-[#1a0f0d] border-[#d4af37]/20 hover:border-[#d4af37]/50'
                    }`}
                  >
                    <span className="text-sm">🏛️</span>
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-semibold truncate text-[#f4e4bc] block">{r}</span>
                      {inHand && (
                        <span className="text-[9px] font-mono text-amber-400 font-bold block">(In Hand)</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Hand Evidence Reference Strip */}
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

        {/* Accusation Statement */}
        <div className="p-3 rounded-xl bg-[#1a0f0d] border border-[#9b111e]/80 text-center">
          <span className="text-[10px] font-deco uppercase tracking-widest text-[#d4af37]">Formal Indictment</span>
          <p className="font-deco font-bold text-xs sm:text-sm text-[#f4e4bc] mt-0.5">
            "I formally accuse{' '}
            <span className="text-red-400 underline">{selectedSuspect}</span> of committing murder in the{' '}
            <span className="text-red-400 underline">{selectedRoom}</span> using the{' '}
            <span className="text-red-400 underline">{selectedWeapon}</span>!"
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded bg-[#1a0f0d] hover:bg-[#3d1a10] text-[#baa479] hover:text-[#f4e4bc] border border-[#d4af37]/30 text-xs font-deco uppercase tracking-wider transition-colors cursor-pointer"
          >
            Cancel Accusation
          </button>

          <button
            id="confirm-accusation-btn"
            type="button"
            onClick={() => onAccuse(selectedSuspect, selectedWeapon, selectedRoom)}
            className="px-5 py-2.5 rounded bg-[#9b111e] hover:bg-red-700 text-white font-deco font-bold text-xs uppercase tracking-widest shadow-xl shadow-red-900/30 flex items-center space-x-2 transition-all cursor-pointer transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Open Murder Envelope & Accuse!</span>
          </button>
        </div>
      </div>
    </div>
  );
};
