import React, { useEffect } from 'react';
import { MaskedPlayer, Solution } from '../../types/cluedo';
import confetti from 'canvas-confetti';
import { Trophy, Skull, RotateCcw, FileText } from 'lucide-react';
import { sounds } from '../../utils/audio';
import { CardView } from './CardView';
import { getCardByName } from '../../engine/assets';

interface GameOverModalProps {
  winner: MaskedPlayer | null;
  solution?: Solution | null;
  onPlayAgain: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  winner,
  solution,
  onPlayAgain,
}) => {
  useEffect(() => {
    if (winner) {
      sounds.playVictoryFanfare();
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#d4af37', '#dc2626', '#16a34a', '#2563eb', '#ffffff'],
      });
    }
  }, [winner]);

  const suspectCard = solution ? getCardByName(solution.suspect) : null;
  const weaponCard = solution ? getCardByName(solution.weapon) : null;
  const roomCard = solution ? getCardByName(solution.room) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 animate-fade-in overflow-y-auto">
      <div
        id="game-over-modal"
        className="relative w-full max-w-xl rounded-2xl bg-[#251610] border-2 border-[#d4af37] p-6 sm:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.95)] text-[#f4e4bc] flex flex-col items-center text-center space-y-5"
      >
        {winner ? (
          <>
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#d4af37]/20 border-2 border-[#d4af37] flex items-center justify-center text-[#d4af37] shadow-xl">
              <Trophy className="w-8 h-8 sm:w-10 sm:h-10" />
            </div>

            <div>
              <span className="text-xs font-deco tracking-widest text-[#d4af37] uppercase bg-[#1a0f0d] px-3 py-1 rounded border border-[#d4af37]/40">
                Case Solved!
              </span>
              <h2 className="font-deco font-black text-2xl sm:text-3xl text-[#f4e4bc] mt-2 uppercase tracking-wider">
                {winner.name.toUpperCase()} WINS!
              </h2>
              <p className="text-xs sm:text-sm font-serif-vintage italic text-[#baa479] mt-1">
                Playing as <strong className="text-[#d4af37] not-italic">{winner.character}</strong>
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#9b111e]/20 border-2 border-[#9b111e] flex items-center justify-center text-red-500 shadow-xl">
              <Skull className="w-8 h-8 sm:w-10 sm:h-10" />
            </div>

            <div>
              <span className="text-xs font-deco tracking-widest text-red-400 uppercase bg-[#1a0f0d] px-3 py-1 rounded border border-[#9b111e]/60">
                Case Unsolved
              </span>
              <h2 className="font-deco font-black text-2xl sm:text-3xl text-red-300 mt-2 uppercase tracking-wider">
                THE MURDERER ESCAPED!
              </h2>
              <p className="text-xs font-serif-vintage italic text-[#baa479] mt-1">
                All active detectives made false accusations and were eliminated.
              </p>
            </div>
          </>
        )}

        {/* Revealed True Murder Envelope Solution Cards */}
        {suspectCard && weaponCard && roomCard && (
          <div className="w-full bg-[#150a08] p-4 rounded-xl border border-[#d4af37]/30 space-y-3">
            <div className="flex items-center justify-between text-left border-b border-[#d4af37]/20 pb-2">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-[#d4af37]" />
                <span className="text-xs font-deco font-bold uppercase tracking-widest text-[#d4af37]">
                  The Murder Envelope Unsealed
                </span>
              </div>
              <span className="text-[10px] font-mono text-[#baa479]">Confidential Solution</span>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-3 justify-items-center">
              <CardView card={suspectCard} size="sm" />
              <CardView card={weaponCard} size="sm" />
              <CardView card={roomCard} size="sm" />
            </div>
          </div>
        )}

        <button
          id="play-again-btn"
          type="button"
          onClick={onPlayAgain}
          className="w-full py-3.5 rounded bg-[#d4af37] hover:bg-[#b8952e] text-[#1a0f0d] font-deco font-bold text-xs uppercase tracking-widest shadow-xl shadow-[#d4af37]/20 flex items-center justify-center space-x-2 transition-all cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Return to Lobby / New Game</span>
        </button>
      </div>
    </div>
  );
};
