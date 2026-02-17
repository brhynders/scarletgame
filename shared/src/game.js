export class GameState {
  players = [];

  constructor(ctx) {
    this.ctx = ctx;
    this.ctx.game = this;
  }

  update() {
    // Loop through entities and update them (passing ctx)
    // Run current modes rules (ctf. dm, tdm, etc) and pass it ctx
  }
}
