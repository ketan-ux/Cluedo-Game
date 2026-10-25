import React, { useEffect, useMemo, useState } from 'react';
import { BOARD_HEIGHT, BOARD_WIDTH, cellAt, ROOM_LAYOUTS, Square, START_SQUARES } from '../../game/board';
import { ROOMS, Room, SECRET_PASSAGES, Suspect, SUSPECT_COLORS, SUSPECTS, Weapon, WEAPONS } from '../../game/constants';
import { ROOM_LORE } from '../../game/lore';
import { MoveOption } from '../../game/movement';
import { WeaponGlyph } from '../icons';
import { doorEdges, labelSpot, PASSAGE_CORNER, pawnPositions, roomCentre, squareCentre, wallSegments, weaponPositions } from './layout';
import { BoardProps, pointerKind } from './types';

interface Walk {
  id: number;
  suspect: Suspect;
  path: Square[];
}

/** The printed board: floors, walls with door gaps, staircase and start squares. Never changes. */
function StaticBoard() {
  const tiles: React.ReactNode[] = [];
  for (let y = 0; y < BOARD_HEIGHT; y++) {
    for (let x = 0; x < BOARD_WIDTH; x++) {
      const cell = cellAt(x, y);
      if (cell.kind === 'corridor') {
        tiles.push(
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
        tiles.push(<rect key={`r${x},${y}`} x={x} y={y} width={1.01} height={1.01} fill={ROOM_LORE[cell.room].floor} />);
      }
    }
  }
  const walls = wallSegments()
    .map((w) => `M${w.x1} ${w.y1}L${w.x2} ${w.y2}`)
    .join('');

  return (
    <g>
      <rect x={0} y={0} width={BOARD_WIDTH} height={BOARD_HEIGHT} fill="#24160d" />
      {tiles}
      <path d={walls} stroke="#2a180c" strokeWidth={0.16} strokeLinecap="square" />
      {doorEdges().map((e) => {
        const horizontal = e.y1 === e.y2;
        return (
          <line
            key={`d${e.x1},${e.y1},${horizontal}`}
            x1={e.x1 + (horizontal ? 0.12 : 0)}
            y1={e.y1 + (horizontal ? 0 : 0.12)}
            x2={e.x2 - (horizontal ? 0.12 : 0)}
            y2={e.y2 - (horizontal ? 0 : 0.12)}
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
        const at = labelSpot(room);
        // Shrink long names (Conservatory, Billiard Room) so they stay inside their walls.
        const fontSize = Math.min(0.62, (c.width - 1.8) / (room.length * 0.72));
        return (
          <text
            key={room}
            x={at.x}
            y={at.y + 0.2}
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

/** Flat top-down board. Used where WebGL is unavailable, or when a player prefers it. */
export default function Board2D({ game, myId, batch, selected, onPick, onPassage }: BoardProps) {
  const staticBoard = useMemo(() => <StaticBoard />, []);
  const [walk, setWalk] = useState<Walk | null>(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const e = batch.events.find((ev) => ev.type === 'moved' && ev.how === 'walk' && ev.path.length > 0);
    if (e && e.type === 'moved') setWalk({ id: batch.id, suspect: e.suspect, path: e.path });
  }, [batch]);

  useEffect(() => {
    if (!walk) return;
    let i = 0;
    setStep(0);
    const timer = setInterval(() => {
      i += 1;
      if (i >= walk.path.length) {
        clearInterval(timer);
        setWalk(null);
      } else {
        setStep(i);
      }
    }, 140);
    return () => clearInterval(timer);
  }, [walk]);

  const isMyTurn = game.turn.playerId === myId && game.phase === 'playing';
  const moves = game.options.moves;
  const squareMoves = moves.filter((m): m is Extract<MoveOption, { kind: 'square' }> => m.kind === 'square');
  const roomMoves = moves.filter((m): m is Extract<MoveOption, { kind: 'room' }> => m.kind === 'room');
  const preview = moves.find((m) => m.key === selected);
  const activeSuspect = game.players.find((p) => p.id === game.turn.playerId)?.suspect;
  const mySuspect = game.players.find((p) => p.id === myId)?.suspect;
  const pawns = pawnPositions(game.pawns);
  const weapons = weaponPositions(game.weapons);
  const pick = (target: string) => onPick(target, pointerKind());

  const pawnAt = (s: Suspect): Square => (walk && walk.suspect === s ? squareCentre(walk.path[step]) : pawns[s]);

  return (
    <svg
      viewBox={`-0.4 -0.4 ${BOARD_WIDTH + 0.8} ${BOARD_HEIGHT + 0.8}`}
      className="w-full h-full select-none touch-manipulation"
      role="img"
      aria-label="Cluedo board"
    >
      <rect x={-0.4} y={-0.4} width={BOARD_WIDTH + 0.8} height={BOARD_HEIGHT + 0.8} rx={0.5} fill="#4a2c18" />
      {staticBoard}

      {roomMoves.map((m) => {
        const c = roomCentre(m.room);
        const chosen = selected === m.key;
        return (
          <g key={m.key} onClick={() => pick(m.key)} className="cursor-pointer">
            {ROOM_LAYOUTS[m.room].cells.map((cell) => (
              <rect key={`${cell.x},${cell.y}`} x={cell.x} y={cell.y} width={1.01} height={1.01} fill="#ffd54a" opacity={chosen ? 0.45 : 0.28} />
            ))}
            <rect x={c.x - 1.7} y={c.top + 1.35} width={3.4} height={0.75} rx={0.35} fill="#d4af37" className="animate-pulse" />
            <text x={c.x} y={c.top + 1.92} textAnchor="middle" fontSize={0.5} fontWeight={800} fill="#1a0f0d" className="font-deco pointer-events-none">
              ENTER
            </text>
          </g>
        );
      })}

      {squareMoves.map((m) => (
        <rect
          key={m.key}
          x={m.x + 0.06}
          y={m.y + 0.06}
          width={0.88}
          height={0.88}
          rx={0.12}
          fill="#ffd54a"
          stroke={selected === m.key ? '#9b111e' : '#8a5a00'}
          strokeWidth={selected === m.key ? 0.14 : 0.06}
          className="cursor-pointer animate-pulse"
          onClick={() => pick(m.key)}
        />
      ))}

      {preview &&
        preview.path.map((s, i) => <circle key={i} cx={s.x + 0.5} cy={s.y + 0.5} r={0.14} fill="#9b111e" className="pointer-events-none" />)}

      {(Object.keys(PASSAGE_CORNER) as Room[]).map((room) => {
        const at = PASSAGE_CORNER[room]!;
        const mine = mySuspect ? game.pawns[mySuspect] : null;
        const usable = isMyTurn && game.options.passage === SECRET_PASSAGES[room] && mine?.type === 'room' && mine.room === room;
        return (
          <g key={room} onClick={usable ? onPassage : undefined} className={usable ? 'cursor-pointer' : undefined}>
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

      {WEAPONS.map((w: Weapon) => {
        const p = weapons[w];
        return (
          <g key={w} style={{ color: '#2a180c' }}>
            <circle cx={p.x} cy={p.y} r={0.36} fill="#f4e4bc" stroke="#8a6a2a" strokeWidth={0.05} />
            <WeaponGlyph weapon={w} x={p.x} y={p.y} size={0.52} />
            <title>{w}</title>
          </g>
        );
      })}

      {SUSPECTS.map((s) => {
        const p = pawnAt(s);
        const active = s === activeSuspect && game.phase === 'playing';
        return (
          <g key={s} style={{ transform: `translate(${p.x}px, ${p.y}px)`, transition: 'transform 140ms linear' }} className="pointer-events-none">
            {active && <circle r={0.55} fill="none" stroke="#ffd54a" strokeWidth={0.1} className="animate-pulse" />}
            <circle r={0.38} fill={SUSPECT_COLORS[s]} stroke={s === 'Mrs. White' ? '#555' : '#fff8e6'} strokeWidth={0.08} />
            <text
              y={0.17}
              textAnchor="middle"
              fontSize={0.45}
              fontWeight={800}
              fill={s === 'Mrs. White' || s === 'Colonel Mustard' ? '#2a180c' : '#fff8e6'}
              className="font-deco"
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
