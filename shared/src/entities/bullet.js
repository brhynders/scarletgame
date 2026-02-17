import { WEAPONS } from "../data/weapons.js";
import { FIXED_DT, PLAYER_RADIUS } from "../data/constants.js";
import { raycastTiles, segmentCircleIntersect } from "../logic/collision.js";

export class Bullet {
  prevX = 0;
  prevY = 0;
  x = 0;
  y = 0;
  velX = 0;
  velY = 0;
  gravity = 0;
  lifetime = 0;
  damage = 0;
  radius = 3;
  ownerId = 0;
  weaponType = 0;
  alive = true;
  gfx = null;

  constructor(data, ctx) {
    this.ownerId = data.ownerId;
    this.weaponType = data.weaponType;
    this.x = data.x;
    this.y = data.y;
    this.prevX = data.x;
    this.prevY = data.y;
    this.velX = data.velX;
    this.velY = data.velY;

    const weapon = WEAPONS[this.weaponType];
    this.gravity = weapon.bulletGravity;
    this.lifetime = weapon.bulletLifetime;
    this.damage = weapon.damage;
    this.radius = weapon.bulletRadius;

    if (ctx.scene) {
      this.gfx = ctx.scene.add.graphics();
      this.gfx.fillStyle(0xffffff, 1);
      this.gfx.fillCircle(0, 0, this.radius);
      this.gfx.setPosition(this.x, this.y);
    }
  }

  update(ctx) {
    if (!this.alive) return;

    const dt = FIXED_DT / 1000;

    // Save previous position for swept collision
    const prevX = this.x;
    const prevY = this.y;
    this.prevX = prevX;
    this.prevY = prevY;

    // Apply gravity
    this.velY += this.gravity * dt;

    // Integrate position
    this.x += this.velX * dt;
    this.y += this.velY * dt;

    // Decrement lifetime
    this.lifetime -= FIXED_DT;
    if (this.lifetime <= 0) {
      this.alive = false;
      return;
    }

    // Out of bounds check
    if (ctx.game.map) {
      const pw = ctx.game.map.pixelWidth;
      const ph = ctx.game.map.pixelHeight;
      if (this.x < -100 || this.x > pw + 100 || this.y < -500 || this.y > ph + 200) {
        this.alive = false;
        return;
      }
    }

    // Raycast tile collision (swept, prevents tunneling)
    let tileHit = { hit: false };
    if (ctx.game.map) {
      tileHit = raycastTiles(prevX, prevY, this.x, this.y, ctx.game.map);
    }

    // Segment-circle player collision (server only)
    if (ctx.isServer) {
      const segDx = this.x - prevX;
      const segDy = this.y - prevY;
      let closestPlayerT = Infinity;
      let hitPlayer = null;

      for (const player of ctx.game.players) {
        if (player.id === this.ownerId) continue;
        if (player.health <= 0) continue;

        const t = segmentCircleIntersect(
          prevX, prevY, this.x, this.y,
          player.x, player.y, PLAYER_RADIUS + this.radius,
        );
        if (t >= 0 && t < closestPlayerT) {
          closestPlayerT = t;
          hitPlayer = player;
        }
      }

      // Compute terrain hit t for comparison
      let tileT = Infinity;
      if (tileHit.hit) {
        const segLen = Math.sqrt(segDx * segDx + segDy * segDy);
        if (segLen > 0) {
          const htDx = tileHit.x - prevX;
          const htDy = tileHit.y - prevY;
          tileT = Math.sqrt(htDx * htDx + htDy * htDy) / segLen;
        } else {
          tileT = 0;
        }
      }

      // Apply whichever hit is closer
      if (hitPlayer && closestPlayerT <= tileT) {
        hitPlayer.health -= this.damage;
        if (hitPlayer.health < 0) hitPlayer.health = 0;
        this.x = prevX + segDx * closestPlayerT;
        this.y = prevY + segDy * closestPlayerT;
        this.alive = false;
        ctx.sendMessage("BulletHit", {
          targetId: hitPlayer.id,
          attackerId: this.ownerId,
          damage: this.damage,
          health: hitPlayer.health,
          x: this.x,
          y: this.y,
        });
        return;
      }

      if (tileHit.hit) {
        this.x = tileHit.x;
        this.y = tileHit.y;
        this.alive = false;
        return;
      }
    } else {
      // Client-side: just kill on tile hit (no player hit detection)
      if (tileHit.hit) {
        this.x = tileHit.x;
        this.y = tileHit.y;
        this.alive = false;
        return;
      }
    }
  }

  interpolate(alpha) {
    if (!this.gfx || !this.alive) return;
    const dispX = this.prevX + (this.x - this.prevX) * alpha;
    const dispY = this.prevY + (this.y - this.prevY) * alpha;
    this.gfx.setPosition(dispX, dispY);
  }

  destroy() {
    if (this.gfx) {
      this.gfx.destroy();
      this.gfx = null;
    }
  }
}
