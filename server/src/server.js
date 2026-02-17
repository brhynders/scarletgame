import { NetServer } from "net-server";
import { protocol, FIXED_DT, GameState } from "game-shared";

export class Server {
  constructor() {
    this.net = new NetServer(protocol);
    this.game = new GameState({
      isServer: true,
      sendMessage: (type, data) => this.net.broadcastMessage(type, data),
      scene: null,
    });
    this.clientSnapshots = new Map();

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
      simulateLatency: 20,
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
    this.game.update();
    this.sendSnapshot();
  }

  sendSnapshot() {
    // Send ServerSnapshot message
  }

  onConnect(clientId) {
    // Nothing here, wait for client to send ready message and then send back welcome message with intial data - handle adding players in ready message handler
  }

  onDisconnect(clientId) {}

  onMessage(clientid, type, data) {}
}
