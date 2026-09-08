import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Dices } from 'lucide-react';

interface ThreeDDiceOverlayProps {
  diceRoll: [number, number] | null;
  activePlayerName?: string;
  isMyTurn?: boolean;
}

// Target rotations (X, Y) to land on a given face (1-6)
const FACE_ROTATIONS: Record<number, { x: number; y: number }> = {
  1: { x: 0, y: 0 },
  2: { x: 0, y: -90 },
  3: { x: -90, y: 0 },
  4: { x: 90, y: 0 },
  5: { x: 0, y: 90 },
  6: { x: 180, y: 0 },
};

// Render pip layout for each face (1-6)
const renderPips = (faceNum: number) => {
  switch (faceNum) {
    case 1:
      return (
        <div className="w-full h-full flex items-center justify-center">
          <span className="w-3.5 h-3.5 rounded-full bg-[#9b111e] shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)] border border-[#d4af37]/40" />
        </div>
      );
    case 2:
      return (
        <div className="w-full h-full p-2 flex flex-col justify-between">
          <div className="flex justify-start">
            <span className="w-2.5 h-2.5 rounded-full bg-[#20120b] shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)] border border-[#d4af37]/30" />
          </div>
          <div className="flex justify-end">
            <span className="w-2.5 h-2.5 rounded-full bg-[#20120b] shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)] border border-[#d4af37]/30" />
          </div>
        </div>
      );
    case 3:
      return (
        <div className="w-full h-full p-2 flex flex-col justify-between">
          <div className="flex justify-start">
            <span className="w-2.5 h-2.5 rounded-full bg-[#20120b] shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)] border border-[#d4af37]/30" />
          </div>
          <div className="flex justify-center">
            <span className="w-2.5 h-2.5 rounded-full bg-[#20120b] shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)] border border-[#d4af37]/30" />
          </div>
          <div className="flex justify-end">
            <span className="w-2.5 h-2.5 rounded-full bg-[#20120b] shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)] border border-[#d4af37]/30" />
          </div>
        </div>
      );
    case 4:
      return (
        <div className="w-full h-full p-2 flex flex-col justify-between">
          <div className="flex justify-between">
            <span className="w-2.5 h-2.5 rounded-full bg-[#20120b] shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)] border border-[#d4af37]/30" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#20120b] shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)] border border-[#d4af37]/30" />
          </div>
          <div className="flex justify-between">
            <span className="w-2.5 h-2.5 rounded-full bg-[#20120b] shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)] border border-[#d4af37]/30" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#20120b] shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)] border border-[#d4af37]/30" />
          </div>
        </div>
      );
    case 5:
      return (
        <div className="w-full h-full p-2 flex flex-col justify-between">
          <div className="flex justify-between">
            <span className="w-2.5 h-2.5 rounded-full bg-[#20120b] shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)] border border-[#d4af37]/30" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#20120b] shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)] border border-[#d4af37]/30" />
          </div>
          <div className="flex justify-center">
            <span className="w-2.5 h-2.5 rounded-full bg-[#20120b] shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)] border border-[#d4af37]/30" />
          </div>
          <div className="flex justify-between">
            <span className="w-2.5 h-2.5 rounded-full bg-[#20120b] shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)] border border-[#d4af37]/30" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#20120b] shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)] border border-[#d4af37]/30" />
          </div>
        </div>
      );
    case 6:
      return (
        <div className="w-full h-full p-2 flex flex-col justify-between">
          <div className="flex justify-between">
            <span className="w-2.5 h-2.5 rounded-full bg-[#20120b] shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)] border border-[#d4af37]/30" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#20120b] shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)] border border-[#d4af37]/30" />
          </div>
          <div className="flex justify-between">
            <span className="w-2.5 h-2.5 rounded-full bg-[#20120b] shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)] border border-[#d4af37]/30" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#20120b] shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)] border border-[#d4af37]/30" />
          </div>
          <div className="flex justify-between">
            <span className="w-2.5 h-2.5 rounded-full bg-[#20120b] shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)] border border-[#d4af37]/30" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#20120b] shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)] border border-[#d4af37]/30" />
          </div>
        </div>
      );
    default:
      return null;
  }
};

