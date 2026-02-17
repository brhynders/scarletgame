import {
  GRAVITY,
  JUMP_VELOCITY,
  MOVE_FORCE_GROUND,
  MOVE_FORCE_AIR,
  VELOCITY_DAMPING,
  SURFACE_FRICTION,
  MAX_VELOCITY,
  SIDEJUMP_VERTICAL,
  SIDEJUMP_HORIZONTAL,
  JUMP_CUT_EXTRA_GRAVITY,
  JETPACK_FUEL_MAX,
  JETPACK_BURN_RATE,
  JETPACK_REGEN_RATE,
  JETPACK_THRUST,
  PLAYER_RADIUS,
  SMOOTH_FACTOR,
  FIXED_DT,
  GUN_OFFSET,
} from "../data/constants.js";
import { WEAPONS, DEFAULT_WEAPON } from "../data/weapons.js";
import { Bullet } from "./bullet.js";
import { resolveAABBCollision } from "../logic/collision.js";

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

  // Aim
  angle = 0;
  prevAngle = 0;

  // Health
  health = 100;

  // Jetpack
  jetpackFuel = JETPACK_FUEL_MAX;
  jetpacking = false;

  // Weapon state
  weaponType = DEFAULT_WEAPON;
  ammo = WEAPONS[DEFAULT_WEAPON].clipSize;
  fireTimer = 0;
  reloadTimer = 0;
  currentSpread = WEAPONS[DEFAULT_WEAPON].minSpread;

  // Smoothing targets for remote players
  targetX = 0;
  targetY = 0;
  targetVx = 0;
  targetVy = 0;
  targetAngle = 0;

  gfx = null;
  aimGfx = null;

  constructor(id, x, y) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.prevX = x;
    this.prevY = y;
    this.targetX = x;
    this.targetY = y;
  }

  switchWeapon(weaponType) {
    if (weaponType === this.weaponType) return;
    const weapon = WEAPONS[weaponType];
    if (!weapon) return;
    this.weaponType = weaponType;
    this.ammo = weapon.clipSize;
    this.fireTimer = 0;
    this.reloadTimer = 0;
    this.currentSpread = weapon.minSpread;
  }

  startReload() {
    const weapon = WEAPONS[this.weaponType];
    if (this.reloadTimer > 0) return;
    if (this.ammo >= weapon.clipSize) return;
    this.reloadTimer = weapon.reloadTime;
  }

  update(ctx) {
    // Save prev values for interpolation
    this.prevX = this.x;
    this.prevY = this.y;
    this.prevAngle = this.angle;

    const dt = FIXED_DT / 1000;

    if (this.isLocal && !ctx.isServer) {
      const keys = ctx.scene.keys;
      const pointer = ctx.scene.input.activePointer;

      // Movement direction
      const dir = (keys.right.isDown ? 1 : 0) - (keys.left.isDown ? 1 : 0);

      // Apply movement force (Soldat-style: raw force, no target speed)
      const force = this.onGround ? MOVE_FORCE_GROUND : MOVE_FORCE_AIR;
      if (dir !== 0) {
        this.vx += dir * force * dt;
      }

      // Sidejump / normal jump
      if (keys.jump.isDown && this.onGround) {
        if (dir !== 0) {
          // Sidejump: lower height, strong horizontal boost
          this.vy = SIDEJUMP_VERTICAL;
          this.vx += dir * SIDEJUMP_HORIZONTAL;
        } else {
          // Normal vertical jump
          this.vy = JUMP_VELOCITY;
        }
        this.onGround = false;
      }

      // Jetpack (right mouse button)
      if (pointer.rightButtonDown() && this.jetpackFuel > 0) {
        this.vy -= JETPACK_THRUST * dt;
        this.jetpackFuel -= JETPACK_BURN_RATE * dt;
        if (this.jetpackFuel < 0) this.jetpackFuel = 0;
        this.onGround = false;
        this.jetpacking = true;
      } else {
        this.jetpacking = false;
      }

      // Variable jump height: extra gravity when ascending without holding jump
      if (this.vy < 0 && !keys.jump.isDown && !this.jetpacking) {
        this.vy += JUMP_CUT_EXTRA_GRAVITY * dt;
      }

      // Aim: compute angle from player to mouse world position
      const cam = ctx.scene.cameras.main;
      const worldPoint = cam.getWorldPoint(pointer.x, pointer.y);
      const dx = worldPoint.x - this.x;
      const dy = worldPoint.y - this.y;
      if (dx * dx + dy * dy > 4) {
        this.angle = Math.atan2(dy, dx);
      }

      // Weapon switching (keys 1-5)
      if (keys.weapon1?.isDown) this.switchWeapon(0);
      if (keys.weapon2?.isDown) this.switchWeapon(1);
      if (keys.weapon3?.isDown) this.switchWeapon(2);
      if (keys.weapon4?.isDown) this.switchWeapon(3);
      if (keys.weapon5?.isDown) this.switchWeapon(4);

      // Reload
      if (keys.reload?.isDown) this.startReload();

      // Timers
      this.fireTimer -= FIXED_DT;
      if (this.fireTimer < 0) this.fireTimer = 0;

      if (this.reloadTimer > 0) {
        this.reloadTimer -= FIXED_DT;
        if (this.reloadTimer <= 0) {
          this.reloadTimer = 0;
          const weapon = WEAPONS[this.weaponType];
          this.ammo = weapon.clipSize;
        }
      }

      // Spread recovery
      const weapon = WEAPONS[this.weaponType];
      this.currentSpread -= weapon.spreadRecovery * dt;
      if (this.currentSpread < weapon.minSpread) {
        this.currentSpread = weapon.minSpread;
      }

      // Fire
      if (
        pointer.leftButtonDown() &&
        this.fireTimer <= 0 &&
        this.reloadTimer <= 0 &&
        this.ammo > 0
      ) {
        this.fire(ctx);
      }
    }

    if (!ctx.isServer) {
      // Apply gravity
      this.vy += GRAVITY * dt;

      // AABB collision resolution
      if (ctx.game.map) {
        const moveX = this.vx * dt;
        const moveY = this.vy * dt;
        const result = resolveAABBCollision(
          this.x, this.y, moveX, moveY,
          PLAYER_RADIUS, PLAYER_RADIUS, ctx.game.map,
        );
        this.x = result.x;
        this.y = result.y;
        if (result.moveX === 0) this.vx = 0;
        if (result.moveY === 0) this.vy = 0;
        if (result.onGround) this.onGround = true;
        else if (result.moveY !== 0) this.onGround = false;
      } else {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
      }

      // Soldat-style per-frame velocity damping (always active)
      this.vx *= VELOCITY_DAMPING;
      this.vy *= VELOCITY_DAMPING;

      // Additional surface friction on ground
      if (this.onGround) {
        this.vx *= SURFACE_FRICTION;
      }

      // Hard velocity cap
      if (Math.abs(this.vx) > MAX_VELOCITY) this.vx = Math.sign(this.vx) * MAX_VELOCITY;
      if (Math.abs(this.vy) > MAX_VELOCITY) this.vy = Math.sign(this.vy) * MAX_VELOCITY;

      // World boundary clamping
      if (ctx.game.map) {
        if (this.x < PLAYER_RADIUS) {
          this.x = PLAYER_RADIUS;
          this.vx = 0;
        } else if (this.x > ctx.game.map.pixelWidth - PLAYER_RADIUS) {
          this.x = ctx.game.map.pixelWidth - PLAYER_RADIUS;
          this.vx = 0;
        }
      }

      // Jetpack fuel regen when not using jetpack
      if (this.isLocal && !this.jetpacking) {
        this.jetpackFuel += JETPACK_REGEN_RATE * dt;
        if (this.jetpackFuel > JETPACK_FUEL_MAX) this.jetpackFuel = JETPACK_FUEL_MAX;
      }
    }
  }

  fire(ctx) {
    const weapon = WEAPONS[this.weaponType];

    this.ammo--;
    this.fireTimer = weapon.fireRate;
    this.currentSpread += weapon.spreadPerShot;
    if (this.currentSpread > weapon.maxSpread) {
      this.currentSpread = weapon.maxSpread;
    }

    const muzzleX = this.x + Math.cos(this.angle) * (GUN_OFFSET + weapon.muzzleLength);
    const muzzleY = this.y + Math.sin(this.angle) * (GUN_OFFSET + weapon.muzzleLength);

    for (let i = 0; i < weapon.pelletsPerShot; i++) {
      const spread = (Math.random() - 0.5) * 2 * this.currentSpread;
      const bulletAngle = this.angle + spread;
      const velX = Math.cos(bulletAngle) * weapon.bulletSpeed;
      const velY = Math.sin(bulletAngle) * weapon.bulletSpeed;

      const data = {
        ownerId: this.id,
        weaponType: this.weaponType,
        x: muzzleX,
        y: muzzleY,
        velX,
        velY,
      };

      const bullet = new Bullet(data, ctx);
      ctx.game.bullets.push(bullet);

      ctx.sendMessage("Shoot", data);
    }

    // Auto-reload if clip empty
    if (this.ammo <= 0) {
      this.startReload();
    }
  }

  drawCircle(ctx) {
    if (!ctx.scene) return;

    if (!this.gfx) {
      this.gfx = ctx.scene.add.graphics();
    }
    if (!this.aimGfx) {
      this.aimGfx = ctx.scene.add.graphics();
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

  drawAim() {
    if (!this.aimGfx) return;
    this.aimGfx.clear();
    this.aimGfx.lineStyle(2, 0xffffff, 0.6);
    this.aimGfx.beginPath();
    this.aimGfx.moveTo(
      Math.cos(this.angle) * GUN_OFFSET,
      Math.sin(this.angle) * GUN_OFFSET,
    );
    this.aimGfx.lineTo(
      Math.cos(this.angle) * (GUN_OFFSET + 20),
      Math.sin(this.angle) * (GUN_OFFSET + 20),
    );
    this.aimGfx.strokePath();
  }

  interpolate(alpha) {
    if (!this.gfx) return;
    const dispX = this.prevX + (this.x - this.prevX) * alpha;
    const dispY = this.prevY + (this.y - this.prevY) * alpha;
    this.gfx.setPosition(dispX, dispY);

    if (this.aimGfx) {
      this.aimGfx.setPosition(dispX, dispY);
    }

    this.drawAim();
  }

  smooth() {
    if (this.isLocal) return;
    this.x += (this.targetX - this.x) * SMOOTH_FACTOR;
    this.y += (this.targetY - this.y) * SMOOTH_FACTOR;
    this.vx += (this.targetVx - this.vx) * SMOOTH_FACTOR;
    this.vy += (this.targetVy - this.vy) * SMOOTH_FACTOR;

    // Smooth angle using shortest-path interpolation
    let angleDiff = this.targetAngle - this.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    this.angle += angleDiff * SMOOTH_FACTOR;
  }

  destroy() {
    if (this.gfx) {
      this.gfx.destroy();
      this.gfx = null;
    }
    if (this.aimGfx) {
      this.aimGfx.destroy();
      this.aimGfx = null;
    }
  }
}
