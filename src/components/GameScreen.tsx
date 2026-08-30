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
import { BookOpen, LogOut, Sparkles } from 'lucide-react';

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

  const activePlayer = gameState.players[gameState.activePlayerIndex];
  const isMyTurn = myPlayer?.peerId === activePlayer?.peerId;

  // Check if I am the queried disprover
  const amIPendingDisprover =
    gameState.phase === 'DISPROVE' &&
    gameState.pendingDisproverIndex !== null &&
    gameState.players[gameState.pendingDisproverIndex]?.peerId === myPlayer?.peerId;

  // Current room of active player
  const currentRoom = activePlayer?.position.room;

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
      />

      {/* 2. Suggestion Modal */}
      {currentRoom && (
        <SuggestionModal
          isOpen={isSuggestionOpen || (isMyTurn && gameState.phase === 'SUGGEST')}
          currentRoom={currentRoom}
          onSuggest={(suspect, weapon) => {
            setIsSuggestionOpen(false);
            onMakeSuggestion(suspect, weapon);
          }}
          onPass={() => {
            setIsSuggestionOpen(false);
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