const Die3D: React.FC<{
  value: number;
  isRolling: boolean;
  spinBonusX: number;
  spinBonusY: number;
}> = ({ value, isRolling, spinBonusX, spinBonusY }) => {
  const target = FACE_ROTATIONS[value] || FACE_ROTATIONS[1];
  const rotX = isRolling ? spinBonusX : target.x;
  const rotY = isRolling ? spinBonusY : target.y;

  return (
    <div
      className="relative w-16 h-16"
      style={{
        perspective: '600px',
      }}
    >
      {/* 3D Cube Container */}
      <div
        className="w-full h-full relative transition-transform duration-700 ease-out"
        style={{
          transformStyle: 'preserve-3d',
          transform: `rotateX(${rotX}deg) rotateY(${rotY}deg)`,
        }}
      >
        {/* Face 1 (Front) */}
        <div
          className="absolute inset-0 bg-gradient-to-br from-[#faf6ee] to-[#e4d8c3] border border-[#bfa77e] rounded-xl shadow-[inset_0_2px_4px_rgba(255,255,255,0.9),inset_0_-2px_4px_rgba(0,0,0,0.2)] backface-hidden"
          style={{ transform: 'rotateY(0deg) translateZ(32px)' }}
        >
          {renderPips(1)}
        </div>

        {/* Face 6 (Back) */}
        <div
          className="absolute inset-0 bg-gradient-to-br from-[#faf6ee] to-[#e4d8c3] border border-[#bfa77e] rounded-xl shadow-[inset_0_2px_4px_rgba(255,255,255,0.9),inset_0_-2px_4px_rgba(0,0,0,0.2)] backface-hidden"
          style={{ transform: 'rotateX(180deg) translateZ(32px)' }}
        >
          {renderPips(6)}
        </div>

        {/* Face 2 (Right) */}
        <div
          className="absolute inset-0 bg-gradient-to-br from-[#faf6ee] to-[#e4d8c3] border border-[#bfa77e] rounded-xl shadow-[inset_0_2px_4px_rgba(255,255,255,0.9),inset_0_-2px_4px_rgba(0,0,0,0.2)] backface-hidden"
          style={{ transform: 'rotateY(90deg) translateZ(32px)' }}
        >
          {renderPips(2)}
        </div>

        {/* Face 5 (Left) */}
        <div
          className="absolute inset-0 bg-gradient-to-br from-[#faf6ee] to-[#e4d8c3] border border-[#bfa77e] rounded-xl shadow-[inset_0_2px_4px_rgba(255,255,255,0.9),inset_0_-2px_4px_rgba(0,0,0,0.2)] backface-hidden"
          style={{ transform: 'rotateY(-90deg) translateZ(32px)' }}
        >
          {renderPips(5)}
        </div>

        {/* Face 3 (Top) */}
        <div
          className="absolute inset-0 bg-gradient-to-br from-[#faf6ee] to-[#e4d8c3] border border-[#bfa77e] rounded-xl shadow-[inset_0_2px_4px_rgba(255,255,255,0.9),inset_0_-2px_4px_rgba(0,0,0,0.2)] backface-hidden"
          style={{ transform: 'rotateX(90deg) translateZ(32px)' }}
        >
          {renderPips(3)}
        </div>

        {/* Face 4 (Bottom) */}
        <div
          className="absolute inset-0 bg-gradient-to-br from-[#faf6ee] to-[#e4d8c3] border border-[#bfa77e] rounded-xl shadow-[inset_0_2px_4px_rgba(255,255,255,0.9),inset_0_-2px_4px_rgba(0,0,0,0.2)] backface-hidden"
          style={{ transform: 'rotateX(-90deg) translateZ(32px)' }}
        >
          {renderPips(4)}
        </div>
      </div>

      {/* Dynamic Drop Shadow on Table Felt */}
      <div
        className="absolute -bottom-3 left-1 right-1 h-3 rounded-full bg-black/60 blur-[3px] transition-all duration-500"
        style={{
          transform: isRolling ? 'scale(0.8) translateY(6px)' : 'scale(1) translateY(0px)',
          opacity: isRolling ? 0.3 : 0.7,
        }}
      />
    </div>
  );
};

