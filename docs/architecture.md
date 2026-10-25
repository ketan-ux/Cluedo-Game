# Architecture

## Overview

```
 browser (each player)                     Cloudflare
 ┌──────────────────────┐   WebSocket   ┌──────────────────────────────┐
 │ React UI             │◀────────────▶│ Worker (worker/index.ts)     │
 │ useRoom / RoomClient │  own view     │   POST /api/rooms  new code  │
 └──────────────────────┘  only         │   /api/rooms/:code/ws  ──┐   │
                                        │   everything else: site  │   │
                                        │                          ▼   │
                                        │ GameRoom Durable Object      │
                                        │   one per room code          │
                                        │   full state: envelope,      │
                                        │   every hand, bots, timers   │
                                        └──────────────────────────────┘
```

The full game state exists in exactly one place, the room's Durable Object. Players send intents (`roll`, `move`, `suggest`, `show`, `accuse`, `endTurn`). The server validates each one against the rules, applies it, and sends every connected player a view built for them alone (`viewFor` in `src/game/view.ts`).

## Privacy

- A player's view contains their own hand, the cards shown to them, the cards they showed, and the options open to them. Everyone else appears only as a card count.
- When a card is shown, the card goes only to the suggester and the disprover. Everyone else gets an event saying "A showed B a card".
- After a wrong accusation, only the accuser sees the envelope. Everyone sees it once the game is over.
- Seats are claimed with a random token issued by the server and kept in the browser's storage, never by name.
- Bots decide from their own view (`chooseBotAction(viewFor(state, botId))`), so they cannot peek either.

Tests cover all of this: `src/game/engine.test.ts`, plus `worker/roomCore.test.ts`, which plays a whole game and inspects every message each player would receive.

## Code map

| Path | What it does |
| --- | --- |
| `src/game/board.ts` | The classic 24 x 25 board as a text map, 17 doors, start squares |
| `src/game/movement.ts` | Legal destinations for a roll (exact count, rooms with any count, no revisits) |
| `src/game/engine.ts` | Turn stages, suggestions, disproving, accusations. Pure functions, no I/O |
| `src/game/view.ts` | Per-player projection of the state and events |
| `src/game/bot.ts` | Deduction grid and computer player |
| `src/game/protocol.ts` | Messages between browser and server |
| `worker/roomCore.ts` | Lobby, seats, host rights, bot pacing, away-player fallbacks (testable without Cloudflare) |
| `worker/GameRoom.ts` | Durable Object adapter: WebSocket hibernation, storage, alarms |
| `src/net/roomClient.ts` | Reconnecting WebSocket client |
| `src/components/GameScreen.tsx` | The table: turns server events into animations, sounds, pop-ups and haptics |
| `src/components/art/` | Portraits, room and weapon pictures, logo. Original SVG drawn in code |
| `src/components/ui/DetectiveNotebook.tsx` | The notes sheet. Certain facts come from the player's own view; pencil marks stay on the device |

## Turn stages

`roll` → (`move` → `suggest` | `end`) → `disprove` → `end`. The next turn starts when the player ends their turn, or straight away after a wrong accusation. `optionsFor(state, playerId)` is the single source of truth for what a player may do. The server validates against it and the UI draws its buttons from it.

## Timers

Durable Object alarms drive bot moves (one to two and a half seconds of "thinking" per step, so the animations can finish) and the away-player fallback: a disconnected disprover has a card shown for them after 45 s, and a disconnected active player has their turn skipped after 90 s. Rooms delete themselves after 7 days without activity.

## The board

`src/components/board/BoardView.tsx` chooses between two boards that share one interface (`BoardProps`):

- `board3d/Board3D.tsx`, built with React Three Fiber, downloads separately when a game starts. While it loads, and wherever WebGL is unavailable or the 3D board fails, the 2D board is shown instead.
- `board/Board2D.tsx` is an SVG drawn from the same map.

Both boards take their geometry from `board/layout.ts` (walls, doors, room label and token positions), so the two always agree.

The 3D board redraws only while something is moving (`frameloop="demand"`), so an idle board uses no battery. Animations are driven by server events rather than timers:

- `moved` (walk): the pawn hops square by square along the path the server sent.
- `moved` (summoned) and `weaponMoved`: the piece flies in an arc into the room.
- `moved` (passage): the pawn sinks through the floor and rises in the other room.
- `rolled`: the dice tumble and land showing the faces the server rolled. Move highlights appear once they settle.
- Game over: the envelope on the staircase opens before the result dialog appears.

Everything is drawn in code, with no image files or 3D models to download: procedural canvas textures for the floors, wood and dice, lathe-turned pawns, and low-poly weapons and furniture.

## The game screen

`GameScreen` is one CSS grid (`.game-grid` in `src/index.css`) with three arrangements, so the same components move rather than being rendered twice:

- Phone, upright: top bar, players, board, action dock, bottom nav. Cards, notes, log and chat open as bottom sheets.
- Phone, sideways (landscape and under 540px tall): the board on the left, players, dock and nav on the right.
- Desktop (1024px and wider): board, dock and fanned hand in the middle, log and chat on the right. From 1280px the detective notes get their own column on the left.

The notebook's state lives in `useNotebook` in `GameScreen`, so the desktop column and the phone sheet edit the same marks.

Only one dialog shows at a time, in a fixed order: showing a card (compulsory) first, then pop-ups in the order they arrived (a card shown to you, a wrong accusation, nobody could disprove you), then the end of the game, then your own accusation or suggestion.
