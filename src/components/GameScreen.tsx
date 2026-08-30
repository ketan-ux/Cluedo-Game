import React, { useState } from 'react';
import {
  Card,
  DisprovedCardPayload,
  MaskedGameState,
  MaskedPlayer,
  Room,
  Suspect,
  Weapon,
} from '../types/cluedo';
import { MansionBoard } from './board/MansionBoard';
import { CommandPanel } from './ui/CommandPanel';
import { HandTray } from './ui/HandTray';
import { DetectiveNotebook } from './ui/DetectiveNotebook';
import { SuggestionModal } from './ui/SuggestionModal';
import { DisproveModal } from './ui/DisproveModal';
import { DisprovedRevealOverlay } from './ui/DisprovedRevealOverlay';
import { AccusationModal } from './ui/AccusationModal';
import { GameOverModal } from './ui/GameOverModal';
import { BookOpen, LogOut, Sparkles, ArrowRight } from 'lucide-react';

interface GameScreenProps {
  gameState: MaskedGameState;
  myPlayer?: MaskedPlayer;
  myHand: Card[];
  isHost: boolean;
  disprovedCardReveal: DisprovedCardPayload | null;
  onRollDice: () => void;
  onMoveToken: (x: number, y: number) => void;
  onUseSecretPassage: (targetRoom: Room) => void;
  onMakeSuggestion: (suspect: Suspect, weapon: Weapon) => void;
  onDisproveCard: (cardId: string) => void;
  onMakeAccusation: (suspect: Suspect, weapon: Weapon, room: Room) => void;
  onEndTurn: () => void;
  onSendChat: (text: string) => void;
  onLeaveGame: () => void;
  onCloseDisprovedReveal: () => void;
}

