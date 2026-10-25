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

## Turn stages

`roll` → (`move` → `suggest` | `end`) → `disprove` → `end`. The next turn starts when the player ends their turn, or straight away after a wrong accusation. `optionsFor(state, playerId)` is the single source of truth for what a player may do. The server validates against it and the UI draws its buttons from it.

## Timers

Durable Object alarms drive bot moves (about a second and a half of "thinking" per step) and the away-player fallback: a disconnected disprover has a card shown for them after 45 s, and a disconnected active player has their turn skipped after 90 s. Rooms delete themselves after 7 days without activity.
