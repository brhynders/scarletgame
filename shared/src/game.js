import { GameMap } from "./logic/map.js";
import { maps } from "./data/maps.js";

export class GameState {
  players = [];
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
