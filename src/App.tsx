import React, { useEffect } from 'react';
import { useCluedoGame } from './network/useCluedoGame';
import { LobbyScreen } from './components/LobbyScreen';
import { GameScreen } from './components/GameScreen';
import { AlertCircle, RotateCcw, Loader2, ArrowLeft } from 'lucide-react';

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

  // Safeguard: If stuck in CONNECTING for more than 8 seconds, fail gracefully
  useEffect(() => {
    if (status === 'CONNECTING') {
      const timer = setTimeout(() => {
        actions.leaveGame();
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [status, actions]);

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

      {/* Connecting Spinner with Cancel / Back option */}
      {status === 'CONNECTING' && (
        <div className="flex flex-col items-center justify-center space-y-4 p-8 sm:p-10 rounded-3xl mahogany-panel border-2 border-[#d4af37] shadow-2xl animate-fade-in max-w-md text-center">
          <div className="relative">
            <Loader2 className="w-10 h-10 text-[#d4af37] animate-spin" />
            <span className="absolute inset-0 rounded-full border-2 border-[#d4af37]/20 animate-ping" />
          </div>
          <div>
            <h3 className="font-deco font-bold text-lg text-[#fff4d1] tracking-wide">
              Connecting to Investigation Room...
            </h3>
            <p className="text-xs font-mono text-[#baa479] mt-1">
              Synchronizing with Authoritative Server Relay
            </p>
          </div>
          <button
            type="button"
            onClick={actions.leaveGame}
            className="mt-2 px-4 py-2 rounded-lg bg-[#251610] hover:bg-[#3d2013] text-[#d4af37] border border-[#d4af37]/40 text-xs font-deco uppercase tracking-wider flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Cancel & Return</span>
          </button>
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
