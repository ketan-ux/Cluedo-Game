import React, { useEffect, useMemo, useState } from 'react';
import { BOARD_HEIGHT, BOARD_WIDTH, cellAt, DOORS, ROOM_LAYOUTS, Square, START_SQUARES } from '../../game/board';
import { ROOMS, Room, SECRET_PASSAGES, Suspect, SUSPECT_COLORS, SUSPECTS, Weapon, WEAPONS } from '../../game/constants';
import { ROOM_LORE } from '../../game/lore';
import { Location, MoveOption } from '../../game/movement';
import { GameView } from '../../game/view';
import { WeaponGlyph } from '../icons';

export interface Walk {
  id: number;
  suspect: Suspect;
  path: Square[];
}

interface BoardProps {
  game: GameView;
  myId: string | null;
  walk: Walk | null;
  onMove: (target: string) => void;
  onPassage: () => void;
}

const PASSAGE_CORNER: Partial<Record<Room, Square>> = {
  Kitchen: { x: 0, y: 1 },
  Conservatory: { x: 23, y: 1 },
  Lounge: { x: 0, y: 24 },
  Study: { x: 23, y: 24 },
};

function roomCentre(room: Room) {
  const b = ROOM_LAYOUTS[room].bounds;
  return { x: (b.minX + b.maxX + 1) / 2, y: (b.minY + b.maxY + 1) / 2, top: b.minY, bottom: b.maxY + 1 };
}

function pawnSpot(room: Room, index: number, count: number): Square {
  const c = roomCentre(room);
  const perRow = count > 3 ? 3 : count;
  const row = Math.floor(index / 3);
  const col = index % 3;
  const inRow = row === 0 ? perRow : count - 3;
  return { x: c.x + (col - (inRow - 1) / 2) * 0.95, y: c.y + (count > 3 ? (row - 0.5) * 0.95 : 0.1) };
}

function weaponSpot(room: Room, index: number, count: number): Square {
  const c = roomCentre(room);
  return { x: c.x + (index - (count - 1) / 2) * 0.85, y: c.bottom - 0.6 };
}

function squareCentre(s: Square): Square {
  return { x: s.x + 0.5, y: s.y + 0.5 };
}

const DOOR_EDGES = new Set(DOORS.map((d) => `${d.inside.x},${d.inside.y}>${d.outside.x},${d.outside.y}`));

