import Phaser from "phaser";
import { GameState, FIXED_DT, WORLD_WIDTH, WORLD_HEIGHT } from "game-shared";

export class Scene extends Phaser.Scene {
  constructor(client) {
    super("Scene");
    this.net = client;
    this.game = new GameState({
      isServer: false,
      sendMessage: (type, data) => this.net.sendMessage(type, data),
      scene: this,
    });

    this.accumulator = 0;
  }

  create() {
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

    // Send ready message - tell server we're ready
    this.net.sendMessage("Ready", {});
  }

  preload() {}

  onMessage(type, data) {}

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
    this.game.update();
    this.sendSnapshot();
  }

  sendSnapshot() {
    // Send client snapshot
  }

  interpolate() {
    // Sub-tick interpolation
    const alpha = this.accumulator / FIXED_DT;
  }

  smooth() {
    // Add exponential smoothing (for certain entities)
  }
}
