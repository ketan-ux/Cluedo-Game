import React from 'react';
import { DisprovedCardPayload } from '../../types/cluedo';
import { CardView } from './CardView';
import { Search, CheckCircle, X } from 'lucide-react';

interface DisprovedRevealOverlayProps {
  payload: DisprovedCardPayload | null;
  onClose: () => void;
  onOpenNotebook?: () => void;
}

export const DisprovedRevealOverlay: React.FC<DisprovedRevealOverlayProps> = ({
  payload,
  onClose,
  onOpenNotebook,
}) => {
  if (!payload) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in">
      <div
        id="disproved-reveal-overlay"
        className="relative w-full max-w-lg rounded-2xl bg-[#251610] border-2 border-[#d4af37] p-6 shadow-[0_16px_48px_rgba(0,0,0,0.9)] text-[#f4e4bc] flex flex-col items-center space-y-5 text-center"
      >
        {/* Inspection Badge */}
        <div className="w-14 h-14 rounded-full bg-[#d4af37]/20 border-2 border-[#d4af37] flex items-center justify-center text-[#d4af37] shadow-xl animate-bounce">
          <Search className="w-7 h-7" />
        </div>

        <div>
          <span className="text-[10px] font-deco tracking-widest text-[#d4af37] uppercase bg-[#1a0f0d] px-2.5 py-1 rounded border border-[#d4af37]/40">
            Confidential Evidence Revealed
          </span>
          <h3 className="font-deco font-bold text-2xl text-[#f4e4bc] mt-2 uppercase tracking-wider">
            EVIDENCE REFUTED
          </h3>
          <p className="text-xs text-[#baa479] font-serif-vintage italic mt-1">
            <strong className="text-[#f4e4bc] not-italic">{payload.disproverName}</strong> showed you this card privately:
          </p>
        </div>

        {/* Revealed Card Presentation */}
        <div className="py-2 transform hover:scale-105 transition-transform duration-300">
          <CardView card={payload.card} size="lg" />
        </div>

        <p className="text-xs font-serif-vintage italic text-[#baa479] max-w-xs">
          This card is held by {payload.disproverName}, meaning it CANNOT be inside the Murder Envelope!
        </p>

        {/* Action Buttons */}
        <div className="flex items-center space-x-3 pt-2 w-full">
          {onOpenNotebook && (
            <button
              onClick={() => {
                onClose();
                onOpenNotebook();
              }}
              className="flex-1 py-2.5 rounded bg-[#1a0f0d] hover:bg-[#2d1b10] text-[#f4e4bc] border border-[#d4af37]/40 font-deco text-xs uppercase tracking-wider transition-colors cursor-pointer"
            >
              Open Detective Ledger
            </button>
          )}

          <button
            id="close-reveal-btn"
            onClick={onClose}
            className="flex-1 py-2.5 rounded bg-[#d4af37] hover:bg-[#b8952e] text-[#1a0f0d] font-deco font-bold text-xs uppercase tracking-widest shadow-lg shadow-[#d4af37]/20 flex items-center justify-center space-x-1.5 cursor-pointer"
          >
            <CheckCircle className="w-4 h-4" />
            <span>Got It</span>
          </button>
        </div>
      </div>
    </div>
  );
};
