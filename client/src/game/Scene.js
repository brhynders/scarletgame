import Phaser from "phaser";
import {
  GameState,
  Player,
  FIXED_DT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  GROUND_Y,
} from "game-shared";

export class Scene extends Phaser.Scene {
  constructor(client) {
    super("Scene");
    this.net = client;
    this.state = new GameState({
      isServer: false,
      sendMessage: (type, data) => this.net.sendMessage(type, data),
      scene: this,
    });

    this.accumulator = 0;
    this.localPlayerId = null;
  }

  create() {
    // Wire network messages to handler
    this.net.onMessage = (type, data) => this.onMessage(type, data);

    // Setup keybinds
    this.keys = this.input.keyboard.addKeys({
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      jump: Phaser.Input.Keyboard.KeyCodes.W,
    });

    // Setup camera
    const zoomX = this.scale.width / WORLD_WIDTH;
    const zoomY = this.scale.height / WORLD_HEIGHT;
    this.cameras.main.setZoom(Math.max(zoomX, zoomY));
    this.cameras.main.roundPixels = true;
    this.scale.on("resize", (gameSize) => {
      const zx = gameSize.width / WORLD_WIDTH;
      const zy = gameSize.height / WORLD_HEIGHT;
      this.cameras.main.setZoom(Math.max(zx, zy));
    });

    // Draw ground line
    const groundGfx = this.add.graphics();
    groundGfx.lineStyle(2, 0x888888, 1);
    groundGfx.lineBetween(0, GROUND_Y, WORLD_WIDTH, GROUND_Y);

    // Show loading text while waiting for server Welcome
    this.loadingText = this.add.text(
      WORLD_WIDTH / 2,
      WORLD_HEIGHT / 2,
      "Waiting for server...",
      { fontSize: "24px", color: "#ffffff" },
    );
    this.loadingText.setOrigin(0.5);

    // Send ready message - tell server we're ready
    this.net.sendMessage("Ready", {});
  }

  preload() {}

  onMessage(type, data) {
    if (type === "Welcome") {
      this.loadingText?.destroy();
      this.loadingText = null;
      this.localPlayerId = data.playerId;
      for (const pd of data.players) {
        const player = new Player(pd.id, pd.x, pd.y);
        player.vx = pd.vx;
        player.vy = pd.vy;
        if (pd.id === data.playerId) {
          player.isLocal = true;
        }
        player.drawCircle(this.state.ctx);
        this.state.addPlayer(player);
      }
    }

    if (type === "PlayerJoined") {
      const player = new Player(data.id, data.x, data.y);
      player.drawCircle(this.state.ctx);
      this.state.addPlayer(player);
    }

    if (type === "PlayerLeft") {
      const player = this.state.getPlayer(data.id);
      if (player) {
        player.destroy();
        this.state.removePlayer(data.id);
      }
    }

    if (type === "ServerSnapshot") {
      for (const pd of data.players) {
        if (pd.id === this.localPlayerId) continue;
        const player = this.state.getPlayer(pd.id);
        if (!player) continue;
        player.targetX = pd.x;
        player.targetY = pd.y;
        player.targetVx = pd.vx;
        player.targetVy = pd.vy;
      }
    }
  }

  update(time, delta) {
    this.accumulator += Math.min(delta, FIXED_DT * 5);
    while (this.accumulator >= FIXED_DT) {
      this.tick();
      this.accumulator -= FIXED_DT;
    }
    this.interpolate();
    this.smooth();
  }

  tick() {
    this.state.update();
    this.sendSnapshot();
  }

  sendSnapshot() {
    const local = this.state.getPlayer(this.localPlayerId);
    if (!local) return;
    this.net.sendMessage("ClientSnapshot", {
      x: local.x,
      y: local.y,
      vx: local.vx,
      vy: local.vy,
    });
  }

  interpolate() {
    const alpha = this.accumulator / FIXED_DT;
    for (const player of this.state.players) {
      player.interpolate(alpha);
    }
  }

  smooth() {
    for (const player of this.state.players) {
      player.smooth();
    }
  }
}
