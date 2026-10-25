# Cluedo

A private online game of Cluedo for friends, played in the browser on phones and desktops.

- **Classic rules, strictly enforced:** 2 dice, exact-count movement, seating order from Miss Scarlet, one suggestion per room entry, summoned players may suggest without moving, compulsory disproving, wrong accusers keep showing cards.
- **Real card privacy:** the whole game lives on a server you control (a Cloudflare Durable Object). Each player's browser only ever receives that player's own cards and the cards shown to them.
- **Rejoin anytime:** reload or come back later on the same device and you get your seat back. If someone drops out, the game waits for them, then shows a card or skips their turn for them so nobody is stuck.
- **Computer players** that deduce from what they are shown, if you're short of people.
- **A 3D table:** themed rooms with furniture, turned pawns, weapon miniatures, dice that tumble onto the staircase, pawns that walk their route, and an envelope that opens when the case is solved. A flat 2D board is one tap away (top bar), and is used automatically where 3D isn't supported.
- **A tabletop look:** original illustrated suspect portraits, room and weapon cards, a box-lid title screen, a seating-plan lobby and a parchment detective notebook that fills in and locks what you know for certain.
- **Made for phones first:** on a phone the board fills the screen, the actions sit under your thumb, and your cards, notes, case log and chat open as sheets from the bottom bar. It also works turned sideways. On a desktop the notes, board, hand and log are all on screen at once.
- **Installable:** add it to your home screen (Safari: Share > Add to Home Screen; Chrome: Install app) and it opens full screen like an app. Sound and vibration can be switched off in Settings (the gear in the top bar).

### Board controls

- Drag to move around, pinch (or scroll) to zoom, two-finger twist (or right-drag) to turn.
- The buttons in the board's corner fit the board to the screen, switch between angled and top-down views, and turn the board a quarter.
- On a phone, tap a glowing square to see the route, then tap it again (or **Move here**) to go. Rooms you can reach also appear as **Enter …** buttons.

## Playing

1. Open the site, pick a suspect, enter your name and press **Create a room**.
2. Press **Invite** to share the link (or read out the 5-letter code).
3. Friends open the link, enter a name and join. The host can add bots to empty seats.
4. The host presses **Seal the envelope & start**.

**How to play** (on the home screen, in the lobby and in Settings) has the rules in short.

## Development

```bash
bun install        # or npm install
npm run dev        # site on http://localhost:5173, room server on :8787
npm test           # rules engine and room server tests
npm run lint       # type-check site and server
```

In development, open `http://localhost:5173/?art` for a gallery of all the artwork and cards, or `?art=suggest` (also `accuse`, `disprove`, `reveal`, `over`) to see one dialog on its own.

## Deploying

The repository deploys as a single Cloudflare Worker named `cluedo-game`, which serves the site and runs the rooms.

**Cloudflare (Workers Builds):** with the repository connected, every push to the production branch deploys. In the Worker's **Settings > Build** the commands should be:

- Build command: `npm run build` (optional: `wrangler.jsonc` also builds the site before deploying)
- Deploy command: `npx wrangler deploy`

**By hand:** `npx wrangler login`, then `npm run deploy`.

The free Workers plan is plenty: an idle room costs nothing, and a game night uses a few thousand of the 100,000 daily requests.

**Vercel (optional):** to host the site on Vercel instead, import the repository there and set the environment variable `VITE_ROOM_SERVER_URL` to your Worker's address, for example `https://cluedo-game.<your-subdomain>.workers.dev`. Rooms still run on Cloudflare.

## Layout

```
src/game/     rules engine, board, bots and per-player views (shared by site and server)
src/net/      WebSocket client and React hook
src/components/  screens, dialogs and the 2D board
src/components/art/      portraits, room and weapon pictures, logo (all SVG drawn in code)
src/components/game/     game screen pieces: top bar, players, action dock, log, chat
src/components/board3d/  3D board (three.js), loaded only when a game starts
worker/       Cloudflare Worker entry and the GameRoom Durable Object
```

See [docs/architecture.md](docs/architecture.md) for how it fits together.
