import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Footprints, Dices } from 'lucide-react';

interface ThreeDDiceOverlayProps {
  diceRoll: [number, number] | null;
  remainingSteps?: number;
  activePlayerName?: string;
  isMyTurn?: boolean;
}

// Render pip layout for each die face (1-6)
const renderPips = (faceNum: number) => {
  switch (faceNum) {
    case 1:
      return (
        <div className="w-full h-full flex items-center justify-center">
          <span className="w-2.5 h-2.5 rounded-full bg-[#9b111e] shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)] border border-[#d4af37]/60" />
        </div>
      );
    case 2:
      return (
        <div className="w-full h-full p-1 flex flex-col justify-between">
          <div className="flex justify-start">
            <span className="w-1.5 h-1.5 rounded-full bg-[#20120b] shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)]" />
          </div>
          <div className="flex justify-end">
            <span className="w-1.5 h-1.5 rounded-full bg-[#20120b] shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)]" />
          </div>
        </div>
      );
    case 3:
      return (
        <div className="w-full h-full p-1 flex flex-col justify-between">
          <div className="flex justify-start">
            <span className="w-1.5 h-1.5 rounded-full bg-[#20120b] shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)]" />
          </div>
          <div className="flex justify-center">
            <span className="w-1.5 h-1.5 rounded-full bg-[#20120b] shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)]" />
          </div>
          <div className="flex justify-end">
            <span className="w-1.5 h-1.5 rounded-full bg-[#20120b] shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)]" />
          </div>
        </div>
      );
    case 4:
      return (
        <div className="w-full h-full p-1 flex flex-col justify-between">
          <div className="flex justify-between">
            <span className="w-1.5 h-1.5 rounded-full bg-[#20120b] shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)]" />
            <span className="w-1.5 h-1.5 rounded-full bg-[#20120b] shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)]" />
          </div>
          <div className="flex justify-between">
            <span className="w-1.5 h-1.5 rounded-full bg-[#20120b] shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)]" />
            <span className="w-1.5 h-1.5 rounded-full bg-[#20120b] shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)]" />
          </div>
        </div>
      );
    case 5:
      return (
        <div className="w-full h-full p-1 flex flex-col justify-between">
          <div className="flex justify-between">
            <span className="w-1.5 h-1.5 rounded-full bg-[#20120b] shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)]" />
            <span className="w-1.5 h-1.5 rounded-full bg-[#20120b] shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)]" />
          </div>
          <div className="flex justify-center">
            <span className="w-1.5 h-1.5 rounded-full bg-[#20120b] shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)]" />
          </div>
          <div className="flex justify-between">
            <span className="w-1.5 h-1.5 rounded-full bg-[#20120b] shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)]" />
            <span className="w-1.5 h-1.5 rounded-full bg-[#20120b] shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)]" />
          </div>
        </div>
      );
    case 6:
      return (
        <div className="w-full h-full p-1 flex flex-col justify-between">
          <div className="flex justify-between">
            <span className="w-1.5 h-1.5 rounded-full bg-[#20120b] shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)]" />
            <span className="w-1.5 h-1.5 rounded-full bg-[#20120b] shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)]" />
          </div>
          <div className="flex justify-between">
            <span className="w-1.5 h-1.5 rounded-full bg-[#20120b] shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)]" />
            <span className="w-1.5 h-1.5 rounded-full bg-[#20120b] shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)]" />
          </div>
          <div className="flex justify-between">
            <span className="w-1.5 h-1.5 rounded-full bg-[#20120b] shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)]" />
            <span className="w-1.5 h-1.5 rounded-full bg-[#20120b] shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)]" />
          </div>
        </div>
      );
    default:
      return null;
  }
};

// Compact, crisp, static die face (strictly non-repeating, no looping animations)
const StaticDieFace: React.FC<{ value: number }> = ({ value }) => {
  return (
    <div
      className="w-7 h-7 rounded-md bg-gradient-to-br from-[#fffdf5] via-[#f7ecd5] to-[#e4cead] border-1.5 border-[#d4af37] shadow-[0_2px_5px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.9)] flex items-center justify-center select-none flex-shrink-0"
      style={{ boxSizing: 'border-box' }}
    >
      {renderPips(value)}
    </div>
  );
};

export const ThreeDDiceOverlay: React.FC<ThreeDDiceOverlayProps> = ({
  diceRoll,
  remainingSteps,
  activePlayerName,
  isMyTurn,
}) => {
  // Store the last valid roll so it stays peacefully in the tiny corner as a persistent reminder
  const [lastRoll, setLastRoll] = useState<[number, number] | null>(null);
  const [highlightPulse, setHighlightPulse] = useState(false);
  const prevRollKey = useRef<string>('');

  useEffect(() => {
    if (diceRoll && (diceRoll[0] > 0 || diceRoll[1] > 0)) {
      const key = `${diceRoll[0]}-${diceRoll[1]}`;
      if (key !== prevRollKey.current) {
        prevRollKey.current = key;
        setLastRoll(diceRoll);
        // Single brief 200ms flash/pulse on new roll, then zero repeating animations
        setHighlightPulse(true);
        const timer = setTimeout(() => setHighlightPulse(false), 300);
        return () => clearTimeout(timer);
      }
    }
  }, [diceRoll]);

  const activeRoll = diceRoll || lastRoll;
  if (!activeRoll) return null;

  const total = activeRoll[0] + activeRoll[1];
  const stepsToShow = remainingSteps !== undefined ? remainingSteps : total;
  const isCurrentActive = Boolean(diceRoll);

  return (
    <div
      id="dice-corner-reminder"
      className="absolute top-2.5 right-2.5 z-20 pointer-events-auto select-none"
    >
      <motion.div
        animate={{
          scale: highlightPulse ? 1.05 : 1,
        }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className={`flex items-center space-x-2 px-2.5 py-1.5 rounded-lg border shadow-lg backdrop-blur-md transition-colors ${
          isCurrentActive
            ? 'bg-[#1b100a]/92 border-[#d4af37]/80 shadow-[0_4px_16px_rgba(0,0,0,0.8),0_0_10px_rgba(212,175,55,0.25)]'
            : 'bg-[#140c08]/85 border-[#785034]/50 shadow-[0_3px_10px_rgba(0,0,0,0.6)] opacity-85'
        }`}
      >
        {/* Dice Faces - strictly static & no loop */}
        <div className="flex items-center space-x-1.5">
          <StaticDieFace value={activeRoll[0]} />
          <StaticDieFace value={activeRoll[1]} />
        </div>

        {/* Steps / Total Info */}
        <div className="flex flex-col items-start pr-0.5 border-l border-[#d4af37]/30 pl-2">
          <div className="flex items-center space-x-1 leading-tight">
            <span className="text-[9px] font-mono text-[#baa479]">
              {isCurrentActive ? 'Roll:' : 'Last:'}
            </span>
            <span className="font-deco font-black text-xs text-[#d4af37]">
              {activeRoll[0]}+{activeRoll[1]} = {total}
            </span>
          </div>

          <div className="flex items-center space-x-1 text-[9px] font-mono text-[#f4e4bc] leading-tight mt-0.5">
            <Footprints className="w-2.5 h-2.5 text-emerald-400 flex-shrink-0" />
            <span className="font-bold text-emerald-400">{stepsToShow}</span>
            <span className="text-[8px] text-[#baa479]">
              {isCurrentActive ? 'steps' : 'rolled'}
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
