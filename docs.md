# Realtime Multiplayer 2D Browser Game

Documentation for a scaffold/framework for building realtime multiplayer 2D browser games. This document serves as a reference for both the developer and AI assistants working on the codebase.

---

## Table of Contents

- [Project Structure](#project-structure)
- [Package Dependencies](#package-dependencies)
- [Dev Workflow](#dev-workflow)
- [Architecture Overview](#architecture-overview)
- [Client Architecture](#client-architecture)
- [Server Architecture](#server-architecture)
- [Shared Game Logic](#shared-game-logic)
- [Networking & Protocol](#networking--protocol)
- [Binary Schema System](#binary-schema-system)
- [State Synchronization](#state-synchronization)
- [Client-Authoritative vs Server-Authoritative](#client-authoritative-vs-server-authoritative)
- [Coding Conventions](#coding-conventions)
- [How To: Add a New Entity](#how-to-add-a-new-entity)
- [How To: Add a New Message Type](#how-to-add-a-new-message-type)
- [How To: Implement a Game Mode](#how-to-implement-a-game-mode)
- [How To: Add Physics / Collision](#how-to-add-physics--collision)
- [How To: Sync New State](#how-to-sync-new-state)

---

## Project Structure

```
clientauthorativegame/
├── docs.md                           # This file
├── client/                           # Browser game client (Vite + React + Phaser)
│   ├── index.html                    # HTML entry
│   ├── package.json
│   ├── vite.config.js
│   ├── public/                       # Static assets
│   └── src/
│       ├── main.jsx                  # React DOM entry point
│       ├── App.css                   # Global styles (margin/padding reset)
│       ├── App.jsx                   # Root component, screen router (menu/game)
│       ├── menu/
│       │   └── Menu.jsx             # Connection UI, creates NetClient
│       └── game/
│           ├── Game.jsx             # Phaser game bootstrapper (React wrapper)
│           └── Scene.js             # Main Phaser scene - game loop, input, rendering
├── server/                           # Node.js game server
│   ├── package.json
│   └── src/
│       ├── index.js                 # Entry point: creates and starts Server
│       └── server.js                # Server class: game loop + networking
├── shared/                           # Shared game logic (used by both client & server)
│   ├── package.json
│   └── src/
│       ├── index.js                 # Re-exports: GameState, protocol, Player, constants
│       ├── protocol.js              # Message type definitions (names, IDs, channels, fields)
│       ├── game.js                  # GameState class - central game simulation
│       ├── entities/
│       │   └── player.js            # Player entity
│       ├── data/
│       │   └── constants.js         # FIXED_DT, WORLD_WIDTH, WORLD_HEIGHT
│       ├── logic/
│       │   ├── collision.js         # Collision detection (placeholder)
│       │   └── map.js               # Map/world logic (placeholder)
│       └── rules/                   # Game mode rules (placeholder dir for CTF, DM, TDM)
└── lib/                              # Local library packages (networking infrastructure)
    ├── net-schema/                   # Binary protocol codec
    │   └── src/
    │       ├── index.js             # Exports: Schema, createCodec
    │       ├── schema.js            # Schema type descriptors (u8, u16, f32, string, array, struct)
    │       └── codec.js             # BinaryWriter, BinaryReader, createCodec
    ├── net-client/                   # WebRTC client networking (browser)
    │   └── src/
    │       ├── index.js             # Exports: NetClient
    │       ├── MultiplayerClient.js # NetClient class - high-level client API
    │       ├── PeerConnection.js    # RTCPeerConnection wrapper (browser WebRTC API)
    │       └── SignalingClient.js   # WebSocket signaling client
    └── net-server/                   # WebRTC server networking (Node.js)
        └── src/
            ├── index.js             # Exports: NetServer
            ├── MultiplayerServer.js # NetServer class - high-level server API
            ├── PeerManager.js       # node-datachannel peer management
            └── SignalingServer.js   # WebSocket signaling server (ws library)
```

---

## Package Dependencies

Packages are linked locally via `file:` protocol in `package.json`. No monorepo tooling (no Turborepo/Nx/pnpm workspaces) - each package has its own `node_modules`.

```
client
  ├── game-shared   (file:../shared)
  ├── net-client     (file:../lib/net-client)
  ├── phaser         ^3.90
  ├── react          ^19.2
  └── react-dom      ^19.2

server
  ├── game-shared   (file:../shared)
  └── net-server     (file:../lib/net-server)

net-client
  └── net-schema     (file:../net-schema)

net-server
  ├── net-schema     (file:../net-schema)
  ├── node-datachannel ^0.12.0
  └── ws             ^8.18.0

net-schema
  └── (no dependencies)
```

All packages use ES modules (`"type": "module"` in `package.json`).

---

## Dev Workflow

```bash
# Install dependencies (run in each package directory)
cd client && npm install
cd server && npm install

# Start the server (port 3001 by default, or PORT env var)
cd server && npm start

# Start the client dev server (port 3000, Vite HMR)
cd client && npm start
```

The client connects to `ws://localhost:3001` for WebSocket signaling, then upgrades to WebRTC data channels for game traffic.

---

## Architecture Overview

```
┌─────────────────────┐          WebRTC           ┌─────────────────────┐
│       CLIENT        │◄────────────────────────►  │       SERVER        │
│                     │  reliable + unreliable      │                     │
│  React (UI shell)   │                            │  Node.js            │
│  Phaser (game)      │                            │  async game loop    │
│  Scene.js           │                            │  server.js          │
│  GameState (shared) │                            │  GameState (shared) │
│  NetClient          │                            │  NetServer          │
└─────────────────────┘                            └─────────────────────┘
              │                                                │
              └──────────────── game-shared ───────────────────┘
                  (GameState, protocol, entities, constants)
```

Both client and server instantiate `GameState` with the same shared simulation code. The `ctx` object differentiates behavior:

```js
const ctx = {
  isServer: true | false,     // Branch behavior in shared code
  sendMessage: (type, data) => ...,  // Abstracted networking
  scene: phaserScene | null,  // Only on client (for rendering)
  game: gameStateRef,         // Back-reference, set by GameState constructor
};
```

---

## Client Architecture

### Boot chain

`index.html` → `main.jsx` → `<App />` → `<Menu />` or `<Game />`

### App.jsx - Screen Router

Manages two screens: `"menu"` and `"game"`. Holds the `NetClient` instance in a `useRef` so it persists across re-renders.

### Menu.jsx - Connection UI

Creates a `NetClient` with the shared protocol, connects to the signaling server. On successful WebRTC connection, transitions to the game screen by calling `switchToGame(client)`.

### Game.jsx - Phaser Bootstrapper

React component that creates a `Phaser.Game` instance on mount and destroys it on unmount. Config:
- Resolution: 1920x1080
- Scale mode: `Phaser.Scale.RESIZE` (fills browser window)
- Background: `#0d1112`
- Renderer: `Phaser.AUTO` (WebGL with Canvas fallback)

Passes the `NetClient` into the Phaser `Scene`.

### Scene.js - Main Game Scene

This is where all client-side game logic lives. Key responsibilities:

- **Input handling**: WASD keybinds via `this.keys` (Phaser keyboard input)
- **Camera**: Zoomed to fit `WORLD_WIDTH`/`WORLD_HEIGHT`, auto-adjusts on resize
- **Fixed timestep loop**: Accumulator pattern in `update()` driving `tick()` at 64Hz
- **Sub-tick interpolation**: `interpolate()` called after ticks with `alpha = accumulator / FIXED_DT`
- **Exponential smoothing**: `smooth()` for remote entity rendering
- **Network messages**: `onMessage(type, data)` handler for incoming server messages
- **Snapshot sending**: `sendSnapshot()` called every tick

```
Scene.update(time, delta)
  ├── accumulate delta (capped at FIXED_DT * 5)
  ├── while (accumulator >= FIXED_DT):
  │     ├── tick()
  │     │     ├── this.game.update()   ← shared simulation
  │     │     └── this.sendSnapshot()  ← send ClientSnapshot
  │     └── accumulator -= FIXED_DT
  ├── interpolate()  ← lerp entities between prev and current by alpha
  └── smooth()       ← exponential smoothing for remote entities
```

---

## Server Architecture

### server/src/index.js

Creates a `Server` instance and calls `start()`.

### server/src/server.js - Server Class

```js
class Server {
  constructor() {
    this.net = new NetServer(protocol);
    this.game = new GameState({ isServer: true, sendMessage, scene: null });
    this.clientSnapshots = new Map(); // per-client snapshot storage
  }
}
```

**Game loop**: `async loop()` with `while(true)` and `await setTimeout(r, 1)` to yield to the event loop. Uses the same fixed-timestep accumulator as the client.

```
Server.loop()
  ├── calculate delta (capped at FIXED_DT * 5)
  ├── while (accumulator >= FIXED_DT):
  │     ├── tick()
  │     │     ├── this.game.update()     ← shared simulation
  │     │     └── this.sendSnapshot()    ← broadcast ServerSnapshot
  │     └── accumulator -= FIXED_DT
  └── await setTimeout(1ms)  ← yield to event loop
```

**Connection lifecycle** (intended flow):
1. WebRTC connects → `onConnect(clientId)` fires (do nothing, wait for Ready)
2. Client sends `Ready` → server adds player, sends `Welcome` with initial state, broadcasts `PlayerJoined`
3. Game loop runs, snapshots exchanged every tick
4. Client disconnects → `onDisconnect(clientId)` fires, broadcasts `PlayerLeft`

**Network config**: Starts on port 3001 (or `PORT` env var) with `simulateLatency: 20ms` and `simulatePacketLoss: 0%`.

---

## Shared Game Logic

Package: `game-shared` (linked via `file:../shared`)

### GameState (`shared/src/game.js`)

Central game simulation class instantiated on both client and server.

```js
class GameState {
  players = [];

  constructor(ctx) {
    this.ctx = ctx;
    this.ctx.game = this; // back-reference so ctx.game works everywhere
  }

  update() {
    // 1. Loop through entities, call entity.update(ctx)
    // 2. Run current game mode rules (CTF, DM, TDM, etc)
  }
}
```

### Player (`shared/src/entities/player.js`)

```js
class Player {
  prevX = null; prevY = null; prevAngle = null;  // for sub-tick interpolation
  x = null; y = null; angle = null;              // current position
  vx = null; vy = null;                          // velocity
  team = null;
  health = 100;

  update(ctx) {
    // Store previous state for interpolation
    this.prevX = this.x;
    this.prevY = this.y;
    this.prevAngle = this.angle;
    // Then apply physics, input, etc.
  }
}
```

**Pattern**: Every entity stores `prev*` values at the start of `update()` before modifying current values. This enables sub-tick interpolation on the client.

### Constants (`shared/src/data/constants.js`)

```js
export const FIXED_DT = 1000 / 64;    // 64 tick rate (~15.625ms per tick)
export const WORLD_WIDTH = 1920;
export const WORLD_HEIGHT = 1080;
```

### Placeholder directories

- `shared/src/logic/collision.js` - collision detection (empty)
- `shared/src/logic/map.js` - map/world logic (empty)
- `shared/src/rules/` - game mode rules (empty dir)

---

## Networking & Protocol

### Transport: WebRTC Data Channels

Two channels per connection:
- **`reliable`**: Ordered delivery (TCP-like). For critical events (Ready, Welcome, PlayerJoined, PlayerLeft).
- **`unreliable`**: Unordered, `maxRetransmits: 0` (UDP-like). For high-frequency state (ServerSnapshot, ClientSnapshot).

### Signaling Flow

WebSocket is only used for the initial WebRTC handshake:

```
Client                    Server
  │                         │
  │──── WS connect ────────►│
  │──── { type: "hello" } ─►│
  │                         │ creates PeerConnection + data channels
  │◄── { type: "offer" } ──│
  │                         │
  │── { type: "answer" } ──►│
  │                         │
  │◄─► ICE candidates ─────►│
  │                         │
  │══ WebRTC data channels ═│  (reliable + unreliable)
  │                         │
  │  WS can close now       │
```

### Protocol Definition (`shared/src/protocol.js`)

```js
export const protocol = {
  ServerSnapshot: { id: 0, channel: "unreliable", fields: {} },
  ClientSnapshot: { id: 1, channel: "unreliable", fields: {} },
  Ready:          { id: 2, channel: "reliable",   fields: {} },
  Welcome:        { id: 3, channel: "reliable",   fields: {} },
  PlayerJoined:   { id: 4, channel: "reliable",   fields: {} },
  PlayerLeft:     { id: 5, channel: "reliable",   fields: {} },
};
```

Each message type has:
- **`id`**: Unique `u8` identifier, used as the first byte in the binary wire format
- **`channel`**: `"reliable"` or `"unreliable"` — determines which data channel to send on
- **`fields`**: Object mapping field names to `Schema` types (currently empty, to be populated)

### Message Semantics

| Message | Direction | Channel | Purpose |
|---------|-----------|---------|---------|
| `ServerSnapshot` | Server → All Clients | unreliable | Authoritative world state broadcast (every tick) |
| `ClientSnapshot` | Client → Server | unreliable | Client's local state / input (every tick) |
| `Ready` | Client → Server | reliable | "I'm loaded and ready to play" |
| `Welcome` | Server → Client | reliable | Initial game state sent on join |
| `PlayerJoined` | Server → All Clients | reliable | New player connected event |
| `PlayerLeft` | Server → All Clients | reliable | Player disconnected event |

### NetClient API (`lib/net-client`)

```js
const client = new NetClient(protocol);

// Event callbacks (assign before connecting)
client.onConnect = () => {};                   // WebRTC channels open
client.onDisconnect = () => {};                // Connection lost
client.onMessage = (type, fields) => {};       // Decoded message received
client.onError = (err) => {};                  // Decode/connection error

client.connect("ws://localhost:3001");         // Start signaling
client.sendMessage("Ready", {});               // Send a message
client.disconnect();                           // Clean shutdown
```

### NetServer API (`lib/net-server`)

```js
const server = new NetServer(protocol);

// Event callbacks
server.onConnect = (clientId) => {};                    // Peer ready
server.onDisconnect = (clientId) => {};                 // Peer disconnected
server.onMessage = (clientId, type, fields) => {};      // Decoded message from client
server.onError = (err) => {};                           // Error

server.listen({ port: 3001, simulateLatency: 20, simulatePacketLoss: 0 });
server.sendMessage(clientId, "Welcome", { ... });       // Send to one client
server.broadcastMessage("ServerSnapshot", { ... });     // Send to all clients
server.broadcastMessage("PlayerJoined", { ... }, excludeClientId);  // Broadcast with exclusion
server.getClientIds();                                  // Array of connected client IDs
server.stop();                                          // Shut down
```

---

## Binary Schema System

Package: `net-schema` (`lib/net-schema`)

All game messages are binary-encoded using a custom schema-driven codec. This keeps bandwidth minimal for high-frequency snapshot messages.

### Available Types (`Schema`)

```js
import { Schema } from "net-schema";

Schema.u8       // Unsigned 8-bit integer
Schema.u16      // Unsigned 16-bit integer
Schema.u32      // Unsigned 32-bit integer
Schema.i8       // Signed 8-bit integer
Schema.i16      // Signed 16-bit integer
Schema.i32      // Signed 32-bit integer
Schema.f32      // 32-bit float
Schema.f64      // 64-bit float
Schema.bool     // Boolean (1 byte)
Schema.string   // UTF-8 string (u16 length prefix + bytes)

Schema.array(elementType)     // Array (u16 count prefix + elements)
Schema.struct({ field: type }) // Nested struct
```

### Wire Format

All multi-byte values are **little-endian**.

```
[u8: message_id] [field_0_bytes] [field_1_bytes] ...
```

- Strings: `u16` length prefix + UTF-8 encoded bytes
- Arrays: `u16` element count + each element serialized in sequence
- Structs: fields serialized in definition order

### Codec Usage

```js
import { createCodec } from "net-schema";

const codec = createCodec(protocol);

// Encode
const bytes = codec.encode({ type: "Ready", someField: 42 });

// Decode
const msg = codec.decode(bytes); // { type: "Ready", someField: 42 }

// Get channel
const channel = codec.channelFor({ type: "Ready" }); // "reliable"
```

The codec is created once and reuses a single `BinaryWriter` internally for encoding (calls `writer.reset()` between encodes, returns a `.slice()` copy).

---

## State Synchronization

### Fixed Timestep

Both client and server run at **64 Hz** (`FIXED_DT = 1000/64 ≈ 15.625ms`). They use identical accumulator patterns:

```js
this.accumulator += Math.min(delta, FIXED_DT * 5); // cap prevents spiral of death
while (this.accumulator >= FIXED_DT) {
  this.tick();
  this.accumulator -= FIXED_DT;
}
```

The `FIXED_DT * 5` cap prevents runaway accumulation if the process stalls (e.g., tab backgrounded, GC pause).

### Sub-tick Interpolation

Between ticks, entities are rendered at an interpolated position:

```js
const alpha = this.accumulator / FIXED_DT; // 0.0 to 1.0
// renderX = prevX + (x - prevX) * alpha
// renderY = prevY + (y - prevY) * alpha
```

This is why every entity stores `prevX`/`prevY`/`prevAngle` at the start of each `update()`.

### Snapshot Flow (Planned)

```
Client A tick:
  1. Run shared physics (GameState.update)
  2. sendSnapshot() → ClientSnapshot to server (inputs/predicted state)

Server tick:
  1. Read ClientSnapshots from all clients
  2. Run shared physics (GameState.update)
  3. sendSnapshot() → ServerSnapshot to all clients

Client A receives ServerSnapshot:
  - Own player: reconcile (compare prediction vs authority)
  - Other players: update target positions, interpolate/smooth for rendering
```

### Exponential Smoothing

For remote entities, `smooth()` applies exponential smoothing to reduce jitter from network variance. Rather than snapping to the latest server position, entities ease toward it.

---

## Adding New Features — Decision Framework

When adding any new game feature, you need to answer two questions:

1. **Authority**: Is this client-authoritative or server-authoritative?
2. **Sync method**: Does this sync via snapshot data or event packets?

### Decision 1: Authority

```
Is the player directly controlling this?
  ├── YES → Client-authoritative (local player movement, aim direction)
  │         Client simulates immediately, sends state in ClientSnapshot.
  │         Server receives and can validate/override.
  │
  └── NO → Server-authoritative (damage, scoring, spawning, game rules)
            Server computes it, clients receive via ServerSnapshot or events.
            Use ctx.isServer to guard the logic.
```

**Client-authoritative** = the client runs the simulation and tells the server what happened. No input delay. The local player's movement is the canonical example — the client applies physics immediately and sends its state to the server.

**Server-authoritative** = the server decides and tells clients. Anything involving game rules, validation, or affecting other players. Health, scoring, spawning, item pickups, kill confirmation.

### Decision 2: Sync Method

```
Is this state non-deterministic or does it drift between client/server?
  ├── YES → Sync via SNAPSHOT DATA (unreliable, every tick)
  │         Examples: player positions, aim angles, health
  │         → These get exponentially smoothed on the client
  │         → Added to ServerSnapshot/ClientSnapshot fields in protocol.js
  │
  └── NO, it's deterministic from its creation event →
            Sync via EVENT PACKET (reliable, once)
            Examples: bullet fired, explosion spawned, item picked up
            → Client and server both simulate from the same initial conditions
            → No need to waste snapshot bandwidth on it
            → No smoothing needed (both sides compute identically)
```

**Key insight**: If something is fully deterministic once created (same position, same velocity, same physics on both sides), you only need to send the creation event. Both client and server simulate it identically from there. Bullets are the classic example — send a `Shoot` event with position + angle, both sides spawn and simulate the bullet. No need to include every bullet in every snapshot.

**Snapshot data** is for state that drifts or can't be derived — player positions (because humans are unpredictable), health (server-authoritative, can change from multiple sources). Entities synced via snapshots get exponentially smoothed on the client to hide network jitter.

**Event packets** are for discrete moments — something was created, destroyed, or a one-time thing happened. Sent reliably so they always arrive.

### Where All Game Code Lives: Entities and Rules

**Almost all game code belongs in `shared/src/entities/` and `shared/src/rules/`.** This is the most important architectural rule.

`client/src/game/Scene.js` and `server/src/server.js` are **thin wrappers** — they set up networking, run the game loop, and handle snapshots. They should NOT contain game logic. If you're writing gameplay code (movement, combat, spawning, scoring, physics), it belongs in an entity `update()` method or a rule module, not in Scene.js or server.js.

```
GOOD: Bullet hit detection in shared/src/entities/bullet.js update()
GOOD: Scoring logic in shared/src/rules/deathmatch.js update()
BAD:  Bullet hit detection in server/src/server.js tick()
BAD:  Movement code in client/src/game/Scene.js tick()
```

All game simulation happens inside entity `update(ctx)` methods and rule `update(ctx)` methods. Both client and server call the same code — use `ctx.isServer` to branch where needed.

### The `ctx` Object in Entity Code

Every entity receives `ctx` in its `update(ctx)` call. This gives entities access to everything they need:

```js
ctx.isServer    // boolean — true on server, false on client
ctx.sendMessage // function(type, data) — send network messages from entity code
ctx.scene       // Phaser.Scene on client, null on server — for creating game objects
ctx.game        // GameState back-reference — access other entities, game mode, etc.
```

**`ctx.sendMessage`** — Entities send event packets directly. A bullet entity can broadcast a hit event, a player entity can broadcast a death event. Server-authoritative events should be guarded with `if (ctx.isServer)`.

**`ctx.scene`** — The Phaser scene reference. Entities use this to create/destroy Phaser display objects (sprites, graphics, particles). Always guard with `if (ctx.scene)` or `if (!ctx.isServer)` since it's null on the server.

**`ctx.game`** — Access to the full GameState. Entities can read other entity lists (e.g., a bullet checking `ctx.game.players` for hit detection), access the current game mode, etc.

### Entity `update()` Example

```js
// shared/src/entities/player.js
update(ctx) {
  this.prevX = this.x;
  this.prevY = this.y;

  // Physics runs on both sides (shared)
  this.x += this.vx * (FIXED_DT / 1000);
  this.y += this.vy * (FIXED_DT / 1000);

  // Server-authoritative: damage check, only server sends the event
  if (ctx.isServer) {
    if (this.health <= 0) {
      ctx.sendMessage("PlayerKilled", { id: this.id, killerId: this.lastHitBy });
    }
  }

  // Client-only: read local input, create Phaser objects
  if (!ctx.isServer && this === ctx.game.localPlayer) {
    if (ctx.scene.keys.left.isDown) this.vx = -200;
  }
}
```

The pattern: shared physics runs everywhere, `ctx.isServer` guards server-authoritative side effects (sending events, enforcing rules), `!ctx.isServer` guards client-only input reading and Phaser object creation.

### Summary Table

| Feature | Authority | Sync Method | Smoothed? | Example |
|---------|-----------|-------------|-----------|---------|
| Local player movement | Client | ClientSnapshot (unreliable) | N/A (local) | Position sent every tick |
| Remote player positions | Server | ServerSnapshot (unreliable) | Yes | Exponential smoothing in `smooth()` |
| Bullets / projectiles | Server (creation) | Event packet (reliable) | No | `Shoot` event, then deterministic sim |
| Health / damage | Server | ServerSnapshot (unreliable) | No | Server computes, included in snapshot |
| Player join/leave | Server | Event packet (reliable) | No | `PlayerJoined` / `PlayerLeft` |
| Scoring / game state | Server | Event packet (reliable) | No | `ScoreUpdate`, `RoundEnd` |
| Item pickups | Server | Event packet (reliable) | No | Server validates, broadcasts result |
| Explosions / effects | Server (creation) | Event packet (reliable) | No | Deterministic from creation params |

---

## Coding Conventions

### Module System

ES modules everywhere. `import`/`export`, never CommonJS `require`.

### Naming

| Thing | Convention | Examples |
|-------|-----------|----------|
| Classes | PascalCase | `GameState`, `NetClient`, `PeerManager` |
| Methods/functions | camelCase | `sendMessage`, `broadcastMessage`, `createCodec` |
| Constants | SCREAMING_SNAKE_CASE | `FIXED_DT`, `WORLD_WIDTH` |
| Class files | PascalCase | `MultiplayerClient.js`, `Scene.js`, `Game.jsx` |
| Module/data files | camelCase | `codec.js`, `schema.js`, `protocol.js`, `game.js` |
| React components | PascalCase function + `.jsx` extension | `App.jsx`, `Menu.jsx` |

### Event Callbacks

Assigned as nullable properties on the instance, invoked with optional chaining:

```js
// Definition
this.onConnect = null;
this.onDisconnect = null;
this.onMessage = null;

// Invocation
this.onConnect?.(clientId);
this.onMessage?.(clientId, type, fields);
```

### Context Injection (`ctx`)

Rather than globals or singletons, a `ctx` object is threaded through the system. Created at the top level (Scene or Server), passed to GameState, then to every entity and rule `update()`:

```js
ctx.isServer     // bool — branch behavior in shared code
ctx.sendMessage  // (type, data) => void — send events from entity code
ctx.scene        // Phaser.Scene | null — create/destroy game objects (null on server)
ctx.game         // GameState — access players[], bullets[], mode, etc.
```

Entities use `ctx.sendMessage` to fire event packets (guarded by `ctx.isServer` for server-authoritative events). Entities use `ctx.scene` to create Phaser display objects like sprites and particles (guarded by `!ctx.isServer` since scene is null on the server). See [The ctx Object in Entity Code](#the-ctx-object-in-entity-code) for full details.

### Entity Pattern

Entities are plain classes with class field syntax for defaults:

```js
class Player {
  x = null;
  y = null;
  health = 100;

  constructor() {}

  update(ctx) {
    // Store prev state, then update
  }
}
```

### Protocol Message Pattern

Messages are sent as `(type, data)` pairs. The type is a string matching a key in the protocol definition, and data is a plain object matching the field schema:

```js
// Sending
client.sendMessage("Ready", {});
server.sendMessage(clientId, "Welcome", { x: 100, y: 200 });
server.broadcastMessage("ServerSnapshot", { players: [...] });

// Receiving
client.onMessage = (type, fields) => { ... };
server.onMessage = (clientId, type, fields) => { ... };
```

### Style Notes

- No TypeScript — pure JavaScript with `@types/react` for IDE tooling only
- No test framework present
- Minimal error handling — try/catch around codec decode, silent catch on peer close
- Latency simulation is built into the server-side networking layer

---

## How To: Add a New Entity

First, decide using the [decision framework](#adding-new-features--decision-framework): is this entity synced via snapshots or events? This determines the pattern.

### Example: Bullet (deterministic, event-synced)

Bullets are deterministic — once created with a position and velocity, both client and server simulate them identically. Only the creation event needs to be sent.

1. **Create the entity class** in `shared/src/entities/`:

```js
// shared/src/entities/bullet.js
import { FIXED_DT } from "../data/constants.js";

export class Bullet {
  prevX = null;
  prevY = null;
  x = null;
  y = null;
  vx = null;
  vy = null;
  ownerId = null;
  damage = 10;
  alive = true;
  sprite = null; // Phaser sprite (client only)

  constructor(x, y, vx, vy, ownerId, ctx) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.ownerId = ownerId;

    // Create Phaser display object on client (ctx.scene is null on server)
    if (ctx.scene) {
      this.sprite = ctx.scene.add.circle(x, y, 4, 0xff0000);
    }
  }

  update(ctx) {
    this.prevX = this.x;
    this.prevY = this.y;

    // Deterministic physics — runs identically on client and server
    this.x += this.vx * (FIXED_DT / 1000);
    this.y += this.vy * (FIXED_DT / 1000);

    // Server-authoritative: hit detection and damage
    if (ctx.isServer) {
      for (const player of ctx.game.players) {
        if (player.id === this.ownerId) continue;
        if (checkHit(this, player)) {
          player.health -= this.damage;
          this.alive = false;
          break;
        }
      }
    }

    // Cleanup Phaser object when bullet dies
    if (!this.alive && this.sprite) {
      this.sprite.destroy();
      this.sprite = null;
    }
  }
}
```

2. **Export from shared index**:

```js
// shared/src/index.js
export { Bullet } from "./entities/bullet.js";
```

3. **Add a collection to GameState**:

```js
// shared/src/game.js
class GameState {
  players = [];
  bullets = [];

  update() {
    for (const player of this.players) player.update(this.ctx);
    for (const bullet of this.bullets) bullet.update(this.ctx);
    this.bullets = this.bullets.filter(b => b.alive); // cleanup dead
  }
}
```

4. **Add the creation event to protocol** (NOT snapshot — bullets are deterministic):

```js
// shared/src/protocol.js
Shoot: {
  id: 6,
  channel: "reliable",
  fields: { x: Schema.f32, y: Schema.f32, vx: Schema.f32, vy: Schema.f32 },
},
```

5. **Spawn from entity `update()` or message handler**:

```js
// Both sides receive the Shoot event and create the bullet identically.
// On client, ctx.scene exists so the constructor creates a Phaser sprite.
// On server, ctx.scene is null so no sprite is created.
const bullet = new Bullet(data.x, data.y, data.vx, data.vy, playerId, ctx);
ctx.game.bullets.push(bullet);
```

6. **Add rendering on the client** in `Scene.js` (create Phaser sprites/graphics dynamically, update positions in `interpolate()`).

### Example: Player (non-deterministic, snapshot-synced)

Players are non-deterministic (humans are unpredictable), so remote player positions are synced via `ServerSnapshot` every tick and get exponentially smoothed. See [Sync New State](#how-to-sync-new-state) for the full snapshot setup.

---

## How To: Add a New Message Type

1. **Define the message** in `shared/src/protocol.js`:

```js
import { Schema } from "net-schema";

export const protocol = {
  // ... existing messages ...

  Shoot: {
    id: 6,                        // Next available ID (u8, must be unique)
    channel: "reliable",          // "reliable" for events, "unreliable" for state
    fields: {
      x: Schema.f32,             // Starting position
      y: Schema.f32,
      angle: Schema.f32,         // Direction
    },
  },
};
```

2. **Handle on the receiving side**:

```js
// Server: in server.js onMessage()
onMessage(clientId, type, data) {
  if (type === "Shoot") {
    // Validate and create bullet
    const bullet = new Bullet(data.x, data.y, ...);
    this.game.bullets.push(bullet);
  }
}

// Client: in Scene.js onMessage()
onMessage(type, data) {
  if (type === "Shoot") {
    // Play sound effect, spawn visual, etc.
  }
}
```

3. **Send from the appropriate side**:

```js
// Client sending
this.net.sendMessage("Shoot", { x: player.x, y: player.y, angle: player.angle });

// Server broadcasting
this.net.broadcastMessage("Shoot", { x, y, angle }, excludeClientId);
```

### Schema field type reference

| For this kind of data | Use this type |
|----------------------|---------------|
| Small integers (0-255) | `Schema.u8` |
| Player/entity IDs | `Schema.u16` or `Schema.u32` |
| Positions, velocities | `Schema.f32` |
| High-precision values | `Schema.f64` |
| Flags | `Schema.bool` |
| Names, chat | `Schema.string` |
| Lists of players/entities | `Schema.array(Schema.struct({ ... }))` |
| Nested data | `Schema.struct({ field: type })` |

### Channel selection

- **`"reliable"`**: Events that must arrive and in order. Joins, leaves, scoring, item pickups, chat, ability activations.
- **`"unreliable"`**: High-frequency state that can be dropped. Position snapshots, aim direction, velocity. Newer data replaces old anyway.

---

## How To: Implement a Game Mode

Game modes (CTF, Deathmatch, TDM, etc.) live in `shared/src/rules/`.

1. **Create the mode module**:

```js
// shared/src/rules/deathmatch.js
export class Deathmatch {
  scores = new Map(); // playerId -> kills

  onPlayerJoined(player, ctx) {
    this.scores.set(player.id, 0);
  }

  onPlayerLeft(player, ctx) {
    this.scores.delete(player.id);
  }

  onPlayerKilled(victim, killer, ctx) {
    const kills = this.scores.get(killer.id) ?? 0;
    this.scores.set(killer.id, kills + 1);

    if (ctx.isServer) {
      // Respawn victim
      victim.health = 100;
      victim.x = randomSpawnX();
      victim.y = randomSpawnY();
    }
  }

  update(ctx) {
    // Check win conditions, time limits, etc.
  }
}
```

2. **Add to GameState**:

```js
// shared/src/game.js
import { Deathmatch } from "./rules/deathmatch.js";

class GameState {
  players = [];
  mode = new Deathmatch();

  update() {
    for (const player of this.players) player.update(this.ctx);
    this.mode.update(this.ctx);
  }
}
```

3. **Connect to lifecycle events**: Call `mode.onPlayerJoined()` from the server's `Ready` handler, `mode.onPlayerLeft()` from `onDisconnect`, etc.

4. **Add mode-specific protocol messages** if needed (e.g., `FlagCaptured`, `ScoreUpdate`).

---

## How To: Add Physics / Collision

Physics and collision logic lives in `shared/src/logic/` and runs identically on client and server.

1. **Implement collision detection** in `shared/src/logic/collision.js`:

```js
export function checkAABBCollision(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

export function resolveCollisions(entities, map, ctx) {
  for (const entity of entities) {
    // Check entity-vs-map collisions
    // Check entity-vs-entity collisions
    // Resolve overlaps by pushing entities apart
  }
}
```

2. **Implement map logic** in `shared/src/logic/map.js`:

```js
export class GameMap {
  tiles = [];
  width = 0;
  height = 0;

  getTileAt(x, y) { ... }
  isSolid(tileX, tileY) { ... }
}
```

3. **Call from GameState.update()**:

```js
update() {
  for (const player of this.players) player.update(this.ctx);
  resolveCollisions(this.players, this.map, this.ctx);
  // ... mode rules, bullet updates, etc.
}
```

Since this runs in shared code, both client and server will get the same physics results — essential for client-side prediction to match server authority.

---

## How To: Sync New State

Per the [decision framework](#adding-new-features--decision-framework), only put state in snapshots if it's **non-deterministic or drifts** between client and server. Deterministic entities (bullets, explosions) sync via event packets instead — see [Add a New Entity](#how-to-add-a-new-entity).

For state that does need snapshot syncing (player positions, health, etc.):

### 1. Add fields to snapshot messages

```js
// shared/src/protocol.js
import { Schema } from "net-schema";

const PlayerStruct = Schema.struct({
  id: Schema.u16,
  x: Schema.f32,
  y: Schema.f32,
  angle: Schema.f32,
  health: Schema.u8,
});

export const protocol = {
  ServerSnapshot: {
    id: 0,
    channel: "unreliable",
    fields: {
      tick: Schema.u32,
      players: Schema.array(PlayerStruct),
    },
  },
  ClientSnapshot: {
    id: 1,
    channel: "unreliable",
    fields: {
      tick: Schema.u32,
      x: Schema.f32,
      y: Schema.f32,
      angle: Schema.f32,
      inputLeft: Schema.bool,
      inputRight: Schema.bool,
      inputJump: Schema.bool,
    },
  },
  // ... other messages
};
```

### 2. Send snapshots from server

```js
// server/src/server.js
sendSnapshot() {
  const players = this.game.players.map(p => ({
    id: p.id,
    x: p.x,
    y: p.y,
    angle: p.angle,
    health: p.health,
  }));
  this.net.broadcastMessage("ServerSnapshot", {
    tick: this.tickCount,
    players,
  });
}
```

### 3. Send snapshots from client

```js
// client/src/game/Scene.js
sendSnapshot() {
  this.net.sendMessage("ClientSnapshot", {
    tick: this.tickCount,
    x: localPlayer.x,
    y: localPlayer.y,
    angle: localPlayer.angle,
    inputLeft: this.keys.left.isDown,
    inputRight: this.keys.right.isDown,
    inputJump: this.keys.jump.isDown,
  });
}
```

### 4. Handle incoming snapshots

```js
// Client Scene.js - handle server snapshots
onMessage(type, data) {
  if (type === "ServerSnapshot") {
    for (const pData of data.players) {
      const player = this.game.players.find(p => p.id === pData.id);
      if (!player) continue;
      if (player === this.localPlayer) {
        // Reconcile: compare predicted state vs server state
      } else {
        // Update remote player target position (smooth() will ease toward it)
        player.x = pData.x;
        player.y = pData.y;
        player.angle = pData.angle;
        player.health = pData.health;
      }
    }
  }
}

// Server server.js - handle client snapshots
onMessage(clientId, type, data) {
  if (type === "ClientSnapshot") {
    this.clientSnapshots.set(clientId, data);
  }
}
```

### Key principles

- **Snapshots** (unreliable) are for non-deterministic state that drifts — sent every tick (~64/sec), newer replaces older. Entities in snapshots get exponentially smoothed on the client.
- **Events** (reliable) are for discrete moments and deterministic entity creation — sent once, must arrive. Both sides simulate deterministic entities identically from the event data, so they never need snapshot bandwidth.
- **Don't put deterministic entities in snapshots.** If a bullet is created from the same params on both sides and uses the same shared physics, it will be in the same place on both sides. No need to sync it every tick.
