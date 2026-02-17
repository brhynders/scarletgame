export class Player {
  prevX = null;
  prevY = null;
  prevAngle = null;
  x = null;
  y = null;
  angle = null;
  vx = null;
  vy = null;
  team = null;
  health = 100;

  constructor() {}

  update(ctx) {
    // Set prev values before updating - for sub-tick interpolation
    this.prevX = this.x;
    this.prevY = this.y;
    this.prevAngle = this.angle;
  }
}
