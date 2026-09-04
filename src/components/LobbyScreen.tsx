import React, { useState, useEffect } from 'react';
import {
  ALL_SUSPECTS,
  MaskedGameState,
  MaskedPlayer,
  SUSPECT_COLORS,
  Suspect,
} from '../types/cluedo';
import { CHARACTER_DETAILS } from '../engine/assets';
import {
  Copy,
  Check,
  Bot,
  Play,
  UserPlus,
  Users,
  Shield,
  Sparkles,
  ArrowRight,
  BookOpen,
} from 'lucide-react';
import { sounds } from '../utils/audio';

interface LobbyScreenProps {
  gameState: MaskedGameState | null;
  isHost: boolean;
  myPeerId: string;
  roomCode: string;
  onCreateRoom: (character: Suspect, name: string) => void;
  onJoinRoom: (code: string, character: Suspect, name: string) => void;
  onSelectCharacter: (char: Suspect) => void;
  onAddBot: (char: Suspect) => void;
  onRemovePlayer: (peerId: string) => void;
  onStartMatch: () => void;
  onOpenNotebook?: () => void;
}

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  gameState,
  isHost,
  myPeerId,
  roomCode,
  onCreateRoom,
  onJoinRoom,
  onSelectCharacter,
  onAddBot,
  onRemovePlayer,
  onStartMatch,
}) => {
  const [tab, setTab] = useState<'HOST' | 'JOIN'>('HOST');
  const [playerName, setPlayerName] = useState<string>('Detective Holmes');
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');
  const [selectedCharacter, setSelectedCharacter] = useState<Suspect>('Miss Scarlet');
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Check URL query parameters for ?join=CODE or ?room=CODE or ?code=CODE
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const joinParam = urlParams.get('join') || urlParams.get('room') || urlParams.get('code');
    if (joinParam) {
      setJoinCodeInput(joinParam.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
      setTab('JOIN');
    }
  }, []);

  const handleCopyInvite = () => {
    sounds.playPencilMark();
    const inviteUrl = `${window.location.origin}${window.location.pathname}?join=${roomCode}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // If already in a lobby session:
  if (gameState && gameState.phase === 'LOBBY') {
    const joinedCharacters = new Set(gameState.players.map((p) => p.character));
    const availableCharacters = ALL_SUSPECTS.filter((s) => !joinedCharacters.has(s));
    const canStart = isHost && gameState.players.length >= 2;

    return (
      <div
        id="lobby-active-screen"
        className="relative w-full max-w-5xl mx-auto rounded-3xl mahogany-panel border-2 border-[#d4af37] p-6 sm:p-8 shadow-2xl flex flex-col space-y-6 animate-fade-in"
      >
        {/* Header with Room Code & Invite Link */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-[#d4af37]/30 pb-6">
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-deco uppercase tracking-[0.2em] text-[#d4af37] font-bold">
                Server-Authoritative Match Lobby • Real-Time Sync
              </span>
            </div>
            <h2 className="font-deco font-black text-2xl sm:text-3xl text-[#f4e4bc] mt-1 tracking-wider">
              BODDY MANOR INVESTIGATION
            </h2>
            <p className="text-xs text-[#baa479] font-serif-vintage italic">
              Assemble the detectives to open the case file and seal the Murder Envelope.
            </p>
          </div>

          {/* Room Code Badge */}
          <div className="flex items-center space-x-3 bg-[#1a0f0d] border-2 border-[#d4af37] rounded-xl px-5 py-3 shadow-[0_4px_16px_rgba(0,0,0,0.6)]">
            <div className="text-right">
              <span className="text-[10px] font-deco text-[#baa479] block uppercase tracking-widest">Room Code</span>
              <span className="font-mono font-black text-2xl text-[#d4af37] tracking-widest">
                {roomCode}
              </span>
            </div>

            <button
              id="copy-invite-btn"
              onClick={handleCopyInvite}
              className="p-2.5 rounded-lg bg-[#251610] hover:bg-[#3d2013] text-[#d4af37] border border-[#d4af37]/40 flex items-center space-x-1.5 transition-all cursor-pointer shadow"
              title="Copy Direct Join Link"
            >
              {copiedLink ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-mono text-emerald-400 font-bold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span className="text-xs font-deco tracking-wider font-bold">Copy Link</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 6 Suspect Slots Grid */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-deco font-bold text-base text-[#f4e4bc] flex items-center space-x-2 tracking-wide">
              <Users className="w-4 h-4 text-[#d4af37]" />
              <span>Suspect Registry ({gameState.players.length} / 6 Assembled)</span>
            </h3>
            <span className="text-xs font-serif-vintage italic text-[#baa479]">
              Requires 2–6 detectives to initiate case
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {ALL_SUSPECTS.map((suspect) => {
              const player = gameState.players.find((p) => p.character === suspect);
              const isMe = player?.peerId === myPeerId;
              const color = SUSPECT_COLORS[suspect];

              if (player) {
                return (
                  <div
                    key={suspect}
                    className={`p-4 rounded-xl border-2 flex items-center justify-between transition-all ${
                      isMe
                        ? 'bg-[#251610] border-[#d4af37] shadow-[0_0_15px_rgba(212,175,55,0.25)] ring-2 ring-[#d4af37]/50'
                        : 'bg-[#1a0f0d] border-[#d4af37]/20'
                    }`}
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <div
                        className="w-10 h-10 rounded-full border-2 border-[#d4af37] flex items-center justify-center text-white font-bold text-sm shadow flex-shrink-0"
                        style={{ backgroundColor: color.hex }}
                      >
                        {suspect.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-bold text-sm text-[#f4e4bc] truncate">
                            {player.name}
                          </span>
                          {player.isHost && (
                            <span className="px-1.5 py-0.5 rounded bg-[#d4af37]/20 text-[9px] font-mono text-[#d4af37] border border-[#d4af37]/40">
                              HOST
                            </span>
                          )}
                          {player.isAi && (
                            <span className="px-1.5 py-0.5 rounded bg-[#9b111e]/20 text-[9px] font-mono text-red-300 border border-[#9b111e]/40">
                              BOT
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#baa479] truncate font-serif-vintage italic">{suspect}</p>
                      </div>
                    </div>

                    {isHost && !player.isHost && (
                      <button
                        onClick={() => onRemovePlayer(player.peerId)}
                        className="text-xs text-red-400 hover:text-red-300 hover:underline font-mono px-2 py-1"
                      >
                        Kick
                      </button>
                    )}
                  </div>
                );
              }

              // Empty Slot
              return (
                <div
                  key={suspect}
                  className="p-4 rounded-xl border border-dashed border-[#d4af37]/30 bg-[#1a0f0d]/50 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3 opacity-60">
                    <div
                      className="w-10 h-10 rounded-full border border-[#d4af37]/30 flex items-center justify-center text-white/50 text-xs font-mono"
                      style={{ backgroundColor: `${color.hex}33` }}
                    >
                      {suspect.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-xs text-[#baa479]">{suspect}</p>
                      <p className="text-[10px] text-[#8a6e4d] italic">Unclaimed</p>
                    </div>
                  </div>

                  {isHost && (
                    <button
                      type="button"
                      onClick={() => onAddBot(suspect)}
                      className="px-2.5 py-1.5 rounded bg-[#251610] hover:bg-[#3d2013] text-[#d4af37] border border-[#d4af37]/30 text-xs font-deco uppercase tracking-wider flex items-center space-x-1 transition-colors cursor-pointer"
                    >
                      <Bot className="w-3.5 h-3.5" />
                      <span>Add Bot</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Start Game Footer Banner */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-[#d4af37]/30 pt-6">
          <div className="text-xs font-serif-vintage text-[#baa479]">
            {isHost ? (
              canStart ? (
                <span className="text-[#d4af37] font-bold">
                  ✓ Ready to begin! Click Start Match to deal cards.
                </span>
              ) : (
                <span className="text-amber-400">
                  Add at least 1 more player or AI bot to begin.
                </span>
              )
            ) : (
              <span className="italic">Waiting for the Host to start the investigation...</span>
            )}
          </div>

          {isHost && (
            <button
              id="start-match-btn"
              disabled={!canStart}
              onClick={onStartMatch}
              className={`px-8 py-3.5 rounded font-deco font-bold text-xs uppercase tracking-widest flex items-center space-x-2 transition-all ${
                canStart
                  ? 'bg-[#d4af37] hover:bg-[#b8952e] text-[#1a0f0d] shadow-xl shadow-[#d4af37]/30 cursor-pointer animate-pulse-glow'
                  : 'bg-[#251610] text-[#5c3e29] border border-[#3b2012] cursor-not-allowed'
              }`}
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Seal Envelope & Start Match</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // Pre-game Setup Screen (Create or Join)
  return (
    <div
      id="lobby-setup-screen"
      className="relative w-full max-w-2xl mx-auto rounded-3xl mahogany-panel border-2 border-[#d4af37] p-6 sm:p-10 shadow-2xl flex flex-col space-y-6 animate-fade-in"
    >
      {/* Title & Introduction */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#1a0f0d] border border-[#d4af37]/50 text-xs font-deco tracking-widest uppercase text-[#d4af37] mb-1">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Worldwide Multiplayer • Real-Time Cross-Network Sync</span>
        </div>
        <h1 className="font-deco font-black text-3xl sm:text-4xl text-[#f4e4bc] tracking-wider uppercase">
          CLUEDO: BODDY MANOR
        </h1>
        <p className="text-xs sm:text-sm font-serif-vintage italic text-[#e6c88b] max-w-md mx-auto">
          Six prominent guests. Nine lavish rooms. Six deadly weapons. One murder. Unravel the crime before your fellow detectives.
        </p>
      </div>

      {/* Host / Join Tabs */}
      <div className="flex rounded-xl bg-[#1a0f0d] p-1 border border-[#d4af37]/30">
        <button
          type="button"
          onClick={() => setTab('HOST')}
          className={`flex-1 py-2.5 rounded-lg font-deco font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
            tab === 'HOST'
              ? 'bg-[#d4af37] text-[#1a0f0d] shadow'
              : 'text-[#baa479] hover:text-[#f4e4bc]'
          }`}
        >
          Host New Investigation
        </button>
        <button
          type="button"
          onClick={() => setTab('JOIN')}
          className={`flex-1 py-2.5 rounded-lg font-deco font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
            tab === 'JOIN'
              ? 'bg-[#d4af37] text-[#1a0f0d] shadow'
              : 'text-[#baa479] hover:text-[#f4e4bc]'
          }`}
        >
          Join Existing Room
        </button>
      </div>

      {/* Name Input */}
      <div className="space-y-1.5">
        <label className="text-xs font-deco uppercase tracking-wider text-[#d4af37] font-bold">
          Detective Pseudonym / Name
        </label>
        <input
          id="player-name-input"
          type="text"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          placeholder="e.g. Detective Holmes"
          maxLength={20}
          className="w-full px-4 py-2.5 bg-[#1a0f0d] border border-[#d4af37]/40 rounded-xl text-sm text-[#f4e4bc] focus:outline-none focus:border-[#d4af37]"
        />
      </div>

      {/* Join Code Input (if joining) */}
      {tab === 'JOIN' && (
        <div className="space-y-1.5">
          {joinCodeInput && (
            <div className="p-2.5 rounded-xl bg-[#251610] border border-[#d4af37]/50 flex items-center justify-between text-xs font-mono text-[#f4e4bc] animate-fade-in">
              <span className="flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Invited to Room: <strong className="text-[#d4af37] font-bold">{joinCodeInput}</strong></span>
              </span>
              <span className="text-[10px] text-[#baa479] font-serif-vintage italic">Direct Invite Loaded</span>
            </div>
          )}
          <label className="text-xs font-deco uppercase tracking-wider text-[#d4af37] font-bold">
            6-Character Room Code
          </label>
          <input
            id="join-code-input"
            type="text"
            value={joinCodeInput}
            onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase().slice(0, 6))}
            placeholder="e.g. 9X2YAB"
            maxLength={6}
            className="w-full px-4 py-2.5 bg-[#1a0f0d] border border-[#d4af37]/40 rounded-xl font-mono text-lg font-bold text-[#d4af37] tracking-widest focus:outline-none focus:border-[#d4af37]"
          />
        </div>
      )}

      {/* Character Selection */}
      <div className="space-y-2">
        <label className="text-xs font-deco uppercase tracking-wider text-[#d4af37] font-bold">
          Choose Your Persona
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {ALL_SUSPECTS.map((suspect) => {
            const isSelected = selectedCharacter === suspect;
            const color = SUSPECT_COLORS[suspect];
            const detail = CHARACTER_DETAILS[suspect];

            return (
              <button
                key={suspect}
                type="button"
                onClick={() => setSelectedCharacter(suspect)}
                className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#251610] border-[#d4af37] ring-2 ring-[#d4af37]/60 shadow-[0_0_12px_rgba(212,175,55,0.3)]'
                    : 'bg-[#1a0f0d] border-[#d4af37]/20 hover:border-[#d4af37]/50'
                }`}
              >
                <div className="flex items-center space-x-2 mb-1">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-[10px] shadow"
                    style={{ backgroundColor: color.hex }}
                  >
                    {suspect.charAt(0)}
                  </div>
                  <span className="font-bold text-xs text-[#f4e4bc] truncate">{suspect}</span>
                </div>
                <p className="text-[10px] font-serif-vintage italic text-[#baa479] line-clamp-1">
                  {detail.title}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Submit Button */}
      <div className="pt-2">
        {tab === 'HOST' ? (
          <button
            id="create-room-btn"
            type="button"
            disabled={!playerName.trim()}
            onClick={() => onCreateRoom(selectedCharacter, playerName.trim())}
            className="w-full py-3.5 rounded font-deco font-bold text-xs uppercase tracking-widest bg-[#d4af37] hover:bg-[#b8952e] text-[#1a0f0d] shadow-xl shadow-[#d4af37]/20 flex items-center justify-center space-x-2 transition-all cursor-pointer"
          >
            <span>Create Master Investigation Room</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            id="join-room-btn"
            type="button"
            disabled={!playerName.trim() || joinCodeInput.length < 4}
            onClick={() => onJoinRoom(joinCodeInput, selectedCharacter, playerName.trim())}
            className="w-full py-3.5 rounded font-deco font-bold text-xs uppercase tracking-widest bg-[#d4af37] hover:bg-[#b8952e] text-[#1a0f0d] shadow-xl shadow-[#d4af37]/20 flex items-center justify-center space-x-2 transition-all cursor-pointer"
          >
            <span>Join Detective Match</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