/** The printed board: floors, walls with door gaps, staircase and start squares. Never changes. */
function StaticBoard() {
  const parts: React.ReactNode[] = [];
  const walls: string[] = [];
  for (let y = 0; y < BOARD_HEIGHT; y++) {
    for (let x = 0; x < BOARD_WIDTH; x++) {
      const cell = cellAt(x, y);
      if (cell.kind === 'corridor') {
        parts.push(
          <rect
            key={`c${x},${y}`}
            x={x + 0.03}
            y={y + 0.03}
            width={0.94}
            height={0.94}
            rx={0.06}
            fill={(x + y) % 2 ? '#e6d2a4' : '#dcc493'}
            stroke="#a9895a"
            strokeWidth={0.03}
          />
        );
      } else if (cell.kind === 'room') {
        parts.push(<rect key={`r${x},${y}`} x={x} y={y} width={1.01} height={1.01} fill={ROOM_LORE[cell.room].floor} />);
        for (const [dx, dy, x1, y1, x2, y2] of [
          [0, -1, x, y, x + 1, y],
          [1, 0, x + 1, y, x + 1, y + 1],
          [0, 1, x, y + 1, x + 1, y + 1],
          [-1, 0, x, y, x, y + 1],
        ]) {
          const n = cellAt(x + dx, y + dy);
          if (n.kind === 'room' && n.room === cell.room) continue;
          if (DOOR_EDGES.has(`${x},${y}>${x + dx},${y + dy}`)) continue;
          walls.push(`M${x1} ${y1}L${x2} ${y2}`);
        }
      }
    }
  }

  return (
    <g>
      <rect x={0} y={0} width={BOARD_WIDTH} height={BOARD_HEIGHT} fill="#24160d" />
      {parts}
      <path d={walls.join('')} stroke="#2a180c" strokeWidth={0.16} strokeLinecap="square" />
      {DOORS.map((d) => {
        const horizontal = d.inside.y !== d.outside.y;
        const ex = horizontal ? d.inside.x : Math.max(d.inside.x, d.outside.x);
        const ey = horizontal ? Math.max(d.inside.y, d.outside.y) : d.inside.y;
        return (
          <line
            key={`d${ex},${ey},${horizontal}`}
            x1={ex + (horizontal ? 0.12 : 0)}
            y1={ey + (horizontal ? 0 : 0.12)}
            x2={ex + (horizontal ? 0.88 : 0)}
            y2={ey + (horizontal ? 0 : 0.88)}
            stroke="#d4af37"
            strokeWidth={0.12}
            strokeLinecap="round"
          />
        );
      })}
      <rect x={10} y={10} width={5} height={7} rx={0.2} fill="#1a0f0a" stroke="#d4af37" strokeWidth={0.08} />
      <text x={12.5} y={13.3} textAnchor="middle" className="font-deco" fontSize={0.95} fontWeight={800} fill="#d4af37">
        CLUEDO
      </text>
      <rect x={11.2} y={14.1} width={2.6} height={1.7} rx={0.12} fill="#f2e6c9" stroke="#8a6a2a" strokeWidth={0.05} />
      <path d="M11.2 14.1l1.3 0.95 1.3 -0.95" fill="none" stroke="#8a6a2a" strokeWidth={0.06} />
      {SUSPECTS.map((s) => (
        <circle
          key={s}
          cx={START_SQUARES[s].x + 0.5}
          cy={START_SQUARES[s].y + 0.5}
          r={0.42}
          fill={SUSPECT_COLORS[s]}
          opacity={0.45}
          stroke="#2a180c"
          strokeWidth={0.04}
        />
      ))}
      {ROOMS.map((room) => {
        const c = roomCentre(room);
        const b = ROOM_LAYOUTS[room].bounds;
        // Shrink long names (Conservatory, Billiard Room) so they stay inside their walls.
        const fontSize = Math.min(0.62, (b.maxX - b.minX + 1 - 1.8) / (room.length * 0.72));
        return (
          <text
            key={room}
            x={c.x}
            y={c.top + 1.05}
            textAnchor="middle"
            className="font-deco"
            fontSize={fontSize}
            fontWeight={700}
            letterSpacing={0.04}
            fill="#fff6dc"
            stroke="#2a180c"
            strokeWidth={0.12}
            paintOrder="stroke"
          >
            {room.toUpperCase()}
          </text>
        );
      })}
    </g>
  );
}

