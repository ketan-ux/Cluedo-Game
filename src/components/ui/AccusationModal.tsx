import React, { useState } from 'react';
import {
  ALL_ROOMS,
  ALL_SUSPECTS,
  ALL_WEAPONS,
  Room,
  SUSPECT_COLORS,
  Suspect,
  Weapon,
} from '../../types/cluedo';
import { AlertTriangle, X, ShieldCheck, Flame } from 'lucide-react';
import { ROOM_DEFINITIONS } from '../../engine/boardGrid';

interface AccusationModalProps {
  isOpen: boolean;
  onAccuse: (suspect: Suspect, weapon: Weapon, room: Room) => void;
  onClose: () => void;
}

export const AccusationModal: React.FC<AccusationModalProps> = ({
  isOpen,
  onAccuse,
  onClose,
}) => {
  const [selectedSuspect, setSelectedSuspect] = useState<Suspect>(ALL_SUSPECTS[0]);
  const [selectedWeapon, setSelectedWeapon] = useState<Weapon>(ALL_WEAPONS[0]);
  const [selectedRoom, setSelectedRoom] = useState<Room>(ALL_ROOMS[0]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in">
      <div
        id="accusation-modal"
        className="relative w-full max-w-3xl rounded-2xl bg-[#251610] border-2 border-[#9b111e] p-6 shadow-[0_16px_48px_rgba(0,0,0,0.9)] text-[#f4e4bc] flex flex-col space-y-5"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#9b111e]/40 pb-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-[#9b111e]/20 border border-[#9b111e] flex items-center justify-center text-red-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-deco font-bold text-xl text-red-200 tracking-wider uppercase">
                MAKE A FINAL ACCUSATION
              </h3>
              <p className="text-xs text-red-300 font-serif-vintage italic">
                High-Stakes Murder Envelope Confrontation
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#1a0f0d] hover:bg-[#3d1a10] text-[#baa479] hover:text-white border border-[#9b111e]/30 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Severe Warning Alert */}
        <div className="p-3.5 rounded-xl bg-[#1a0f0d] border border-[#9b111e]/80 flex items-start space-x-3 text-red-200 text-xs leading-relaxed font-serif-vintage">
          <Flame className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5 not-italic" />
          <div>
            <strong className="text-[#f4e4bc] font-deco font-bold uppercase tracking-wider block mb-0.5">PROCEED WITH UTMOST CAUTION:</strong>
            If your accusation matches the Murder Envelope EXACTLY, you immediately WIN the match. However, if even ONE element is incorrect, you will be PERMANENTLY ELIMINATED from taking turns or moving your pawn!
          </div>
        </div>

        {/* 3 Selectors (Suspect, Weapon, Room) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* 1. Suspect */}
          <div className="flex flex-col space-y-1.5">
            <label className="text-[11px] font-deco uppercase tracking-wider text-[#d4af37] font-bold">
              1. Accused Suspect
            </label>
            <div className="flex flex-col space-y-1 max-h-48 overflow-y-auto pr-1">
              {ALL_SUSPECTS.map((s) => {
                const isSelected = selectedSuspect === s;
                const color = SUSPECT_COLORS[s];
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSelectedSuspect(s)}
                    className={`p-2 rounded-lg border text-left flex items-center space-x-2 transition-all ${
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
                    <span className="text-xs font-semibold truncate text-[#f4e4bc]">{s}</span>
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
            <div className="flex flex-col space-y-1 max-h-48 overflow-y-auto pr-1">
              {ALL_WEAPONS.map((w) => {
                const isSelected = selectedWeapon === w;
                return (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setSelectedWeapon(w)}
                    className={`p-2 rounded-lg border text-left flex items-center space-x-2 transition-all ${
                      isSelected
                        ? 'bg-[#9b111e]/30 border-red-500 ring-2 ring-red-500 shadow'
                        : 'bg-[#1a0f0d] border-[#d4af37]/20 hover:border-[#d4af37]/50'
                    }`}
                  >
                    <span className="text-sm">🗡️</span>
                    <span className="text-xs font-semibold truncate text-[#f4e4bc]">{w}</span>
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
            <div className="flex flex-col space-y-1 max-h-48 overflow-y-auto pr-1">
              {ALL_ROOMS.map((r) => {
                const isSelected = selectedRoom === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setSelectedRoom(r)}
                    className={`p-2 rounded-lg border text-left flex items-center space-x-2 transition-all ${
                      isSelected
                        ? 'bg-[#9b111e]/30 border-red-500 ring-2 ring-red-500 shadow'
                        : 'bg-[#1a0f0d] border-[#d4af37]/20 hover:border-[#d4af37]/50'
                    }`}
                  >
                    <span className="text-sm">🏛️</span>
                    <span className="text-xs font-semibold truncate text-[#f4e4bc]">{r}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Accusation Statement */}
        <div className="p-3.5 rounded-xl bg-[#1a0f0d] border border-[#9b111e]/80 text-center">
          <span className="text-[10px] font-deco uppercase tracking-widest text-[#d4af37]">Formal Indictment</span>
          <p className="font-deco font-bold text-sm sm:text-base text-[#f4e4bc] mt-1">
            "I formally accuse{' '}
            <span className="text-red-400 underline">{selectedSuspect}</span> of committing murder in the{' '}
            <span className="text-red-400 underline">{selectedRoom}</span> using the{' '}
            <span className="text-red-400 underline">{selectedWeapon}</span>!"
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded bg-[#1a0f0d] hover:bg-[#3d1a10] text-[#baa479] hover:text-[#f4e4bc] border border-[#d4af37]/30 text-xs font-deco uppercase tracking-wider transition-colors cursor-pointer"
          >
            Cancel Accusation
          </button>

          <button
            id="confirm-accusation-btn"
            type="button"
            onClick={() => onAccuse(selectedSuspect, selectedWeapon, selectedRoom)}
            className="px-6 py-2.5 rounded bg-[#9b111e] hover:bg-red-700 text-white font-deco font-bold text-xs uppercase tracking-widest shadow-xl shadow-red-900/30 flex items-center space-x-2 transition-all cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Open Murder Envelope & Accuse!</span>
          </button>
        </div>
      </div>
    </div>
  );
};
