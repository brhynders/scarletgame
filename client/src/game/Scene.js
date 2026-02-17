import Phaser from "phaser";
import {
  GameState,
  Player,
  Bullet,
  FIXED_DT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
} from "game-shared";

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

export class Scene extends Phaser.Scene {
  constructor(client) {
    super("Scene");
    this.net = client;
    this.state = new GameState({
      isServer: false,
      isClient: true,
      sendMessage: (type, data) => this.net.sendMessage(type, data),
      scene: this,
    });

    this.tickCount = 0;
    this.accumulator = 0;
    this.localPlayerId = null;
    this.lastServerTick = null;

    this.tileLayer = null;
    this.tilemap = null;
    this.backgroundGfx = null;

    // Smoothed aim offset for camera look-ahead
    this.aimOffsetX = 0;
    this.aimOffsetY = 0;
  }

  create() {
    // Wire network messages to handler
    this.net.onMessage = (type, data) => this.onMessage(type, data);

    // Setup keybinds
    this.keys = this.input.keyboard.addKeys({
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      jump: Phaser.Input.Keyboard.KeyCodes.W,
      weapon1: Phaser.Input.Keyboard.KeyCodes.ONE,
      weapon2: Phaser.Input.Keyboard.KeyCodes.TWO,
      weapon3: Phaser.Input.Keyboard.KeyCodes.THREE,
      weapon4: Phaser.Input.Keyboard.KeyCodes.FOUR,
      weapon5: Phaser.Input.Keyboard.KeyCodes.FIVE,
      reload: Phaser.Input.Keyboard.KeyCodes.R,
    });

    // Disable right-click context menu so right mouse button works as jetpack
    this.input.mouse.disableContextMenu();

    // Setup camera
    const zoomX = this.scale.width / WORLD_WIDTH;
    const zoomY = this.scale.height / WORLD_HEIGHT;
    this.cameras.main.setZoom(Math.max(zoomX, zoomY));
    this.cameras.main.roundPixels = false;
    this.scale.on("resize", (gameSize) => {
      const zx = gameSize.width / WORLD_WIDTH;
      const zy = gameSize.height / WORLD_HEIGHT;
      this.cameras.main.setZoom(Math.max(zx, zy));
    });

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

  async loadMap(mapKey) {
    this.state.loadMap(mapKey);
    const gameMap = this.state.map;

    // Render background gradient
    const topColor = hexToRgb(gameMap.background.top);
    const bottomColor = hexToRgb(gameMap.background.bottom);
    const bandHeight = 8;
    const bands = Math.ceil(gameMap.pixelHeight / bandHeight);

    this.backgroundGfx = this.add.graphics();
    this.backgroundGfx.setDepth(-1000);

    for (let i = 0; i < bands; i++) {
      const t = bands > 1 ? i / (bands - 1) : 0;
      const r = Math.round(topColor.r + (bottomColor.r - topColor.r) * t);
      const g = Math.round(topColor.g + (bottomColor.g - topColor.g) * t);
      const b = Math.round(topColor.b + (bottomColor.b - topColor.b) * t);
      this.backgroundGfx.fillStyle((r << 16) | (g << 8) | b, 1);
      this.backgroundGfx.fillRect(
        0,
        i * bandHeight,
        gameMap.pixelWidth,
        bandHeight,
      );
    }

    // Load tileset texture
    const textureKey = `tileset-${mapKey}`;
    if (!this.textures.exists(textureKey)) {
      await new Promise((resolve) => {
        this.textures.once("addtexture", resolve);
        this.textures.addBase64(textureKey, gameMap.tileset.image);
      });
    }

    // Build Phaser tilemap from first visible layer
    const layer = gameMap.layers.find((l) => l.visible) || gameMap.layers[0];
    const data = layer.data.map((row) =>
      row.map((tile) => (tile == null ? -1 : tile)),
    );

    this.tilemap = this.make.tilemap({
      data,
      tileWidth: gameMap.tileWidth,
      tileHeight: gameMap.tileHeight,
    });
    const tileset = this.tilemap.addTilesetImage(
      "tiles",
      textureKey,
      gameMap.tileWidth,
      gameMap.tileHeight,
      0,
      0,
    );
    this.tileLayer = this.tilemap.createLayer(0, tileset, 0, 0);
    this.tileLayer.setDepth(-500);
  }

  setupCamera() {}

  destroyMap() {
    if (this.tileLayer) {
      this.tileLayer.destroy();
      this.tileLayer = null;
    }
    if (this.tilemap) {
      this.tilemap.destroy();
      this.tilemap = null;
    }
    if (this.backgroundGfx) {
      this.backgroundGfx.destroy();
      this.backgroundGfx = null;
    }
  }

  async onMessage(type, data) {
    if (type === "Welcome") {
      this.loadingText?.destroy();
      this.loadingText = null;
      this.localPlayerId = data.playerId;

      await this.loadMap(data.map);

      for (const pd of data.players) {
        const player = new Player(pd.id, pd.x, pd.y);
        player.vx = pd.vx;
        player.vy = pd.vy;
        player.angle = pd.angle;
        player.weaponType = pd.weaponType;
        player.health = pd.health;
        if (pd.id === data.playerId) {
          player.isLocal = true;
        }
        player.drawCircle(this.state.ctx);
        this.state.addPlayer(player);
      }

      this.setupCamera(this.state.map);
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
      if (this.lastServerTick !== null && data.tick <= this.lastServerTick)
        return;
      this.lastServerTick = data.tick;
      for (const pd of data.players) {
        if (pd.id === this.localPlayerId) continue;
        const player = this.state.getPlayer(pd.id);
        if (!player) continue;
        player.targetX = pd.x;
        player.targetY = pd.y;
        player.targetVx = pd.vx;
        player.targetVy = pd.vy;
        player.targetAngle = pd.angle;
        player.weaponType = pd.weaponType;
        player.health = pd.health;
      }
    }

    if (type === "Shoot") {
      // Create bullet from another player's shot
      const bullet = new Bullet(data, this.state.ctx);
      this.state.bullets.push(bullet);
    }

    if (type === "BulletHit") {
      const player = this.state.getPlayer(data.targetId);
      if (player) {
        player.health = data.health;
      }
    }

    if (type === "RoundStart") {
      this.destroyMap();
      await this.loadMap(data.map);
      this.setupCamera(this.state.map);
    }
  }

  update(time, delta) {
    this.accumulator += Math.min(delta, FIXED_DT * 5);
    while (this.accumulator >= FIXED_DT) {
      this.tick();
      this.tickCount++;
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
      tick: this.tickCount,
      x: local.x,
      y: local.y,
      vx: local.vx,
      vy: local.vy,
      angle: local.angle,
    });
  }

  interpolate() {
    const alpha = this.accumulator / FIXED_DT;
    for (const player of this.state.players) {
      player.interpolate(alpha);
    }
    for (const bullet of this.state.bullets) {
      bullet.interpolate(alpha);
    }

    // Camera: center on player, smooth aim offset towards cursor
    const local = this.state.getPlayer(this.localPlayerId);
    if (local?.gfx) {
      const cam = this.cameras.main;
      const pointer = this.input.activePointer;

      // Target aim offset: 40% from screen center to mouse, in world space
      const targetOffsetX = (pointer.x - cam.width / 2) / cam.zoom * 0.4;
      const targetOffsetY = (pointer.y - cam.height / 2) / cam.zoom * 0.4;

      // Smooth towards target offset
      this.aimOffsetX += (targetOffsetX - this.aimOffsetX) * 0.14;
      this.aimOffsetY += (targetOffsetY - this.aimOffsetY) * 0.14;

      cam.centerOn(local.gfx.x + this.aimOffsetX, local.gfx.y + this.aimOffsetY);
    }
  }

  smooth() {
    for (const player of this.state.players) {
      player.smooth();
    }
  }
}
