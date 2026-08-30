# Cluedo 1920s Noir Manor: System Architecture

## Overview
A desktop-first, host-authoritative multiplayer Cluedo web application engineered with React 18, TypeScript, Tailwind CSS, and WebRTC (PeerJS) peer-to-peer networking.

---

## 1. Host-Authoritative WebRTC Network Topology
- **Star Topology**: The room creator's browser tab acts as the authoritative local server (`Host`).
- **PeerJS / STUN DataChannels**: Guest players connect via human-readable room codes (e.g. `CLUE-9X2Y`) directly to the host's WebRTC peer.
- **Master GameState**: Kept solely in the Host's memory. All user inputs (`ROLL_DICE`, `MOVE_TOKEN`, `MAKE_SUGGESTION`, `DISPROVE_CARD`, `MAKE_ACCUSATION`) are received as intent packets, validated by the headless engine, and broadcast as masked state updates.

```
                  ┌──────────────┐
                  │  Host Client │ (Authoritative Server)
                  │ Master State │ [Murder Envelope + Hands]
                  └──────┬───────┘
                         │ WebRTC DataChannels (Encrypted P2P)
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
   ┌───────────┐   ┌───────────┐   ┌───────────┐
   │  Guest 1  │   │  Guest 2  │   │  Guest 3  │
   │MaskedState│   │MaskedState│   │MaskedState│
   └───────────┘   └───────────┘   └───────────┘
```

---

## 2. Anti-Cheat State Masking Policy
To prevent memory inspection or network sniffing cheats:
1. **Murder Envelope Isolation**: `envelope` (`{ suspect, weapon, room }`) is stripped from all packets sent to guest clients.
2. **Opponent Hand Masking**: Opponents' `hand: Card[]` arrays are masked to `cardCount: number`. Only the recipient's own cards are sent in plain form.
3. **Disprove Card Privacy**: When a player disproves a suggestion, the selected card is transferred in a private point-to-point packet from the disprover to the host, and forwarded only to the suggester. Other players receive only a public receipt stating `"[Player X] showed 1 card to [Player Y]"`.

---

## 3. Authentic Waddingtons & Parker Brothers Rule Enforcement
- **Starting Order**: Miss Scarlet always moves first; play advances strictly clockwise.
- **Board Movement**: 24x25 grid with orthogonal hallway movement. No diagonal moves or stepping over/onto occupied tiles.
- **Doorway Mechanics**: Entering a room through an authentic doorway tile immediately consumes 1 step and terminates the player's movement phase for that turn.
- **Secret Passages**: Direct shortcuts connecting **Kitchen <-> Study** and **Lounge <-> Conservatory** (can be taken in lieu of rolling dice).
- **Suggestion Cycle**: Player must be in a room to make a suggestion for that specific room. The suspect pawn and weapon token are teleported into the room. Disproving queries players clockwise starting to the suggester's left. The first player with matching cards must reveal exactly one card.
- **Accusations**: Made at any point during a player's turn. An exact match wins the match immediately; an incorrect accusation permanently eliminates the player from taking turns while keeping them in the game to disprove others.
