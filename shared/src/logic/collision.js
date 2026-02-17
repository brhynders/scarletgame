import { PLAYER_RADIUS } from "../data/constants.js";

export function resolveTileCollision(player, map) {
  const half = PLAYER_RADIUS;

  // Resolve X axis first
  let left = Math.floor((player.x - half) / map.tileWidth);
  let right = Math.floor((player.x + half - 0.001) / map.tileWidth);
  let top = Math.floor((player.y - half) / map.tileHeight);
  let bottom = Math.floor((player.y + half - 0.001) / map.tileHeight);

  for (let row = top; row <= bottom; row++) {
    for (let col = left; col <= right; col++) {
      if (map.isSolid(col, row)) {
        if (player.vx > 0) {
          player.x = col * map.tileWidth - half;
        } else if (player.vx < 0) {
          player.x = (col + 1) * map.tileWidth + half;
        } else {
          const tileCenterX = (col + 0.5) * map.tileWidth;
          if (player.x < tileCenterX) {
            player.x = col * map.tileWidth - half;
          } else {
            player.x = (col + 1) * map.tileWidth + half;
          }
        }
        player.vx = 0;
      }
    }
  }

  // Resolve Y axis (recalculate bounds after X resolution)
  left = Math.floor((player.x - half) / map.tileWidth);
  right = Math.floor((player.x + half - 0.001) / map.tileWidth);
  top = Math.floor((player.y - half) / map.tileHeight);
  bottom = Math.floor((player.y + half - 0.001) / map.tileHeight);

  for (let row = top; row <= bottom; row++) {
    for (let col = left; col <= right; col++) {
      if (map.isSolid(col, row)) {
        if (player.vy > 0) {
          player.y = row * map.tileHeight - half;
          player.onGround = true;
        } else if (player.vy < 0) {
          player.y = (row + 1) * map.tileHeight + half;
        } else {
          const tileCenterY = (row + 0.5) * map.tileHeight;
          if (player.y < tileCenterY) {
            player.y = row * map.tileHeight - half;
            player.onGround = true;
          } else {
            player.y = (row + 1) * map.tileHeight + half;
          }
        }
        player.vy = 0;
      }
    }
  }

  // Clamp to map pixel bounds
  player.x = Math.max(half, Math.min(map.pixelWidth - half, player.x));
  player.y = Math.max(half, Math.min(map.pixelHeight - half, player.y));
}