export const ThreeDDiceOverlay: React.FC<ThreeDDiceOverlayProps> = ({
  diceRoll,
  activePlayerName,
  isMyTurn,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isRolling, setIsRolling] = useState(false);
  const [spin1, setSpin1] = useState({ x: 0, y: 0 });
  const [spin2, setSpin2] = useState({ x: 0, y: 0 });
  const [currentValues, setCurrentValues] = useState<[number, number]>([1, 1]);
  const prevRollRef = useRef<string>('');
  const fadeTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!diceRoll) return;

    const rollKey = `${diceRoll[0]}-${diceRoll[1]}-${Date.now()}`;
    // Trigger on any new roll
    if (rollKey !== prevRollRef.current) {
      prevRollRef.current = rollKey;
      setCurrentValues(diceRoll);
      setIsVisible(true);
      setIsRolling(true);

      // Random multi-spin degrees to make tumble feel organic
      const target1 = FACE_ROTATIONS[diceRoll[0]] || { x: 0, y: 0 };
      const target2 = FACE_ROTATIONS[diceRoll[1]] || { x: 0, y: 0 };

      setSpin1({
        x: 720 + target1.x + (Math.random() > 0.5 ? 360 : -360),
        y: 1080 + target1.y + (Math.random() > 0.5 ? 360 : -360),
      });
      setSpin2({
        x: 1080 + target2.x + (Math.random() > 0.5 ? 360 : -360),
        y: 720 + target2.y + (Math.random() > 0.5 ? 360 : -360),
      });

      // Stop tumble after 650ms
      const rollTimer = setTimeout(() => {
        setIsRolling(false);
      }, 650);

      // Fade out after stopping roll (stops roll at 650ms, then stays visible for 2.2s, then fades)
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = setTimeout(() => {
        setIsVisible(false);
      }, 3000);

      return () => {
        clearTimeout(rollTimer);
      };
    }
  }, [diceRoll]);

  // Cleanup fade timer on unmount
  useEffect(() => {
    return () => {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, []);

  if (!isVisible || !diceRoll) return null;

  const total = currentValues[0] + currentValues[1];

  return (
    <div
      id="three-d-dice-overlay"
      onClick={() => setIsVisible(false)}
      className="absolute inset-0 z-40 flex flex-col items-center justify-center pointer-events-auto select-none cursor-pointer bg-black/30 backdrop-blur-[2px]"
      title="Click to dismiss dice roll animation"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.6, y: -40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8, y: 20 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="flex flex-col items-center space-y-4 p-6 rounded-2xl bg-[#1a0e08]/90 border-2 border-[#d4af37] shadow-[0_12px_40px_rgba(0,0,0,0.9),0_0_25px_rgba(212,175,55,0.35)]"
      >
        {/* Header Title */}
        <div className="flex items-center space-x-2 text-[#d4af37] font-deco font-bold text-xs uppercase tracking-widest">
          <Dices className="w-4 h-4 text-[#d4af37]" />
          <span>{activePlayerName ? `${activePlayerName} Rolled` : 'Dice Roll'}</span>
        </div>

        {/* 3D Dice Pair */}
        <div className="flex items-center justify-center space-x-8 py-2">
          {/* Die 1 */}
          <motion.div
            animate={
              isRolling
                ? {
                    x: [-15, 10, -5, 0],
                    y: [-30, 10, -10, 0],
                    rotateZ: [-25, 20, -10, 0],
                  }
                : { x: 0, y: 0, rotateZ: 0 }
            }
            transition={{ duration: 0.65, ease: 'easeOut' }}
          >
            <Die3D
              value={currentValues[0]}
              isRolling={isRolling}
              spinBonusX={spin1.x}
              spinBonusY={spin1.y}
            />
          </motion.div>

          {/* Die 2 */}
          <motion.div
            animate={
              isRolling
                ? {
                    x: [15, -10, 5, 0],
                    y: [-35, 15, -5, 0],
                    rotateZ: [30, -25, 15, 0],
                  }
                : { x: 0, y: 0, rotateZ: 0 }
            }
            transition={{ duration: 0.65, ease: 'easeOut' }}
          >
            <Die3D
              value={currentValues[1]}
              isRolling={isRolling}
              spinBonusX={spin2.x}
              spinBonusY={spin2.y}
            />
          </motion.div>
        </div>

        {/* Total Badge */}
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: isRolling ? 0.3 : 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="px-4 py-1.5 rounded-full bg-[#251610] border border-[#d4af37]/60 flex items-center space-x-2 shadow-inner"
        >
          <span className="text-xs font-mono text-[#baa479]">
            {currentValues[0]} + {currentValues[1]} =
          </span>
          <span className="font-deco font-black text-xl text-[#d4af37] tracking-wider">
            {total}
          </span>
          <span className="text-[10px] font-mono text-[#baa479] uppercase">steps</span>
        </motion.div>

        <span className="text-[10px] font-mono text-[#8c7457]">Tap anywhere to proceed</span>
      </motion.div>
    </div>
  );
};