export function Board2D({ game, myId, walk, onMove, onPassage }: BoardProps) {
  const staticBoard = useMemo(() => <StaticBoard />, []);
  const [step, setStep] = useState<{ id: number; index: number } | null>(null);

  useEffect(() => {
    if (!walk || walk.path.length === 0) return;
    setStep({ id: walk.id, index: 0 });
    const timer = setInterval(() => {
      setStep((s) => {
        if (!s || s.id !== walk.id) return s;
        if (s.index + 1 >= walk.path.length) {
          clearInterval(timer);
          return null;
        }
        return { ...s, index: s.index + 1 };
      });
    }, 140);
    return () => clearInterval(timer);
  }, [walk]);

  const isMyTurn = game.turn.playerId === myId && game.phase === 'playing';
  const moves = game.options.moves;
  const squareMoves = moves.filter((m): m is Extract<MoveOption, { kind: 'square' }> => m.kind === 'square');
  const roomMoves = new Map(
    moves.filter((m): m is Extract<MoveOption, { kind: 'room' }> => m.kind === 'room').map((m) => [m.room, m])
  );
  const activeSuspect = game.players.find((p) => p.id === game.turn.playerId)?.suspect;
  const mySuspect = game.players.find((p) => p.id === myId)?.suspect;

  const inRoom = (loc: Location, room: Room) => loc.type === 'room' && loc.room === room;
  const pawnPosition = (s: Suspect): Square => {
    if (step && walk && walk.suspect === s && step.id === walk.id) return squareCentre(walk.path[step.index]);
    const loc = game.pawns[s];
    if (loc.type === 'square') return squareCentre(loc);
    const together = SUSPECTS.filter((o) => inRoom(game.pawns[o], loc.room));
    return pawnSpot(loc.room, together.indexOf(s), together.length);
  };

  const weaponsIn = (room: Room) => WEAPONS.filter((w) => game.weapons[w] === room);

  return (
    <svg
      viewBox={`-0.4 -0.4 ${BOARD_WIDTH + 0.8} ${BOARD_HEIGHT + 0.8}`}
      className="w-full h-full select-none touch-manipulation"
      role="img"
      aria-label="Cluedo board"
    >
      <rect x={-0.4} y={-0.4} width={BOARD_WIDTH + 0.8} height={BOARD_HEIGHT + 0.8} rx={0.5} fill="#4a2c18" />
      {staticBoard}

      {/* Rooms you can enter with this roll */}
      {[...roomMoves.values()].map((m) => (
        <g key={m.key} onClick={() => onMove(m.key)} className="cursor-pointer" data-target={m.key}>
          {ROOM_LAYOUTS[m.room].cells.map((c) => (
            <rect key={`${c.x},${c.y}`} x={c.x} y={c.y} width={1.01} height={1.01} fill="#ffd54a" opacity={0.28} />
          ))}
          <rect
            x={roomCentre(m.room).x - 1.7}
            y={roomCentre(m.room).top + 1.35}
            width={3.4}
            height={0.75}
            rx={0.35}
            fill="#d4af37"
            className="animate-pulse"
          />
          <text
            x={roomCentre(m.room).x}
            y={roomCentre(m.room).top + 1.92}
            textAnchor="middle"
            fontSize={0.5}
            fontWeight={800}
            fill="#1a0f0d"
            className="font-deco pointer-events-none"
          >
            ENTER
          </text>
        </g>
      ))}

      {/* Squares you can stop on */}
      {squareMoves.map((m) => (
        <rect
          key={m.key}
          x={m.x + 0.06}
          y={m.y + 0.06}
          width={0.88}
          height={0.88}
          rx={0.12}
          fill="#ffd54a"
          stroke="#8a5a00"
          strokeWidth={0.06}
          className="cursor-pointer animate-pulse"
          onClick={() => onMove(m.key)}
          data-target={m.key}
        />
      ))}

      {/* Secret passages */}
      {(Object.keys(PASSAGE_CORNER) as Room[]).map((room) => {
        const at = PASSAGE_CORNER[room]!;
        const usable = isMyTurn && game.options.passage === SECRET_PASSAGES[room] && inRoom(game.pawns[mySuspect!], room);
        return (
          <g
            key={room}
            onClick={usable ? onPassage : undefined}
            className={usable ? 'cursor-pointer' : undefined}
            data-target={usable ? 'passage' : undefined}
          >
            <rect
              x={at.x + 0.1}
              y={at.y + 0.1}
              width={0.8}
              height={0.8}
              rx={0.1}
              fill={usable ? '#d4af37' : '#2a180c'}
              stroke="#d4af37"
              strokeWidth={0.05}
              className={usable ? 'animate-pulse' : undefined}
            />
            <path
              d={`M${at.x + 0.25} ${at.y + 0.75}h0.17v-0.17h0.17v-0.17h0.17v-0.17h0.17`}
              fill="none"
              stroke={usable ? '#1a0f0d' : '#d4af37'}
              strokeWidth={0.07}
            />
          </g>
        );
      })}

      {/* Weapons */}
      {ROOMS.map((room) => {
        const list = weaponsIn(room);
        return list.map((w: Weapon, i) => {
          const p = weaponSpot(room, i, list.length);
          return (
            <g key={w} style={{ color: '#2a180c' }}>
              <circle cx={p.x} cy={p.y} r={0.36} fill="#f4e4bc" stroke="#8a6a2a" strokeWidth={0.05} />
              <WeaponGlyph weapon={w} x={p.x} y={p.y} size={0.52} />
              <title>{w}</title>
            </g>
          );
        });
      })}

      {/* Pawns */}
      {SUSPECTS.map((s) => {
        const p = pawnPosition(s);
        const active = s === activeSuspect && game.phase === 'playing';
        return (
          <g key={s} style={{ transform: `translate(${p.x}px, ${p.y}px)`, transition: 'transform 140ms linear' }}>
            {active && (
              <circle r={0.55} fill="none" stroke="#ffd54a" strokeWidth={0.1} className="animate-pulse" />
            )}
            <circle r={0.38} fill={SUSPECT_COLORS[s]} stroke={s === 'Mrs. White' ? '#555' : '#fff8e6'} strokeWidth={0.08} />
            <text
              y={0.17}
              textAnchor="middle"
              fontSize={0.45}
              fontWeight={800}
              fill={s === 'Mrs. White' || s === 'Colonel Mustard' ? '#2a180c' : '#fff8e6'}
              className="font-deco pointer-events-none"
            >
              {s.split(' ').pop()!.charAt(0)}
            </text>
            <title>{s}</title>
          </g>
        );
      })}
    </svg>
  );
}
