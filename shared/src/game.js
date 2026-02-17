import { GameMap } from "./logic/map.js";
import { maps } from "./data/maps.js";

export class GameState {
  players = [];
  bullets = [];
  map = null;

  constructor(ctx) {
    this.ctx = ctx;
    this.ctx.game = this;
  }

  loadMap(mapKey) {
    const data = maps[mapKey];
    if (!data) throw new Error(`Unknown map: ${mapKey}`);
    this.map = new GameMap(data);
  }

  update() {
    for (const player of this.players) {
      player.update(this.ctx);
    }

    for (const bullet of this.bullets) {
      bullet.update(this.ctx);
    }

    // Remove dead bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      if (!this.bullets[i].alive) {
        this.bullets[i].destroy();
        this.bullets.splice(i, 1);
      }
    }
  }

  getPlayer(id) {
    return this.players.find((p) => p.id === id);
  }

  addPlayer(player) {
    this.players.push(player);
  }

  removePlayer(id) {
    const idx = this.players.findIndex((p) => p.id === id);
    if (idx !== -1) {
      this.players.splice(idx, 1);
    }
  }
}
