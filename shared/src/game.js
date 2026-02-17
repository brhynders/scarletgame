export class GameState {
  players = [];

  constructor(ctx) {
    this.ctx = ctx;
    this.ctx.game = this;
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
