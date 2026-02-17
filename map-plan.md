# Map System Implementation

## Context
The game needs a tile-based map system. Maps are authored as JSON in `shared/src/maps/` with tile layers, embedded tileset images (base64), background gradients, and spawn point objects. Server sends the active map name to clients via Welcome and a new RoundStart message. Both sides load the map data locally (too large for the binary protocol). The camera scrolls to follow the local player within map bounds. Tile collision replaces the hardcoded GROUND_Y ground plane.

## Files to Create

### 1. `shared/src/data/maps.js` — Map registry
- Static imports of all map JSON files, keyed by filename (not the JSON `name` field, since both are currently `"Untitled Map"`)
- `export const maps = { map, map2 }` — lookup by string key
- Uses `import ... with { type: "json" }` (works in Vite natively; requires Node 22+; fallback: `createRequire` wrapper)

### 2. `shared/src/logic/map.js` — GameMap class (currently empty file)
- Constructor takes raw map JSON object, stores all fields
- `pixelWidth` / `pixelHeight` computed from `cols * tileWidth`, `rows * tileHeight`
- `isSolid(col, row)` — returns true if any visible layer has a non-null tile; out-of-bounds = solid (world boundary)
- `getTileAt(col, row)` — returns tile index or null
- `pixelToTile(px, py)` — converts pixel coords to tile coords
- `getSpawns(team?)` — filters objects array for type "Spawn"
- `getRandomSpawn(team?)` — picks random spawn point

### 3. `shared/src/logic/collision.js` — Tile collision (currently empty file)
- `export function resolveTileCollision(player, map)` — AABB vs tilemap, separate-axis resolution
- Player hitbox: axis-aligned square centered at (x, y) with half-extent PLAYER_RADIUS
- Resolve X axis first: move X, find overlapping solid tiles, push player out based on velocity direction, zero vx
- Then resolve Y axis: move Y, find overlapping solid tiles, push out; if pushing up (landed), set `player.onGround = true` and zero vy
- Clamp to map pixel bounds at the end

## Files to Modify

### 4. `shared/src/index.js` — Add exports
- `GameMap` from `./logic/map.js`
- `resolveTileCollision` from `./logic/collision.js`
- `maps` from `./data/maps.js`

### 5. `shared/src/protocol.js` — Welcome map field + RoundStart message
- Add `map: Schema.string` to `Welcome.fields` (before `players`)
- Add new message: `RoundStart: { id: 6, channel: "reliable", fields: { map: Schema.string } }`

### 6. `shared/src/game.js` — Add map support to GameState
- Import `GameMap` and `maps` from respective modules
- Add `map = null` field
- Add `loadMap(mapKey)` method: looks up `maps[mapKey]`, creates `new GameMap(data)`, assigns to `this.map`

### 7. `shared/src/entities/player.js` — Replace GROUND_Y with tile collision
- Remove `GROUND_Y` from imports
- Add `import { resolveTileCollision } from "../logic/collision.js"`
- Add `onGround = false` class field
- In `update()`:
  - Reset `this.onGround = false` each tick (before collision sets it true)
  - Change jump check from `const onGround = this.y >= GROUND_Y - PLAYER_RADIUS` to `this.onGround`
  - Remove the GROUND_Y clamp block (`if (this.y >= GROUND_Y - PLAYER_RADIUS) ...`)
  - After velocity integration (`this.x += ...`, `this.y += ...`), call `resolveTileCollision(this, ctx.game.map)` guarded by `if (ctx.game.map)`

### 8. `server/src/server.js` — Load map, spawn from objects, send map name
- Remove `GROUND_Y`, `WORLD_WIDTH` imports (no longer needed)
- Import `PLAYER_RADIUS` (keep)
- In constructor: call `this.game.loadMap("map")` to set default map
- In `onMessage("Ready")`: spawn using `this.game.map.getRandomSpawn()` instead of random x / GROUND_Y
  - `spawnX = spawn.x`, `spawnY = spawn.y - PLAYER_RADIUS` (spawn point is at tile surface, offset up by radius)
  - Fallback to map center if no spawn points exist
- In Welcome send: add `map: "map"` (the registry key, not the JSON name)
- Add `changeMap(mapKey)` method for future use: calls `this.game.loadMap()`, broadcasts `RoundStart { map: mapKey }`

### 9. `client/src/game/Scene.js` — Map rendering, camera follow, background
**Constructor**: Add `this.tileLayer = null`, `this.tilemap = null`, `this.backgroundGfx = null`

**Remove**: The hardcoded ground line (`groundGfx.lineBetween(0, GROUND_Y, ...)`) and GROUND_Y import

**New method `loadMap(mapKey)`**: Returns a Promise (texture loading is async)
1. Call `this.state.loadMap(mapKey)` to create GameMap on shared state
2. Render background gradient (Graphics object at depth -1000, draw in ~8px bands using linear color interpolation between map.background.top and .bottom)
3. Load tileset texture: `this.textures.addBase64(textureKey, tileset.image)`, wait for `addtexture` event
4. Build Phaser tilemap: convert layer data (null → -1), `this.make.tilemap({ data, tileWidth, tileHeight })`, `addTilesetImage`, `createLayer` at depth -500

**New method `setupCamera(map)`**:
- `this.cameras.main.setBounds(0, 0, map.pixelWidth, map.pixelHeight)`
- `this.cameras.main.startFollow(localPlayer.gfx, true, 0.1, 0.1)` — smooth follow on the player's Graphics object

**New method `destroyMap()`**: Cleans up tileLayer, tilemap, backgroundGfx

**Welcome handler changes**:
- Call `await this.loadMap(data.map)` before creating players
- After players created, call `this.setupCamera(this.state.map)`
- (Early server snapshots arriving before players exist are harmless — handler already does `if (!player) continue`)

**New RoundStart handler**: `this.destroyMap()`, then `this.loadMap(data.map)`, then `this.setupCamera()`

**Camera create()**: Keep existing zoom logic (WORLD_WIDTH/WORLD_HEIGHT as viewport size), but remove hardcoded ground line

## Verification
- `cd server && npm start` then `cd client && npm start`
- Client should show tile map rendered from map.json instead of the gray ground line
- Camera should follow the local player and stop at map edges
- Player should land on tiles (not at hardcoded y=900)
- Player should be able to jump between platforms
- Second client should join and see the same map, other player visible and moving
- Console: no errors about missing textures or unknown map names
