import {
  GRAVITY,
  JUMP_SPEED,
  MOVE_SPEED,
  PLAYER_RADIUS,
  SMOOTH_FACTOR,
  FIXED_DT,
} from "../data/constants.js";
import { resolveTileCollision } from "../logic/collision.js";

export class Player {
  prevX = 0;
  prevY = 0;
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  id = 0;
  isLocal = false;
  onGround = false;

  // Smoothing targets for remote players
  targetX = 0;
  targetY = 0;
  targetVx = 0;
  targetVy = 0;

  gfx = null;

  constructor(id, x, y) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.prevX = x;
    this.prevY = y;
    this.targetX = x;
    this.targetY = y;
  }

  update(ctx) {
    // Save prev values for interpolation
    this.prevX = this.x;
    this.prevY = this.y;

    const dt = FIXED_DT / 1000;

    if (this.isLocal && !ctx.isServer) {
      // Read input
      const keys = ctx.scene.keys;
      this.vx = 0;
      if (keys.left.isDown) this.vx = -MOVE_SPEED;
      if (keys.right.isDown) this.vx = MOVE_SPEED;

      if (keys.jump.isDown && this.onGround) {
        this.vy = JUMP_SPEED;
      }
    }

    this.onGround = false;

    if (!ctx.isServer) {
      // Apply gravity and integrate
      this.vy += GRAVITY * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;

      // Tile collision
      if (ctx.game.map) {
        resolveTileCollision(this, ctx.game.map);
      }
    }
  }

  drawCircle(ctx) {
    if (!ctx.scene) return;

    if (!this.gfx) {
      this.gfx = ctx.scene.add.graphics();
    }

    const r = PLAYER_RADIUS;
    const baseColor = this.isLocal ? 0x3366cc : 0xcc3333;
    const shadowColor = this.isLocal ? 0x1a3366 : 0x661a1a;
    const lightColor = this.isLocal ? 0x5588ee : 0xee5555;
    const highlightColor = this.isLocal ? 0x88bbff : 0xff8888;
    const specularColor = 0xffffff;

    this.gfx.clear();

    // Base fill
    this.gfx.fillStyle(baseColor, 1);
    this.gfx.fillCircle(0, 0, r);

    // Shadow crescent (offset down-right)
    this.gfx.fillStyle(shadowColor, 0.4);
    this.gfx.fillCircle(r * 0.15, r * 0.15, r * 0.9);

    // Lit body (offset up-left)
    this.gfx.fillStyle(lightColor, 0.6);
    this.gfx.fillCircle(-r * 0.1, -r * 0.1, r * 0.75);

    // Highlight
    this.gfx.fillStyle(highlightColor, 0.5);
    this.gfx.fillCircle(-r * 0.25, -r * 0.25, r * 0.4);

    // Specular dot
    this.gfx.fillStyle(specularColor, 0.7);
    this.gfx.fillCircle(-r * 0.3, -r * 0.3, r * 0.15);
  }

  interpolate(alpha) {
    if (!this.gfx) return;
    const dispX = this.prevX + (this.x - this.prevX) * alpha;
    const dispY = this.prevY + (this.y - this.prevY) * alpha;
    this.gfx.setPosition(dispX, dispY);
  }

  smooth() {
    if (this.isLocal) return;
    this.x += (this.targetX - this.x) * SMOOTH_FACTOR;
    this.y += (this.targetY - this.y) * SMOOTH_FACTOR;
    this.vx += (this.targetVx - this.vx) * SMOOTH_FACTOR;
    this.vy += (this.targetVy - this.vy) * SMOOTH_FACTOR;
  }

  destroy() {
    if (this.gfx) {
      this.gfx.destroy();
      this.gfx = null;
    }
  }
}
