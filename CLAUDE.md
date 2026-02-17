# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A scaffold for a realtime multiplayer 2D browser game. Most gameplay logic (collision, map, game modes, snapshot fields) is intentionally stubbed — the networking infrastructure and game loop are complete.

Stack: Vite + React 19 + Phaser 3 (client), Node.js (server), WebRTC data channels (transport), custom binary protocol (serialization). Pure JavaScript, no TypeScript. Full architecture reference lives in `docs.md`.

## Commands

```bash
# Install (no monorepo tooling — each package has its own node_modules)
cd client && npm install
cd server && npm install
# lib/ and shared/ are installed transitively via file: references

# Run server (default port 3001, override with PORT env var)
cd server && npm start

# Run client dev server (port 3000, connects to ws://localhost:3001)
cd client && npm start

# Production build
cd client && npm run build

# Lint (client only, ESLint 9)
cd client && npm run lint
```

No test framework is configured.

## Architecture

Both client and server instantiate the same `GameState` from `game-shared` and run identical entity/rule code. A `ctx` object threads through all shared code:

```js
ctx.isServer    // bool — branch server vs client logic
ctx.sendMessage // (type, data) => void
ctx.scene       // Phaser.Scene | null (null on server)
ctx.game        // GameState ref
```

**Game loop**: Fixed 64Hz timestep (`FIXED_DT = 1000/64`). Both sides use an accumulator pattern with a 5-tick cap to prevent spiral of death. Client additionally runs `interpolate()` (sub-tick lerp) and `smooth()` (exponential smoothing for remote entities) after the tick loop.

**Networking**: Two WebRTC data channels per peer — `reliable` (ordered, TCP-like) and `unreliable` (unordered, `maxRetransmits: 0`, UDP-like). WebSocket is used only for signaling (SDP/ICE exchange), then drops away.

**Binary protocol** (`lib/net-schema`): Messages defined in `shared/src/protocol.js` with `id` (u8), `channel`, and `fields` using `Schema` types. Wire format is little-endian, u8 message ID prefix, u16-length-prefixed strings and arrays.

## Where to Put Game Code

Almost all gameplay code belongs in `shared/src/` — entities in `entities/`, game mode rules in `rules/`. `Scene.js` and `server.js` are thin wrappers that set up networking and run the loop. Don't put gameplay logic there.

## Key Patterns

**Entity pattern**: Classes with class field defaults. `update(ctx)` must save `prev*` values before modifying state (required for sub-tick interpolation). Guard rendering with `if (ctx.scene)`.

**Authority model**: Client-authoritative for direct player input (movement, aim) — send via `ClientSnapshot` (unreliable). Server-authoritative for game rules affecting others (damage, scoring, spawning) — guard with `if (ctx.isServer)`. Discrete events (bullet fired, player joined) go on reliable channel; continuous state (positions, health) goes on unreliable channel with client-side smoothing.

**Event callbacks**: Properties on instances invoked with optional chaining (`this.onConnect?.(clientId)`).

**Adding a new message**: Add to `protocol.js` with next `id`, set `channel` and `fields`, handle in receiving side's `onMessage`.

**Adding a new entity**: Create class in `shared/src/entities/`, export from `shared/src/index.js`, add array + loop in `GameState.update()`, add fields to protocol if snapshot-synced.

## Conventions

- ES modules everywhere (`import`/`export`, `"type": "module"`)
- Classes: PascalCase. Methods/functions: camelCase. Constants: SCREAMING_SNAKE_CASE
- React components: PascalCase `.jsx`. Class/module files: PascalCase `.js` for classes, camelCase `.js` for data/config
- Packages linked via `file:` protocol in package.json (e.g., `"game-shared": "file:../shared"`)