export const GameScreen: React.FC<GameScreenProps> = ({
  gameState,
  myPlayer,
  myHand,
  isHost,
  disprovedCardReveal,
  onRollDice,
  onMoveToken,
  onUseSecretPassage,
  onMakeSuggestion,
  onDisproveCard,
  onMakeAccusation,
  onEndTurn,
  onSendChat,
  onLeaveGame,
  onCloseDisprovedReveal,
}) => {
  const [isNotebookOpen, setIsNotebookOpen] = useState(false);
  const [isSuggestionOpen, setIsSuggestionOpen] = useState(false);
  const [isAccusationOpen, setIsAccusationOpen] = useState(false);
  const [dismissedSuggestionTurn, setDismissedSuggestionTurn] = useState<number | null>(null);

  const activePlayer = gameState.players[gameState.activePlayerIndex];
  const isMyTurn = myPlayer?.peerId === activePlayer?.peerId;

  // Next player in turn order
  const numPlayers = gameState.players.length;
  let nextIdx = (gameState.activePlayerIndex + 1) % numPlayers;
  let attempts = 0;
  while (gameState.players[nextIdx]?.hasAccusedWrongly && attempts < numPlayers) {
    nextIdx = (nextIdx + 1) % numPlayers;
    attempts++;
  }
  const nextPlayer = gameState.players[nextIdx];

  // Check if I am the queried disprover
  const amIPendingDisprover =
    gameState.phase === 'DISPROVE' &&
    gameState.pendingDisproverIndex !== null &&
    gameState.players[gameState.pendingDisproverIndex]?.peerId === myPlayer?.peerId;

  // Current room of active player
  const currentRoom = activePlayer?.position.room;

  // Compute if suggestion modal should be open
  const shouldOpenSuggestion =
    isSuggestionOpen ||
    (isMyTurn &&
      gameState.phase === 'SUGGEST' &&
      dismissedSuggestionTurn !== gameState.turnNumber &&
      !!currentRoom);

  return (
    <div
      id="game-screen"
      className="relative w-full h-screen flex flex-col overflow-hidden bg-[#0d0705] text-[#f4ecd8] select-none"
    >
      {/* Top Navigation Bar */}
      <header className="h-12 border-b border-[#3d2315] bg-[#1a0e08]/90 px-4 flex items-center justify-between z-20 flex-shrink-0">
        <div className="flex items-center space-x-3">
          <span className="font-deco font-black text-base tracking-wider text-[#d4af37]">
            CLUEDO
          </span>
          <span className="text-xs font-mono text-[#baa479] hidden sm:inline">
            1920s Noir Manor • Room #{gameState.roomCode}
          </span>
        </div>

        <div className="flex items-center space-x-3">
          {/* Quick Notebook Trigger */}
          <button
            id="top-notebook-btn"
            onClick={() => setIsNotebookOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-[#2b170e] hover:bg-[#3d2013] text-[#f3e5ab] border border-[#d4af37]/60 font-mono text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer shadow"
          >
            <BookOpen className="w-3.5 h-3.5 text-[#d4af37]" />
            <span>Detective Ledger (N)</span>
          </button>

          {/* Leave / Return */}
          <button
            onClick={onLeaveGame}
            className="p-1.5 rounded-lg bg-[#2b170e] hover:bg-[#3d2013] text-[#baa479] hover:text-white border border-[#4a2e18] transition-colors"
            title="Leave Match"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Play Area */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden p-2 sm:p-3 gap-3">
        {/* Left / Center: Board Viewport + Bottom Hand Tray */}
        <section className="flex-1 flex flex-col justify-between items-center overflow-y-auto space-y-2">
          {/* 1:1 Mansion Board */}
          <div className="flex-1 flex items-center justify-center w-full min-h-0">
            <MansionBoard
              gameState={gameState}
              myPlayer={myPlayer}
              isMyTurn={isMyTurn}
              onTileClick={(x, y) => onMoveToken(x, y)}
              onSecretPassageClick={(targetRoom) => onUseSecretPassage(targetRoom)}
            />
          </div>

          {/* On-Board Turn Completed Action Bar when Actions are Done */}
          {isMyTurn && gameState.phase === 'ACCUSE' && (
            <div className="w-full max-w-xl p-2.5 rounded-xl bg-gradient-to-r from-[#22120b] via-[#351a0e] to-[#22120b] border-2 border-[#d4af37] shadow-[0_6px_24px_rgba(0,0,0,0.85)] flex items-center justify-between gap-3 animate-fade-in flex-shrink-0">
              <div className="flex items-center space-x-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-[#d4af37]/20 border border-[#d4af37] flex items-center justify-center text-[#d4af37] flex-shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-deco font-bold text-[#f4e4bc] uppercase tracking-wider truncate">
                    Turn Actions Done
                  </p>
                  <p className="text-[10px] text-[#baa479] font-serif-vintage italic truncate">
                    Pass turn to <strong className="text-[#d4af37] not-italic">{nextPlayer?.name || 'next player'}</strong> ({nextPlayer?.character})
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 flex-shrink-0">
                <button
                  onClick={() => setIsAccusationOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-[#9b111e] hover:bg-[#b81424] text-white font-deco font-bold text-[10px] uppercase tracking-wider border border-[#d4af37]/40 transition-colors cursor-pointer"
                  title="Make a Final Accusation"
                >
                  Accuse
                </button>
                <button
                  id="board-pass-turn-btn"
                  onClick={onEndTurn}
                  className="px-4 py-1.5 rounded-lg bg-[#d4af37] hover:bg-[#e6c24d] text-[#1a0f0d] font-deco font-black text-xs uppercase tracking-wider shadow-lg shadow-[#d4af37]/30 flex items-center space-x-1.5 transition-all cursor-pointer transform hover:scale-105 active:scale-95"
                >
                  <span>Pass Turn</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Bottom Docked Hand Tray */}
          <div className="w-full flex-shrink-0">
            <HandTray
              hand={myHand}
              onOpenNotebook={() => setIsNotebookOpen(true)}
            />
          </div>
        </section>

        {/* Right Docking Command & Transcript Panel */}
        <aside className="w-full lg:w-[420px] h-[340px] lg:h-full flex-shrink-0">
          <CommandPanel
            gameState={gameState}
            myPlayer={myPlayer}
            isMyTurn={isMyTurn}
            onRollDice={onRollDice}
            onOpenSuggestion={() => setIsSuggestionOpen(true)}
            onOpenAccusation={() => setIsAccusationOpen(true)}
            onOpenNotebook={() => setIsNotebookOpen(true)}
            onEndTurn={onEndTurn}
            onSendChat={onSendChat}
            onSecretPassage={(room) => onUseSecretPassage(room)}
          />
        </aside>
      </main>

      {/* Modals & Overlays */}
      {/* 1. Detective Notebook */}
      <DetectiveNotebook
        isOpen={isNotebookOpen}
        onClose={() => setIsNotebookOpen(false)}
        myHand={myHand}
        players={gameState.players}
        myPeerId={myPlayer?.peerId}
      />

      {/* 2. Suggestion Modal */}
      {currentRoom && (
        <SuggestionModal
          isOpen={shouldOpenSuggestion}
          currentRoom={currentRoom}
          onSuggest={(suspect, weapon) => {
            setIsSuggestionOpen(false);
            setDismissedSuggestionTurn(gameState.turnNumber);
            onMakeSuggestion(suspect, weapon);
          }}
          onPass={() => {
            setIsSuggestionOpen(false);
            setDismissedSuggestionTurn(gameState.turnNumber);
          }}
          onSkipAndEndTurn={() => {
            setIsSuggestionOpen(false);
            setDismissedSuggestionTurn(gameState.turnNumber);
            onEndTurn();
          }}
        />
      )}

      {/* 3. Disprove Modal for Queried Defender */}
      <DisproveModal
        isOpen={amIPendingDisprover}
        suggestion={gameState.currentSuggestion}
        myHand={myHand}
        onDisprove={(cardId) => onDisproveCard(cardId)}
      />

      {/* 4. Disproved Reveal Inspection Overlay for Suggester */}
      <DisprovedRevealOverlay
        payload={disprovedCardReveal}
        onClose={onCloseDisprovedReveal}
        onOpenNotebook={() => setIsNotebookOpen(true)}
        onEndTurn={onEndTurn}
      />

      {/* 5. Accusation Modal */}
      <AccusationModal
        isOpen={isAccusationOpen}
        onAccuse={(suspect, weapon, room) => {
          setIsAccusationOpen(false);
          onMakeAccusation(suspect, weapon, room);
        }}
        onClose={() => setIsAccusationOpen(false)}
      />

      {/* 6. Game Over Win/Loss Celebration Modal */}
      {gameState.phase === 'GAME_OVER' && (
        <GameOverModal
          winner={gameState.winner}
          onPlayAgain={onLeaveGame}
        />
      )}
    </div>
  );
};
