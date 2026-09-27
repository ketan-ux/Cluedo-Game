import React from 'react';
import { SuggestionPayload, Card } from '../../types/cluedo';
import { CardView } from './CardView';
import { getCardByName } from '../../engine/assets';
import {
  Sparkles,
  ShieldAlert,
  BookOpen,
  ArrowRight,
  X,
  Target,
  CheckCircle,
} from 'lucide-react';

interface UnrefutedTheoryModalProps {
  isOpen: boolean;
  suggestion: SuggestionPayload | null;
  myHand?: Card[];
  onClose: () => void;
  onOpenAccusation: () => void;
  onOpenNotebook?: () => void;
  onPassTurn?: () => void;
}

export const UnrefutedTheoryModal: React.FC<UnrefutedTheoryModalProps> = ({
  isOpen,
  suggestion,
  myHand = [],
  onClose,
  onOpenAccusation,
  onOpenNotebook,
  onPassTurn,
}) => {
  if (!isOpen || !suggestion) return null;

  const suspectCard = getCardByName(suggestion.suspect);
  const weaponCard = getCardByName(suggestion.weapon);
  const roomCard = getCardByName(suggestion.room);

  const handCardNames = new Set(myHand.map((c) => c.name));
  const holdingSuspect = handCardNames.has(suggestion.suspect);
  const holdingWeapon = handCardNames.has(suggestion.weapon);
  const holdingRoom = handCardNames.has(suggestion.room);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-4 overflow-y-auto animate-fade-in">
      <div
        id="unrefuted-theory-modal"
        className="relative w-full max-w-2xl rounded-2xl bg-[#1e130d] border-2 border-[#d4af37] p-5 sm:p-7 shadow-[0_20px_60px_rgba(0,0,0,0.95)] text-[#f4e4bc] flex flex-col space-y-4"
      >
        {/* Close "X" Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-[#baa479] hover:text-[#f4e4bc] hover:bg-[#351d14] border border-[#d4af37]/30 transition-colors cursor-pointer"
          title="Close announcement"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center space-x-3.5 border-b border-[#d4af37]/30 pb-3 pr-8">
          <div className="w-12 h-12 rounded-full bg-[#d4af37]/20 border-2 border-[#d4af37] flex items-center justify-center text-[#d4af37] shadow-xl flex-shrink-0 animate-pulse">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-deco tracking-widest text-[#d4af37] uppercase bg-[#140b08] px-2 py-0.5 rounded border border-[#d4af37]/30">
                Investigation Breakthrough
              </span>
              <span className="text-[10px] font-deco font-bold tracking-wider uppercase px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
                100% Unrefuted
              </span>
            </div>
            <h2 className="font-deco font-black text-xl sm:text-2xl text-[#f4e4bc] mt-1 uppercase tracking-wider">
              NOBODY COULD DISPROVE YOUR THEORY!
            </h2>
          </div>
        </div>

        {/* Explanation Card */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-[#2a170e] via-[#3a2012] to-[#2a170e] border border-[#d4af37]/40 shadow-inner space-y-2 text-xs leading-relaxed font-serif-vintage">
          <div className="flex items-center space-x-2 text-[#d4af37] font-deco font-bold uppercase tracking-wider text-xs">
            <ShieldAlert className="w-4 h-4 text-[#d4af37]" />
            <span>HOW IS THIS POSSIBLE IN CLUEDO?</span>
          </div>
          <p className="text-[#f4ecd8]">
            Every other detective in the manor was queried in clockwise order, and <strong className="text-[#d4af37] font-bold not-italic">none of them hold any of these 3 cards</strong>!
          </p>
          <p className="text-[#baa479] italic">
            In the rules of Cluedo, if no other detective can show a card to refute your theory, then any card in this suggestion that is <strong className="text-[#f4e4bc] not-italic">NOT in your own hand MUST be inside the secret Murder Envelope</strong>!
          </p>
        </div>

        {/* Suggested Cards Display */}
        <div className="flex flex-col space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-deco font-bold uppercase tracking-widest text-[#d4af37] flex items-center space-x-1.5">
              <Target className="w-4 h-4" />
              <span>THE 3 UNREFUTED CARDS</span>
            </span>
            <span className="text-[11px] font-serif-vintage italic text-[#baa479]">
              Cross-reference with your hand below
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-4 justify-items-center bg-[#140b08] p-3 sm:p-4 rounded-xl border border-[#d4af37]/20">
            {/* Suspect */}
            <div className="flex flex-col items-center space-y-1.5 w-full">
              <div className="relative">
                <CardView card={suspectCard} size="sm" />
                {holdingSuspect && (
                  <span className="absolute -top-2 -right-2 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-[#3b2012] text-amber-300 border border-amber-400/60 shadow">
                    In Your Hand
                  </span>
                )}
              </div>
              <span className="text-[10px] font-mono uppercase text-[#baa479] text-center truncate w-full">
                {suggestion.suspect}
              </span>
            </div>

            {/* Weapon */}
            <div className="flex flex-col items-center space-y-1.5 w-full">
              <div className="relative">
                <CardView card={weaponCard} size="sm" />
                {holdingWeapon && (
                  <span className="absolute -top-2 -right-2 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-[#3b2012] text-amber-300 border border-amber-400/60 shadow">
                    In Your Hand
                  </span>
                )}
              </div>
              <span className="text-[10px] font-mono uppercase text-[#baa479] text-center truncate w-full">
                {suggestion.weapon}
              </span>
            </div>

            {/* Room */}
            <div className="flex flex-col items-center space-y-1.5 w-full">
              <div className="relative">
                <CardView card={roomCard} size="sm" />
                {holdingRoom && (
                  <span className="absolute -top-2 -right-2 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-[#3b2012] text-amber-300 border border-amber-400/60 shadow">
                    In Your Hand
                  </span>
                )}
              </div>
              <span className="text-[10px] font-mono uppercase text-[#baa479] text-center truncate w-full">
                {suggestion.room}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-2 border-t border-[#d4af37]/20">
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            {onOpenNotebook && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenNotebook();
                }}
                className="flex-1 sm:flex-initial px-3.5 py-2 rounded bg-[#150a08] hover:bg-[#2d1810] text-[#baa479] hover:text-[#f4e4bc] border border-[#d4af37]/30 text-xs font-deco uppercase tracking-wider flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
              >
                <BookOpen className="w-4 h-4 text-[#d4af37]" />
                <span>Open Ledger</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial px-4 py-2 rounded bg-[#2b180f] hover:bg-[#422415] text-[#f4e4bc] border border-[#d4af37]/40 text-xs font-deco uppercase tracking-wider flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
            >
              <CheckCircle className="w-4 h-4 text-[#d4af37]" />
              <span>Got It</span>
            </button>
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            <button
              id="unrefuted-make-accusation-btn"
              type="button"
              onClick={() => {
                onClose();
                onOpenAccusation();
              }}
              className="flex-1 sm:flex-initial px-5 py-2.5 rounded bg-gradient-to-r from-[#9b111e] via-[#c41525] to-[#9b111e] hover:from-[#b81424] hover:to-[#b81424] text-white font-deco font-black text-xs uppercase tracking-widest shadow-xl shadow-red-950/60 border border-yellow-400/60 flex items-center justify-center space-x-2 transition-all cursor-pointer transform hover:scale-105 active:scale-95"
            >
              <Target className="w-4 h-4 text-yellow-300" />
              <span>Make Final Accusation!</span>
            </button>

            {onPassTurn && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onPassTurn();
                }}
                className="px-3.5 py-2 rounded bg-[#1a0e08] hover:bg-[#2b170e] text-[#baa479] hover:text-[#f4e4bc] border border-[#d4af37]/20 text-xs font-deco uppercase tracking-wider flex items-center space-x-1 transition-colors cursor-pointer"
              >
                <span>Pass</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
