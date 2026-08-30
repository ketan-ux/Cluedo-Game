import React, { useMemo } from 'react';
import {
  Card,
  MaskedGameState,
  MaskedPlayer,
  Position,
  Room,
  SECRET_PASSAGES,
  SUSPECT_COLORS,
  Suspect,
  Weapon,
} from '../../types/cluedo';
import {
  getDoorwayTarget,
  getRoomAtCoordinate,
  getRoomTokenOffset,
  isCellar,
  isCorridor,
  ROOM_DEFINITIONS,
  RoomDefinition,
} from '../../engine/boardGrid';
import { Sparkles, Key, Compass, Lock } from 'lucide-react';

interface MansionBoardProps {
  gameState: MaskedGameState;
  myPlayer?: MaskedPlayer;
  isMyTurn: boolean;
  onTileClick: (x: number, y: number) => void;
  onSecretPassageClick?: (targetRoom: Room) => void;
}

const BOARD_COLS = 24;
const BOARD_ROWS = 25;

export const MansionBoard: React.FC<MansionBoardProps> = ({
  gameState,
  myPlayer,
  isMyTurn,
  onTileClick,
  onSecretPassageClick,
}) => {
  const activePlayer = gameState.players[gameState.activePlayerIndex];

  // Lookup of valid moves by "x,y"
  const validMoveMap = useMemo(() => {
    const map = new Map<string, { isDoorway?: boolean; targetRoom?: Room }>();
    if (gameState.validMoves && isMyTurn && gameState.phase === 'MOVE') {
      for (const m of gameState.validMoves) {
        map.set(`${m.x},${m.y}`, { isDoorway: m.isDoorway, targetRoom: m.targetRoom });
      }
    }
    return map;
  }, [gameState.validMoves, isMyTurn, gameState.phase]);

  // Group players by room or coordinate
  const { playersByRoom, playersOnCorridor } = useMemo(() => {
    const byRoom: Record<Room, MaskedPlayer[]> = {
      Kitchen: [],
      Ballroom: [],
      Conservatory: [],
      'Dining Room': [],
      'Billiard Room': [],
      Library: [],
      Lounge: [],
      Hall: [],
      Study: [],
    };
    const onCorridor: Record<string, MaskedPlayer[]> = {};

    for (const p of gameState.players) {
      if (p.position.room) {
        byRoom[p.position.room].push(p);
      } else {
        const key = `${p.position.x},${p.position.y}`;
        if (!onCorridor[key]) onCorridor[key] = [];
        onCorridor[key].push(p);
      }
    }

    return { playersByRoom: byRoom, playersOnCorridor: onCorridor };
  }, [gameState.players]);

  // Weapons by room
  const weaponsByRoom = useMemo(() => {
    const byRoom: Record<Room, Weapon[]> = {
      Kitchen: [],
      Ballroom: [],
      Conservatory: [],
      'Dining Room': [],
      'Billiard Room': [],
      Library: [],
      Lounge: [],
      Hall: [],
      Study: [],
    };
    for (const [w, r] of Object.entries(gameState.weaponPositions) as [Weapon, Room][]) {
      if (byRoom[r]) byRoom[r].push(w);
    }
    return byRoom;
  }, [gameState.weaponPositions]);

  // Render individual grid cells (24x25)
  const gridCells = useMemo(() => {
    const cells = [];
    for (let y = 0; y < BOARD_ROWS; y++) {
      for (let x = 0; x < BOARD_COLS; x++) {
        const key = `${x},${y}`;
        const room = getRoomAtCoordinate(x, y);
        const cellar = isCellar(x, y);
        const corridor = isCorridor(x, y);
        const doorway = getDoorwayTarget(x, y);
        const isValidMove = validMoveMap.has(key);
        const playersHere = playersOnCorridor[key] || [];

        // Checkered corridor effect
        const isCheckered = (x + y) % 2 === 0;

        cells.push(
          <div
            key={key}
            id={`tile-${x}-${y}`}
            onClick={() => {
              if (isValidMove) onTileClick(x, y);
            }}
            style={{
              gridColumnStart: x + 1,
              gridRowStart: y + 1,
            }}
            className={`relative flex items-center justify-center aspect-square transition-all duration-200 ${
              room
                ? 'pointer-events-none opacity-0' // Room backgrounds rendered separately
                : cellar
                ? 'pointer-events-none opacity-0'
                : corridor
                ? `${
                    isCheckered
                      ? 'bg-[#e4ceaa]/90 border border-[#bfa275]/40'
                      : 'bg-[#d8be96]/90 border border-[#bfa275]/40'
                  }`
                : 'bg-[#0e0704]/90' // Wall/empty edge
            } ${
              isValidMove
                ? 'cursor-pointer ring-2 ring-[#d4af37] bg-amber-300/60 z-20 animate-pulse-glow shadow-md'
                : ''
            }`}
          >
            {/* Doorway Icon Indicator */}
            {doorway && !room && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-4 h-4 rounded-full bg-[#3d2212] border border-[#d4af37] flex items-center justify-center text-[#d4af37] text-[8px] font-bold shadow">
                  <Key className="w-2.5 h-2.5" />
                </div>
              </div>
            )}

            {/* Corridor Player Pawns */}
            {playersHere.map((p) => {
              const color = SUSPECT_COLORS[p.character];
              const isActive = gameState.players[gameState.activePlayerIndex]?.peerId === p.peerId;

              return (
                <div
                  key={p.peerId}
                  id={`pawn-${p.character.toLowerCase().replace(/[\s.]+/g, '_')}`}
                  className={`absolute z-30 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-white font-bold text-[10px] shadow-lg transition-transform duration-300 ${
                    isActive ? 'scale-125 ring-2 ring-yellow-400 ring-offset-1 ring-offset-black' : ''
                  }`}
                  style={{ backgroundColor: color.hex }}
                  title={`${p.name} (${p.character})`}
                >
                  {p.character.charAt(0)}
                </div>
              );
            })}
          </div>
        );
      }
    }
    return cells;
  }, [validMoveMap, playersOnCorridor, gameState.activePlayerIndex, gameState.players, onTileClick]);

  return (
    <div
      id="mansion-board-container"
      className="relative w-full max-w-[760px] aspect-square rounded-xl p-3 bg-[#251610] border-4 border-[#2d1b10] shadow-[0_16px_48px_rgba(0,0,0,0.9)] overflow-hidden select-none"
    >
      {/* Decorative Gold Inset Frame */}
      <div className="absolute inset-2 border-2 border-[#d4af37]/40 rounded-lg pointer-events-none z-10" />

      {/* Compass Rose Header Motif */}
      <div className="absolute top-3 left-4 z-20 flex items-center space-x-2 text-[#d4af37] text-[10px] font-deco font-bold tracking-[0.2em] pointer-events-none uppercase">
        <Compass className="w-3.5 h-3.5 text-[#d4af37]" />
        <span>BODDY MANOR GROUND FLOOR PLAN • 1926</span>
      </div>

      {/* 24x25 Grid Layer */}
      <div
        className="relative w-full h-full grid grid-cols-24 grid-rows-25 gap-[1px] bg-[#1a0f0d] rounded-md overflow-hidden border border-[#d4af37]/30"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(24, minmax(0, 1fr))',
          gridTemplateRows: 'repeat(25, minmax(0, 1fr))',
        }}
      >
        {/* Render Grid Tiles */}
        {gridCells}

        {/* 9 Themed Room Overlays */}
        {(Object.entries(ROOM_DEFINITIONS) as [Room, RoomDefinition][]).map(([roomName, def]) => {
          const colStart = def.bounds.minX + 1;
          const colSpan = def.bounds.maxX - def.bounds.minX + 1;
          const rowStart = def.bounds.minY + 1;
          const rowSpan = def.bounds.maxY - def.bounds.minY + 1;

          const occupants = playersByRoom[roomName] || [];
          const roomWeapons = weaponsByRoom[roomName] || [];
          const hasSecretPassage = !!def.secretPassageTo;
          const isPlayerInThisRoom = activePlayer?.position.room === roomName;
          const canUsePassage =
            hasSecretPassage &&
            isPlayerInThisRoom &&
            isMyTurn &&
            gameState.phase === 'ROLL' &&
            !activePlayer?.hasAccusedWrongly;

          return (
            <div
              key={roomName}
              id={`room-overlay-${roomName.toLowerCase().replace(/[\s.]+/g, '_')}`}
              style={{
                gridColumn: `${colStart} / span ${colSpan}`,
                gridRow: `${rowStart} / span ${rowSpan}`,
                backgroundColor: def.themeColor,
              }}
              className="relative z-10 m-[2px] rounded border-2 border-[#d4af37]/70 p-2 flex flex-col justify-between shadow-xl overflow-hidden group"
            >
              {/* Subtle Room Texture & Lighting */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/60 pointer-events-none" />

              {/* Room Header Banner */}
              <div className="relative z-10 flex items-center justify-between">
                <span className="font-deco font-bold text-[11px] sm:text-xs text-[#f4e4bc] uppercase tracking-wider drop-shadow-md">
                  {roomName}
                </span>

                {/* Secret Passage Shortcut Button */}
                {hasSecretPassage && (
                  <button
                    onClick={() => {
                      if (canUsePassage && onSecretPassageClick && def.secretPassageTo) {
                        onSecretPassageClick(def.secretPassageTo);
                      }
                    }}
                    disabled={!canUsePassage}
                    className={`flex items-center space-x-1 px-1.5 py-0.5 rounded text-[9px] font-deco uppercase transition-all ${
                      canUsePassage
                        ? 'bg-[#d4af37] text-[#1a0f0d] font-bold animate-bounce cursor-pointer shadow-lg'
                        : 'bg-black/60 text-[#d4af37]/80 border border-[#d4af37]/30'
                    }`}
                    title={`Secret Passage to ${def.secretPassageTo}`}
                  >
                    <Sparkles className="w-2.5 h-2.5" />
                    <span>Passage → {def.secretPassageTo}</span>
                  </button>
                )}
              </div>

              {/* Room Center Tokens & Weapons Container */}
              <div className="relative z-10 flex-1 flex flex-wrap items-center justify-center gap-1.5 p-1">
                {/* Character Pawns inside Room */}
                {occupants.map((p) => {
                  const color = SUSPECT_COLORS[p.character];
                  const isActive =
                    gameState.players[gameState.activePlayerIndex]?.peerId === p.peerId;

                  return (
                    <div
                      key={p.peerId}
                      className={`relative w-6 h-6 sm:w-7 sm:h-7 rounded-full border-2 border-white flex items-center justify-center text-white font-bold text-xs shadow-md transition-transform duration-300 ${
                        isActive
                          ? 'scale-125 ring-2 ring-[#d4af37] ring-offset-1 ring-offset-black z-20 animate-pulse'
                          : 'z-10'
                      }`}
                      style={{ backgroundColor: color.hex }}
                      title={`${p.name} (${p.character})`}
                    >
                      {p.character.charAt(0)}
                    </div>
                  );
                })}

                {/* Weapon Badges inside Room */}
                {roomWeapons.map((w) => (
                  <div
                    key={w}
                    className="px-1.5 py-0.5 rounded bg-[#1a0f0d]/90 border border-[#d4af37]/60 text-[#f4e4bc] text-[9px] font-mono flex items-center space-x-1 shadow"
                    title={`Murder Weapon: ${w}`}
                  >
                    <span>🗡️</span>
                    <span className="truncate max-w-[50px]">{w}</span>
                  </div>
                ))}
              </div>

              {/* Room Doorway Indicators */}
              <div className="relative z-10 text-[9px] text-[#f4e4bc]/70 font-serif-vintage flex justify-between items-center">
                <span>{def.doorways.length} Doors</span>
                <span className="text-[8px] italic">{def.description.slice(0, 22)}...</span>
              </div>
            </div>
          );
        })}

        {/* Center Cellar / Murder Envelope Vault */}
        <div
          id="cellar-vault-overlay"
          style={{
            gridColumn: '10 / span 6',
            gridRow: '10 / span 7',
          }}
          className="relative z-10 m-[2px] rounded border-2 border-[#d4af37] bg-gradient-to-b from-[#251610] via-[#1a0f0d] to-black p-2 flex flex-col items-center justify-center text-center shadow-2xl"
        >
          <div className="w-10 h-10 rounded-full border border-[#d4af37] bg-[#251610] flex items-center justify-center text-[#d4af37] mb-1 shadow-inner">
            <Lock className="w-5 h-5 text-[#d4af37]" />
          </div>
          <h4 className="font-deco font-bold text-xs text-[#d4af37] uppercase tracking-widest">
            MURDER ENVELOPE
          </h4>
          <p className="text-[9px] font-serif-vintage italic text-[#f4e4bc] mt-0.5">
            Confidential Evidence Vault
          </p>
          <p className="text-[8px] text-[#d4af37]/70 mt-1 uppercase tracking-wider font-mono">
            1 Suspect • 1 Weapon • 1 Room
          </p>
        </div>
      </div>
    </div>
  );
};
