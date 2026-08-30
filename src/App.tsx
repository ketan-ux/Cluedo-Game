import React from 'react';
import { useCluedoGame } from './network/useCluedoGame';
import { LobbyScreen } from './components/LobbyScreen';
import { GameScreen } from './components/GameScreen';
import { AlertCircle, RotateCcw, Loader2 } from 'lucide-react';

export default function App() {
  const {
    maskedState,
    isHost,
    myPeerId,
    myPlayer,
    myHand,
    roomCode,
    status,
    errorMessage,
    disprovedCardReveal,
    accusationReveal,
    actions,
  } = useCluedoGame();

  return (
    <div className="min-h-screen w-full bg-[#0d0705] text-[#f4ecd8] flex flex-col items-center justify-center p-2 sm:p-4 overflow-hidden relative">
      {/* Error Toast Notification */}
      {errorMessage && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 max-w-md w-full p-4 rounded-xl bg-red-950/90 border-2 border-red-600 text-red-200 shadow-2xl flex items-center justify-between space-x-3 animate-fade-in">
          <div className="flex items-center space-x-2 min-w-0">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <span className="text-xs font-mono truncate">{errorMessage}</span>
          </div>
          <button
            onClick={actions.leaveGame}
            className="p-1 rounded-lg bg-red-900 hover:bg-red-800 text-white text-xs font-mono flex items-center space-x-1 flex-shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      )}

      {/* Connecting Spinner */}
      {status === 'CONNECTING' && (
        <div className="flex flex-col items-center justify-center space-y-3 p-8 rounded-2xl mahogany-panel border border-[#d4af37]">
          <Loader2 className="w-8 h-8 text-[#d4af37] animate-spin" />
          <h3 className="font-deco font-bold text-lg text-[#fff4d1]">
            Connecting to Investigation Room...
          </h3>
          <p className="text-xs font-mono text-[#baa479]">
            Establishing Multi-Network Global Relay...
          </p>
        </div>
      )}

      {/* Main Game Screen */}
      {maskedState && maskedState.phase !== 'LOBBY' ? (
        <GameScreen
          gameState={maskedState}
          myPlayer={myPlayer}
          myHand={myHand}
          isHost={isHost}
          disprovedCardReveal={disprovedCardReveal}
          accusationReveal={accusationReveal}
          onRollDice={actions.rollDice}
          onMoveToken={actions.moveToken}
          onUseSecretPassage={actions.useSecretPassage}
          onMakeSuggestion={actions.makeSuggestion}
          onDisproveCard={actions.disproveCard}
          onMakeAccusation={actions.makeAccusation}
          onEndTurn={actions.endTurn}
          onSendChat={actions.sendChatMessage}
          onLeaveGame={actions.leaveGame}
          onCloseDisprovedReveal={actions.closeDisprovedCardReveal}
          onCloseAccusationReveal={actions.closeAccusationReveal}
        />
      ) : status !== 'CONNECTING' ? (
        /* Lobby or Pre-match Setup Screen */
        <LobbyScreen
          gameState={maskedState}
          isHost={isHost}
          myPeerId={myPeerId}
          roomCode={roomCode}
          onCreateRoom={actions.createRoom}
          onJoinRoom={actions.joinRoom}
          onSelectCharacter={actions.selectCharacter}
          onAddBot={actions.addAiBot}
          onRemovePlayer={actions.removePlayer}
          onStartMatch={actions.startMatch}
        />
      ) : null}
    </div>
  );
}

