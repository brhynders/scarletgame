import { NetServer } from "net-server";
import {
  protocol,
  FIXED_DT,
  GameState,
  Player,
  GROUND_Y,
  PLAYER_RADIUS,
  WORLD_WIDTH,
} from "game-shared";

export class Server {
  constructor() {
    this.net = new NetServer(protocol);
    this.game = new GameState({
      isServer: true,
      sendMessage: (type, data) => this.net.broadcastMessage(type, data),
      scene: null,
    });
    this.clientSnapshots = new Map();
    this.clientToPlayer = new Map();
    this.nextPlayerId = 1;

    this.net.onConnect = (clientId) => this.onConnect(clientId);
    this.net.onDisconnect = (clientId) => this.onDisconnect(clientId);
    this.net.onMessage = (clientId, type, data) =>
      this.onMessage(clientId, type, data);

    this.last = performance.now();
    this.accumulator = 0;
  }

  start() {
    this.net.listen({
      port: process.env.PORT ?? 3001,
      simulateLatency: 50,
      simulatePacketLoss: 0,
    });

    this.loop();
  }

  async loop() {
    while (true) {
      // Accumulate Delta
      const now = performance.now();
      const delta = Math.min(now - this.last, FIXED_DT * 5);
      this.accumulator += delta;
      this.last = now;

      // Run ticks
      while (this.accumulator >= FIXED_DT) {
        this.tick();
        this.accumulator -= FIXED_DT;
      }
      // Sleep to avoid CPU lock
      await new Promise((r) => setTimeout(r, 1));
    }
  }

  tick() {
    // Apply client snapshots to player entities
    for (const [clientId, snap] of this.clientSnapshots) {
      const playerId = this.clientToPlayer.get(clientId);
      if (playerId == null) continue;
      const player = this.game.getPlayer(playerId);
      if (!player) continue;
      player.x = snap.x;
      player.y = snap.y;
      player.vx = snap.vx;
      player.vy = snap.vy;
    }
    this.clientSnapshots.clear();

    this.game.update();
    this.sendSnapshot();
  }

  sendSnapshot() {
    const players = this.game.players.map((p) => ({
      id: p.id,
      x: p.x,
      y: p.y,
      vx: p.vx,
      vy: p.vy,
    }));
    this.net.broadcastMessage("ServerSnapshot", { players });
  }

  onConnect(clientId) {
    // Wait for Ready message before adding player
  }

  onDisconnect(clientId) {
    const playerId = this.clientToPlayer.get(clientId);
    if (playerId == null) return;

    this.game.removePlayer(playerId);
    this.clientToPlayer.delete(clientId);
    this.clientSnapshots.delete(clientId);

    this.net.broadcastMessage("PlayerLeft", { id: playerId });
  }

  onMessage(clientId, type, data) {
    if (type === "Ready") {
      const playerId = this.nextPlayerId++;
      const spawnX = Math.random() * (WORLD_WIDTH - 200) + 100;
      const spawnY = GROUND_Y - PLAYER_RADIUS;

      const player = new Player(playerId, spawnX, spawnY);
      this.game.addPlayer(player);
      this.clientToPlayer.set(clientId, playerId);

      // Send Welcome to the connecting client with all current players
      const players = this.game.players.map((p) => ({
        id: p.id,
        x: p.x,
        y: p.y,
        vx: p.vx,
        vy: p.vy,
      }));
      this.net.sendMessage(clientId, "Welcome", { playerId, players });

      // Broadcast PlayerJoined to everyone else
      this.net.broadcastMessage(
        "PlayerJoined",
        { id: playerId, x: spawnX, y: spawnY },
        clientId,
      );
    }

    if (type === "ClientSnapshot") {
      this.clientSnapshots.set(clientId, data);
    }
  }
}
