import React, { useEffect } from 'react';
import { MaskedPlayer } from '../../types/cluedo';
import confetti from 'canvas-confetti';
import { Trophy, Skull, RotateCcw, Home } from 'lucide-react';
import { sounds } from '../../utils/audio';

interface GameOverModalProps {
  winner: MaskedPlayer | null;
  onPlayAgain: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  winner,
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in">
      <div
        id="game-over-modal"
        className="relative w-full max-w-lg rounded-2xl bg-[#251610] border-2 border-[#d4af37] p-8 shadow-[0_16px_48px_rgba(0,0,0,0.9)] text-[#f4e4bc] flex flex-col items-center text-center space-y-6"
      >
        {winner ? (
          <>
            <div className="w-20 h-20 rounded-full bg-[#d4af37]/20 border-2 border-[#d4af37] flex items-center justify-center text-[#d4af37] shadow-xl">
              <Trophy className="w-10 h-10" />
            </div>

            <div>
              <span className="text-xs font-deco tracking-widest text-[#d4af37] uppercase bg-[#1a0f0d] px-3 py-1 rounded border border-[#d4af37]/40">
                Case Solved!
              </span>
              <h2 className="font-deco font-black text-3xl text-[#f4e4bc] mt-3 uppercase tracking-wider">
                {winner.name.toUpperCase()} WINS!
              </h2>
              <p className="text-sm font-serif-vintage italic text-[#baa479] mt-1">
                Playing as <strong className="text-[#d4af37] not-italic">{winner.character}</strong>
              </p>
            </div>

            <p className="text-xs font-serif-vintage italic text-[#baa479] max-w-sm">
              The murderer was apprehended and the crime at Boddy Manor has been definitively unraveled!
            </p>
          </>
        ) : (
          <>
            <div className="w-20 h-20 rounded-full bg-[#9b111e]/20 border-2 border-[#9b111e] flex items-center justify-center text-red-500 shadow-xl">
              <Skull className="w-10 h-10" />
            </div>

            <div>
              <span className="text-xs font-deco tracking-widest text-red-400 uppercase bg-[#1a0f0d] px-3 py-1 rounded border border-[#9b111e]/60">
                Case Unsolved
              </span>
              <h2 className="font-deco font-black text-3xl text-red-300 mt-3 uppercase tracking-wider">
                THE MURDERER ESCAPED!
              </h2>
              <p className="text-xs font-serif-vintage italic text-[#baa479] mt-2">
                All active detectives made false accusations and were eliminated from solving the crime.
              </p>
            </div>
          </>
        )}

        <button
          id="play-again-btn"
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
