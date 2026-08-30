import React, { useState } from 'react';
import { Card, SuggestionPayload } from '../../types/cluedo';
import { CardView } from './CardView';
import { Shield, Eye, AlertCircle } from 'lucide-react';

interface DisproveModalProps {
  isOpen: boolean;
  suggestion: SuggestionPayload | null;
  myHand: Card[];
  onDisprove: (cardId: string) => void;
}

export const DisproveModal: React.FC<DisproveModalProps> = ({
  isOpen,
  suggestion,
  myHand,
  onDisprove,
}) => {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  if (!isOpen || !suggestion) return null;

  // Filter cards in hand that match any element of the suggestion
  const matchingCards = myHand.filter(
    (card) =>
      card.name === suggestion.suspect ||
      card.name === suggestion.weapon ||
      card.name === suggestion.room
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in">
      <div
        id="disprove-modal"
        className="relative w-full max-w-2xl rounded-2xl bg-[#251610] border-2 border-[#d4af37] p-6 shadow-[0_16px_48px_rgba(0,0,0,0.9)] text-[#f4e4bc] flex flex-col space-y-6"
      >
        {/* Header */}
        <div className="flex items-center space-x-3 border-b border-[#d4af37]/30 pb-4">
          <div className="w-10 h-10 rounded-full bg-[#d4af37]/20 border border-[#d4af37] flex items-center justify-center text-[#d4af37]">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-deco font-bold text-xl text-[#f4e4bc] tracking-wider uppercase">
              DISPROVE THE SUGGESTION
            </h3>
            <p className="text-xs text-[#baa479] font-serif-vintage italic">
              You have been called to refute a detective's theory
            </p>
          </div>
        </div>

        {/* Suggestion Details */}
        <div className="p-4 rounded-xl bg-[#1a0f0d] border border-[#d4af37]/40 flex flex-col space-y-2">
          <div className="flex items-center justify-between text-xs font-mono text-[#baa479]">
            <span>Claim by: <strong className="text-[#f4e4bc]">{suggestion.suggesterName} ({suggestion.suggesterCharacter})</strong></span>
            <span className="px-2 py-0.5 rounded bg-[#d4af37]/20 text-[#d4af37] border border-[#d4af37]/40 font-deco text-[10px] uppercase">
              Active Investigation
            </span>
          </div>

          <p className="font-deco font-semibold text-base text-[#f4e4bc] pt-1">
            "It was <span className="text-[#d4af37] underline">{suggestion.suspect}</span>, with the{' '}
            <span className="text-[#d4af37] underline">{suggestion.weapon}</span>, in the{' '}
            <span className="text-[#d4af37] underline">{suggestion.room}</span>."
          </p>
        </div>

        {/* Instructions */}
        <div className="flex items-center space-x-2 text-xs font-serif-vintage italic text-[#baa479] bg-[#1a0f0d] p-3 rounded-lg border border-[#d4af37]/30">
          <AlertCircle className="w-4 h-4 text-[#d4af37] flex-shrink-0 not-italic" />
          <span>
            You hold {matchingCards.length} matching evidence card{matchingCards.length > 1 ? 's' : ''}. Choose <strong>exactly 1</strong> card to reveal privately to {suggestion.suggesterName}.
          </span>
        </div>

        {/* Matching Cards Selection */}
        <div className="flex flex-wrap items-center justify-center gap-4 py-2">
          {matchingCards.map((card) => {
            const isSelected = selectedCardId === card.id;
            return (
              <div key={card.id} className="cursor-pointer" onClick={() => setSelectedCardId(card.id)}>
                <CardView
                  card={card}
                  size="md"
                  isSelectable
                  isSelected={isSelected}
                />
              </div>
            );
          })}
        </div>

        {/* Action Button */}
        <div className="flex items-center justify-end border-t border-[#d4af37]/30 pt-4">
          <button
            id="reveal-disprove-btn"
            disabled={!selectedCardId}
            onClick={() => {
              if (selectedCardId) onDisprove(selectedCardId);
            }}
            className={`px-8 py-3 rounded font-deco font-bold text-xs uppercase tracking-widest flex items-center space-x-2 transition-all ${
              selectedCardId
                ? 'bg-[#d4af37] hover:bg-[#b8952e] text-[#1a0f0d] shadow-xl shadow-[#d4af37]/30 cursor-pointer'
                : 'bg-[#1a0f0d] text-[#6b4c37] border border-[#d4af37]/20 cursor-not-allowed'
            }`}
          >
            <Eye className="w-4 h-4" />
            <span>Show Card Privately</span>
          </button>
        </div>
      </div>
    </div>
  );
};
