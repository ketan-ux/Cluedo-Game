import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, ChevronUp, Sparkles, Shield, User, X } from 'lucide-react';
import { Suspect, Weapon, Room, MaskedPlayer } from '../../types/cluedo';

interface FloatingSuggestionPopupProps {
  suggestion: {
    suspect: Suspect;
    weapon: Weapon;
    room: Room;
    suggesterPeerId?: string;
    suggesterName?: string;
    suggesterCharacter?: Suspect;
  } | null;
  phase: string;
  pendingDisprover?: MaskedPlayer | null;
  logs?: Array<{ message: string; type: string; timestamp: number }>;
}

const CHARACTER_COLORS: Record<string, string> = {
  'Miss Scarlet': '#e11d48',
  'Colonel Mustard': '#ca8a04',
  'Mrs. White': '#e2e8f0',
  'Mr. Green': '#16a34a',
  'Mrs. Peacock': '#2563eb',
  'Professor Plum': '#9333ea',
};

export const FloatingSuggestionPopup: React.FC<FloatingSuggestionPopupProps> = ({
  suggestion,
  phase,
  pendingDisprover,
  logs = [],
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [prevSuggestionKey, setPrevSuggestionKey] = useState<string>('');

  const currentKey = suggestion
    ? `${suggestion.suspect}-${suggestion.weapon}-${suggestion.room}-${suggestion.suggesterPeerId || ''}`
    : '';

  // Re-open and reset dismiss on new suggestion
  useEffect(() => {
    if (currentKey && currentKey !== prevSuggestionKey) {
      setPrevSuggestionKey(currentKey);
      setIsDismissed(false);
      setIsCollapsed(false);
    }
  }, [currentKey, prevSuggestionKey]);

  // Check recent logs for disprove outcome
  const latestLog = logs[logs.length - 1];
  let outcomeText: string | null = null;
  if (latestLog) {
    if (latestLog.type === 'DISPROVE') {
      outcomeText = latestLog.message;
    } else if (latestLog.type === 'NO_DISPROVE') {
      outcomeText = 'No detective could disprove this suggestion!';
    }
  }

  if (!suggestion || isDismissed) {
    return null;
  }

  const charColor = suggestion.suggesterCharacter
    ? CHARACTER_COLORS[suggestion.suggesterCharacter] || '#d4af37'
    : '#d4af37';

  return (
    <div
      id="floating-suggestion-popup"
      className="absolute top-3 left-1/2 -translate-x-1/2 z-30 max-w-[92vw] sm:max-w-md w-full px-2 pointer-events-auto select-none"
    >
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -15, scale: 0.95 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="rounded-xl border-2 border-[#d4af37] bg-[#1a0e08]/95 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.85),0_0_15px_rgba(212,175,55,0.25)] text-[#f4ecd8] overflow-hidden"
      >
        {/* Header Ribbon */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-[#251610] border-b border-[#d4af37]/30">
          <div className="flex items-center space-x-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-[#d4af37] animate-ping" />
            <span className="font-deco font-bold text-xs uppercase tracking-wider text-[#d4af37] truncate flex items-center space-x-1">
              <Sparkles className="w-3.5 h-3.5 text-[#d4af37]" />
              <span>Active Investigation Suggestion</span>
            </span>
          </div>

          <div className="flex items-center space-x-1 flex-shrink-0">
            <button
              type="button"
              onClick={() => setIsCollapsed((prev) => !prev)}
              className="p-1 rounded text-[#baa479] hover:text-[#f4e4bc] hover:bg-[#3d2315] transition-colors cursor-pointer"
              title={isCollapsed ? 'Expand suggestion details' : 'Collapse to compact bar'}
            >
              {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => setIsDismissed(true)}
              className="p-1 rounded text-[#baa479] hover:text-red-400 hover:bg-[#3d2315] transition-colors cursor-pointer"
              title="Close notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Collapsed Compact View */}
        {isCollapsed ? (
          <div
            onClick={() => setIsCollapsed(false)}
            className="px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-[#251610]/50 transition-colors text-xs"
          >
            <div className="flex items-center space-x-2 truncate">
              <span className="font-bold text-[#d4af37]">{suggestion.suspect}</span>
              <span className="text-[#8c7457]">•</span>
              <span className="text-[#f4ecd8]">{suggestion.weapon}</span>
              <span className="text-[#8c7457]">•</span>
              <span className="text-[#baa479]">{suggestion.room}</span>
            </div>
            <span className="text-[10px] font-mono text-[#d4af37] ml-2 underline">Details</span>
          </div>
        ) : (
          /* Expanded Full Card View */
          <div className="p-3 space-y-2.5">
            {/* Suggester Info */}
            <div className="flex items-center justify-between text-xs text-[#baa479]">
              <div className="flex items-center space-x-1.5 truncate">
                <User className="w-3.5 h-3.5 text-[#d4af37]" />
                <span>Proposed by:</span>
                <span className="font-bold text-[#f4ecd8] truncate" style={{ color: charColor }}>
                  {suggestion.suggesterName || 'Detective'} ({suggestion.suggesterCharacter || 'Investigator'})
                </span>
              </div>
            </div>

            {/* The 3 Hypothesis Items */}
            <div className="grid grid-cols-3 gap-2 text-center">
              {/* Suspect */}
              <div className="p-2 rounded-lg bg-[#251610] border border-[#d4af37]/30 flex flex-col items-center">
                <span className="text-[10px] uppercase tracking-wider font-deco text-[#baa479]">Suspect</span>
                <span className="font-bold text-xs sm:text-sm text-[#f4ecd8] mt-0.5 truncate max-w-full">
                  {suggestion.suspect}
                </span>
              </div>

              {/* Weapon */}
              <div className="p-2 rounded-lg bg-[#251610] border border-[#d4af37]/30 flex flex-col items-center">
                <span className="text-[10px] uppercase tracking-wider font-deco text-[#baa479]">Weapon</span>
                <span className="font-bold text-xs sm:text-sm text-[#f4ecd8] mt-0.5 truncate max-w-full">
                  {suggestion.weapon}
                </span>
              </div>

              {/* Room */}
              <div className="p-2 rounded-lg bg-[#251610] border border-[#d4af37]/30 flex flex-col items-center">
                <span className="text-[10px] uppercase tracking-wider font-deco text-[#baa479]">Room</span>
                <span className="font-bold text-xs sm:text-sm text-[#f4ecd8] mt-0.5 truncate max-w-full">
                  {suggestion.room}
                </span>
              </div>
            </div>

            {/* Refutation Status / Progress */}
            <div className="pt-1 text-xs">
              {outcomeText ? (
                <div className="px-2.5 py-1.5 rounded bg-[#382014] border border-[#d4af37]/40 text-[#f4e4bc] flex items-center space-x-2">
                  <Shield className="w-3.5 h-3.5 text-[#d4af37] flex-shrink-0" />
                  <span className="truncate">{outcomeText}</span>
                </div>
              ) : pendingDisprover ? (
                <div className="px-2.5 py-1.5 rounded bg-[#20130d] border border-amber-600/40 text-amber-200 flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 truncate">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <span>Awaiting refutation from:</span>
                    <span className="font-bold text-[#f4ecd8]">
                      {pendingDisprover.name} ({pendingDisprover.character})
                    </span>
                  </div>
                </div>
              ) : phase === 'DISPROVE' ? (
                <div className="px-2.5 py-1.5 rounded bg-[#20130d] border border-amber-600/40 text-amber-200 text-center">
                  Consulting other detectives around the table...
                </div>
              ) : null}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};
