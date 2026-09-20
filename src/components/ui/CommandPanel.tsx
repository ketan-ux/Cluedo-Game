import React, { useState, useRef, useEffect } from 'react';
import {
  GameLogEntry,
  MaskedGameState,
  MaskedPlayer,
  Room,
  SECRET_PASSAGES,
  SUSPECT_COLORS,
} from '../../types/cluedo';
import {
  Dices,
  Send,
  BookOpen,
  AlertTriangle,
  Sparkles,
  ChevronRight,
  Shield,
  MessageSquare,
  Scroll,
  Volume2,
  VolumeX,
  ArrowRight,
  UserCheck,
  Eye,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { sounds } from '../../utils/audio';

interface CommandPanelProps {
  gameState: MaskedGameState;
  myPlayer?: MaskedPlayer;
  isMyTurn: boolean;
  onRollDice: () => void;
  onOpenSuggestion: () => void;
  onOpenAccusation: () => void;
  onOpenNotebook: () => void;
  onEndTurn: () => void;
  onSendChat: (text: string) => void;
  onSecretPassage?: (targetRoom: Room) => void;
  onInspectEnvelope?: () => void;
}

export const CommandPanel: React.FC<CommandPanelProps> = ({
  gameState,
  myPlayer,
  isMyTurn,
  onRollDice,
  onOpenSuggestion,
  onOpenAccusation,
  onOpenNotebook,
  onEndTurn,
  onSendChat,
  onSecretPassage,
  onInspectEnvelope,
}) => {
  const [chatInput, setChatInput] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const activePlayer = gameState.players[gameState.activePlayerIndex];
  const isEliminated = myPlayer?.hasAccusedWrongly;

  // Next player in turn order
  const numPlayers = gameState.players.length;
  let nextIdx = (gameState.activePlayerIndex + 1) % numPlayers;
  let attempts = 0;
  while (gameState.players[nextIdx]?.hasAccusedWrongly && attempts < numPlayers) {
    nextIdx = (nextIdx + 1) % numPlayers;
    attempts++;
  }
  const nextPlayer = gameState.players[nextIdx];

  // Secret passage availability
  const currentRoom = myPlayer?.position.room;
  const secretPassageTarget = currentRoom ? SECRET_PASSAGES[currentRoom] : null;
  const canUseSecretPassage =
    isMyTurn &&
    gameState.phase === 'ROLL' &&
    !!secretPassageTarget &&
    !isEliminated;

  // Auto-scroll logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [gameState.logs]);

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatInput.trim()) {
      onSendChat(chatInput.trim());
      setChatInput('');
    }
  };

  const toggleAudio = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    sounds.enabled = next;
  };

  const renderLogIcon = (type: GameLogEntry['type']) => {
    switch (type) {
      case 'ROLL':
        return <Dices className="w-4 h-4 text-[#d4af37]" />;
      case 'MOVE':
        return <ChevronRight className="w-4 h-4 text-amber-300" />;
      case 'PASSAGE':
        return <Sparkles className="w-4 h-4 text-yellow-300" />;
      case 'SUGGEST':
        return <Shield className="w-4 h-4 text-emerald-400" />;
      case 'DISPROVE':
        return <Scroll className="w-4 h-4 text-[#d4af37]" />;
      case 'NO_DISPROVE':
        return <Sparkles className="w-4 h-4 text-amber-400" />;
      case 'ACCUSE':
      case 'FAIL_ACCUSE':
        return <AlertTriangle className="w-4 h-4 text-[#9b111e]" />;
      case 'WIN':
        return <Sparkles className="w-4 h-4 text-yellow-300" />;
      case 'CHAT':
        return <MessageSquare className="w-4 h-4 text-[#d4af37]" />;
      default:
        return <span className="text-xs text-[#d4af37]">•</span>;
    }
  };

  return (
    <div
      id="command-panel"
      className="w-full lg:w-[400px] h-full flex flex-col rounded-xl bg-[#251610] border-2 border-[#d4af37]/40 shadow-[0_12px_36px_rgba(0,0,0,0.85)] overflow-hidden"
    >
      {/* 1. Header & Active Turn Banner */}
      <div className="p-3.5 border-b border-[#d4af37]/30 bg-[#1a0f0d] flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {activePlayer && (
            <div
              className="w-10 h-10 rounded-full border-2 border-[#d4af37] flex items-center justify-center text-white font-deco font-bold text-sm shadow-[0_0_10px_rgba(212,175,55,0.4)]"
              style={{ backgroundColor: SUSPECT_COLORS[activePlayer.character]?.hex || '#9b111e' }}
            >
              {activePlayer.character.charAt(0)}
            </div>
          )}
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-deco font-bold text-sm text-[#f4e4bc] uppercase tracking-wider">
                {activePlayer?.name || 'Investigator'}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#1a0f0d] text-[#d4af37] border border-[#d4af37]/40">
                Turn #{gameState.turnNumber}
              </span>
            </div>
            <p className="text-xs text-[#baa479] font-serif-vintage italic">
              {activePlayer?.character} •{' '}
              {activePlayer?.position.room
                ? `In ${activePlayer.position.room}`
                : `Corridor (${activePlayer?.position.x}, ${activePlayer?.position.y})`}
            </p>
          </div>
        </div>

        {/* Audio Mute Button */}
        <button
          onClick={toggleAudio}
          className="p-2 rounded bg-[#1a0f0d] hover:bg-[#3d2013] text-[#d4af37] border border-[#d4af37]/30 transition-colors"
          title={soundEnabled ? 'Mute SFX' : 'Enable SFX'}
        >
          {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-[#9b111e]" />}
        </button>
      </div>

      {/* 2. Turn Status Bar */}
      <div className="px-4 py-2 bg-[#2d1b10] border-b border-[#d4af37]/20 flex items-center justify-between text-xs font-serif-vintage">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-[#d4af37] animate-ping" />
          <span className="text-[#f4e4bc]">
            Phase:{' '}
            <strong className="text-[#d4af37] font-deco uppercase tracking-wider">
              {gameState.phase === 'ROLL' && 'Awaiting Dice Roll'}
              {gameState.phase === 'MOVE' && `Moving (${gameState.remainingSteps} steps left)`}
              {gameState.phase === 'SUGGEST' && 'Formulating Suggestion'}
              {gameState.phase === 'DISPROVE' && 'Refuting Evidence'}
              {gameState.phase === 'ACCUSE' && (isMyTurn ? 'Turn Actions Done • Accuse or Pass Turn' : 'Accuse or Pass Turn')}
              {gameState.phase === 'GAME_OVER' && 'Investigation Closed'}
            </strong>
          </span>
        </div>

        {isMyTurn ? (
          <span className="px-2 py-0.5 rounded bg-[#9b111e]/30 text-[#f4e4bc] font-bold border border-[#9b111e] animate-pulse uppercase tracking-wider text-[10px] font-deco">
            YOUR TURN
          </span>
        ) : (
          <span className="text-[#baa479] italic">{activePlayer?.name}'s Turn</span>
        )}
      </div>

      {/* 2.5 Active Detective Roster (Turn Order & Status for all 5-6 Players) */}
      <div className="px-3 py-2 bg-[#1f120c] border-b border-[#d4af37]/20 flex items-center justify-between gap-2 overflow-x-auto">
        <div className="flex items-center space-x-1.5 flex-shrink-0">
          <Users className="w-3.5 h-3.5 text-[#d4af37]" />
          <span className="text-[10px] font-deco uppercase tracking-wider text-[#baa479]">
            Detectives ({gameState.players.length}):
          </span>
        </div>

        <div className="flex items-center space-x-2 flex-nowrap min-w-0">
          {gameState.players.map((player, idx) => {
            const isActive = idx === gameState.activePlayerIndex;
            const isMe = player.peerId === myPlayer?.peerId;
            const isPlayerEliminated = player.hasAccusedWrongly;
            const hexColor = SUSPECT_COLORS[player.character]?.hex || '#9b111e';
            const cardCount = player.hand?.length ?? player.cardCount ?? 3;

            return (
              <div
                key={player.peerId}
                className={`relative flex items-center space-x-1 px-1.5 py-0.5 rounded-lg border transition-all flex-shrink-0 cursor-default ${
                  isActive
                    ? 'bg-[#3d2012] border-[#d4af37] ring-1 ring-[#d4af37] shadow-[0_0_8px_rgba(212,175,55,0.4)]'
                    : isPlayerEliminated
                    ? 'bg-[#150a08] border-red-900/40 opacity-60'
                    : 'bg-[#150d09] border-[#d4af37]/20 hover:border-[#d4af37]/50'
                }`}
                title={`${player.name} (${player.character})${isMe ? ' [YOU]' : ''}${isPlayerEliminated ? ' [ELIMINATED]' : ''} • Cards: ${cardCount} • Location: ${player.position.room || 'Corridor'}`}
              >
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow flex-shrink-0"
                  style={{ backgroundColor: hexColor }}
                >
                  {player.character.charAt(0)}
                </div>

                <span
                  className={`text-[10px] font-deco truncate max-w-[64px] ${
                    isActive
                      ? 'text-[#f4e4bc] font-bold'
                      : isPlayerEliminated
                      ? 'text-red-400 line-through'
                      : 'text-[#baa479]'
                  }`}
                >
                  {isMe ? 'You' : player.name.split(' ')[0]}
                </span>

                <span className="text-[9px] font-mono px-1 rounded bg-[#0d0705] text-[#d4af37]/90 border border-[#d4af37]/30">
                  {cardCount}
                </span>

                {isActive && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#d4af37] animate-ping" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Action Command Center Buttons */}
      <div className="p-3.5 bg-[#1a0f0d] border-b border-[#d4af37]/30 flex flex-col space-y-2.5">
        {/* Eliminated Player Witness Mode Banner */}
        {isEliminated && (
          <div className="p-3 rounded-xl bg-[#1f0d0a] border border-[#9b111e]/80 shadow-md flex flex-col space-y-2 animate-fade-in text-xs">
            <div className="flex items-center space-x-2 text-red-300 font-deco font-bold uppercase tracking-wider">
              <ShieldAlert className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span>Eliminated Detective • Witness Mode</span>
            </div>
            <p className="text-[11px] font-serif-vintage italic text-[#baa479] leading-relaxed">
              Your previous accusation was incorrect. You are out of turn rotation, but remain to refute other players' suggestions with cards from your hand.
            </p>
            {gameState.solution && onInspectEnvelope && (
              <button
                type="button"
                onClick={onInspectEnvelope}
                className="w-full py-2 px-3 rounded bg-[#9b111e]/40 hover:bg-[#9b111e]/70 text-red-200 border border-red-500/50 font-deco text-[11px] font-bold uppercase tracking-wider flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5 text-red-400" />
                <span>View Secret Murder Envelope Cards</span>
              </button>
            )}
          </div>
        )}

        {/* Prominent High-Priority Pass Turn / Accuse Callout when Turn Actions are complete */}
        {isMyTurn && !isEliminated && gameState.phase === 'ACCUSE' && (
          <div className="p-3 rounded-xl bg-gradient-to-r from-[#2b170e] via-[#3a2012] to-[#2b170e] border-2 border-[#d4af37] shadow-[0_4px_20px_rgba(212,175,55,0.25)] flex flex-col space-y-2 animate-fade-in">
            <div className="flex items-center justify-between text-xs">
              <span className="font-deco font-bold text-[#f4e4bc] uppercase tracking-wider flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#d4af37]" />
                <span>Turn Complete</span>
              </span>
              {nextPlayer && (
                <span className="text-[10px] font-mono text-[#d4af37]">
                  Next: {nextPlayer.name} ({nextPlayer.character})
                </span>
              )}
            </div>

            <p className="text-[11px] font-serif-vintage italic text-[#baa479]">
              Movement & suggestion complete. Pass the turn to the next detective or make an accusation.
            </p>

            <div className="flex items-center gap-2 pt-0.5">
              <button
                id="pass-turn-prominent-btn"
                onClick={onEndTurn}
                className="flex-1 py-2.5 px-3 rounded-lg bg-[#d4af37] hover:bg-[#e6c24d] text-[#1a0f0d] font-deco font-black text-xs uppercase tracking-wider shadow-lg shadow-[#d4af37]/30 flex items-center justify-center space-x-2 transition-all cursor-pointer transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <span>Pass Turn to {nextPlayer?.name || 'Next Detective'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={onOpenAccusation}
                className="py-2.5 px-3 rounded-lg bg-[#9b111e] hover:bg-[#b81424] text-white font-deco font-bold text-xs uppercase tracking-wider border border-[#d4af37]/60 shadow flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
                title="Make a Final Accusation"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-300" />
                <span>Accuse</span>
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          {/* Roll Dice Button */}
          <button
            id="roll-dice-btn"
            disabled={!isMyTurn || gameState.phase !== 'ROLL' || isEliminated}
            onClick={onRollDice}
            className={`py-3 px-3 rounded font-deco font-bold text-xs uppercase tracking-widest flex items-center justify-center space-x-2 transition-all ${
              isMyTurn && gameState.phase === 'ROLL' && !isEliminated
                ? 'bg-[#d4af37] hover:bg-[#b8952e] text-[#1a0f0d] shadow-lg shadow-[#d4af37]/30 cursor-pointer animate-pulse-glow'
                : 'bg-[#251610] text-[#5c3e29] border border-[#3b2012] cursor-not-allowed'
            }`}
          >
            <Dices className="w-4 h-4" />
            <span>Roll Dice</span>
          </button>

          {/* Detective Notebook Button */}
          <button
            id="open-notebook-btn"
            onClick={onOpenNotebook}
            className="py-3 px-3 rounded bg-[#251610] hover:bg-[#3a2012] text-[#f4e4bc] border border-[#d4af37]/40 font-deco text-xs font-bold uppercase tracking-widest flex items-center justify-center space-x-2 transition-all cursor-pointer shadow"
          >
            <BookOpen className="w-4 h-4 text-[#d4af37]" />
            <span>Ledger (N)</span>
          </button>
        </div>

        {/* Secret Passage Shortcut Button */}
        {canUseSecretPassage && secretPassageTarget && onSecretPassage && (
          <button
            id="secret-passage-btn"
            onClick={() => onSecretPassage(secretPassageTarget)}
            className="w-full py-2.5 px-3 rounded bg-[#5c3e29] hover:bg-[#785034] text-[#f4e4bc] border-2 border-[#d4af37] font-deco text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-lg animate-bounce"
          >
            <Sparkles className="w-4 h-4 text-[#d4af37]" />
            <span>Secret Passage → {secretPassageTarget}</span>
          </button>
        )}

        {/* Phase Context Banner / Hint when on my turn */}
        {isMyTurn && !isEliminated && gameState.phase === 'MOVE' && (
          <div className="p-2 rounded bg-[#251610] border border-[#d4af37]/40 flex items-center justify-between text-xs">
            <span className="text-[#f4e4bc] font-serif-vintage italic">
              Click a golden tile or room on the board to move.
            </span>
            <button
              onClick={onEndTurn}
              className="px-2.5 py-1 rounded bg-[#3b2012] hover:bg-[#5c321d] text-[#d4af37] text-[10px] font-deco font-bold uppercase tracking-wider border border-[#d4af37]/30 transition-colors cursor-pointer"
            >
              Skip Move
            </button>
          </div>
        )}

        {/* Suggestion / Accusation / End Turn Row */}
        <div className="grid grid-cols-3 gap-2">
          {/* Suggest Button */}
          <button
            id="suggest-btn"
            disabled={
              !isMyTurn ||
              (gameState.phase !== 'SUGGEST' &&
                !(gameState.phase === 'ACCUSE' && !gameState.turnHasSuggested && !!currentRoom)) ||
              !currentRoom ||
              isEliminated
            }
            onClick={onOpenSuggestion}
            className={`py-2.5 px-2 rounded font-deco text-[10px] uppercase tracking-wider font-bold flex items-center justify-center space-x-1 transition-all ${
              isMyTurn && (gameState.phase === 'SUGGEST' || (gameState.phase === 'ACCUSE' && !gameState.turnHasSuggested && !!currentRoom)) && !isEliminated
                ? 'bg-[#2e4a36] hover:bg-[#3c6147] text-[#f4e4bc] border border-emerald-500/50 cursor-pointer shadow'
                : 'bg-[#251610] text-[#5c3e29] border border-[#381f13] cursor-not-allowed'
            }`}
          >
            <span>Suggest</span>
          </button>

          {/* Accuse Button */}
          <button
            id="accuse-btn"
            disabled={!isMyTurn || gameState.phase === 'LOBBY' || gameState.phase === 'GAME_OVER' || isEliminated}
            onClick={onOpenAccusation}
            className={`py-2.5 px-2 rounded font-deco text-[10px] uppercase tracking-wider font-bold flex items-center justify-center space-x-1 transition-all ${
              isMyTurn && !isEliminated
                ? 'bg-[#9b111e] hover:bg-[#b21827] text-white border border-[#d4af37]/50 shadow-[0_0_12px_rgba(155,17,30,0.5)] cursor-pointer'
                : 'bg-[#251610] text-[#5c3e29] border border-[#381f13] cursor-not-allowed'
            }`}
          >
            <AlertTriangle className="w-3 h-3 text-amber-300" />
            <span>Accuse</span>
          </button>

          {/* End Turn Button */}
          <button
            id="end-turn-btn"
            disabled={
              !isMyTurn ||
              gameState.phase === 'DISPROVE' ||
              gameState.phase === 'LOBBY' ||
              gameState.phase === 'GAME_OVER' ||
              isEliminated
            }
            onClick={onEndTurn}
            className={`py-2.5 px-2 rounded font-deco text-[10px] uppercase tracking-wider font-bold flex items-center justify-center space-x-1 transition-all ${
              isMyTurn &&
              gameState.phase !== 'DISPROVE' &&
              gameState.phase !== 'LOBBY' &&
              gameState.phase !== 'GAME_OVER' &&
              !isEliminated
                ? gameState.phase === 'ACCUSE'
                  ? 'bg-[#d4af37] hover:bg-[#b8952e] text-[#1a0f0d] shadow-lg shadow-[#d4af37]/20 font-black cursor-pointer'
                  : 'border border-[#d4af37]/60 text-[#f4e4bc] bg-[#2d1b10] hover:bg-[#3d2516] cursor-pointer shadow'
                : 'bg-[#251610] text-[#5c3e29] border border-[#381f13] cursor-not-allowed'
            }`}
          >
            <span>End Turn</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* 4. Investigation Transcript / Logs */}
      <div className="flex-1 flex flex-col overflow-hidden p-3 space-y-2 bg-[#1a0f0d]">
        <div className="flex items-center justify-between text-[11px] font-serif-vintage text-[#baa479] px-1">
          <span className="font-bold uppercase tracking-[0.2em] text-[#d4af37] flex items-center space-x-1.5 font-deco text-[10px]">
            <Scroll className="w-3.5 h-3.5 text-[#d4af37]" />
            <span>Investigation Transcript</span>
          </span>
          <span className="text-[10px] font-mono">{gameState.logs.length} entries</span>
        </div>

        <div
          ref={logContainerRef}
          className="flex-1 overflow-y-auto space-y-2.5 pr-1 text-sm sm:text-base font-serif-vintage leading-relaxed select-text"
        >
          {gameState.logs.map((log) => (
            <div
              key={log.id}
              className={`p-2.5 rounded-lg border leading-relaxed flex items-start space-x-2.5 ${
                log.type === 'WIN'
                  ? 'bg-[#d4af37]/15 border-[#d4af37] text-[#fff4d1] font-medium'
                  : log.type === 'FAIL_ACCUSE'
                  ? 'bg-[#9b111e]/20 border-[#9b111e] text-[#fca5a5] font-medium'
                  : log.type === 'DISPROVE'
                  ? 'bg-[#5c3e29]/30 border-[#d4af37]/40 text-[#f4e4bc]'
                  : log.type === 'CHAT'
                  ? 'bg-[#251610] border-[#d4af37]/20 text-[#f4e4bc]'
                  : 'bg-[#251610]/60 border-[#381f13] text-[#e8d5b5]'
              }`}
            >
              <div className="mt-0.5 flex-shrink-0">{renderLogIcon(log.type)}</div>
              <div className="min-w-0 flex-1 text-sm sm:text-base leading-relaxed">
                {log.type === 'CHAT' && log.playerName ? (
                  <span className="font-bold text-[#d4af37] mr-1.5 font-deco">[{log.playerName}]:</span>
                ) : null}
                <span>{log.message}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Mini-Chat Input */}
      <form onSubmit={handleChatSubmit} className="p-2.5 bg-[#251610] border-t border-[#d4af37]/30 flex space-x-2">
        <input
          type="text"
          placeholder="Dispatch a telegraph dispatch..."
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          className="flex-1 px-3 py-1.5 bg-[#1a0f0d] border border-[#d4af37]/30 rounded text-xs text-[#f4e4bc] font-serif-vintage focus:outline-none focus:border-[#d4af37]"
        />
        <button
          type="submit"
          disabled={!chatInput.trim()}
          className="px-3 py-1.5 rounded bg-[#d4af37] hover:bg-[#b8952e] text-[#1a0f0d] text-xs font-bold transition-colors cursor-pointer disabled:opacity-40"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};

