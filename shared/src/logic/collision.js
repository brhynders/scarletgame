import { PLAYER_RADIUS } from "../data/constants.js";

/**
 * AABB collision resolution against the tilemap.
 * Resolves X then Y. Returns a result object (does not mutate inputs).
 */
export function resolveAABBCollision(x, y, moveX, moveY, halfW, halfH, map) {
  let onGround = false;

  // Resolve X-axis first
  const newX = x + moveX;
  const startRow = Math.floor((y - halfH) / map.tileHeight);
  const endRow = Math.floor((y + halfH - 0.01) / map.tileHeight);
  const startColX = Math.floor((newX - halfW) / map.tileWidth);
  const endColX = Math.floor((newX + halfW - 0.01) / map.tileWidth);

  let resolvedX = newX;
  let resolvedMoveX = moveX;

  for (let row = startRow; row <= endRow; row++) {
    for (let col = startColX; col <= endColX; col++) {
      if (map.isSolid(col, row)) {
        if (moveX > 0) {
          resolvedX = col * map.tileWidth - halfW;
        } else if (moveX < 0) {
          resolvedX = (col + 1) * map.tileWidth + halfW;
        }
        resolvedMoveX = 0;
      }
    }
  }

  // Resolve Y-axis
  const newY = y + moveY;
  const startCol = Math.floor((resolvedX - halfW) / map.tileWidth);
  const endCol = Math.floor((resolvedX + halfW - 0.01) / map.tileWidth);
  const startRowY = Math.floor((newY - halfH) / map.tileHeight);
  const endRowY = Math.floor((newY + halfH - 0.01) / map.tileHeight);

  let resolvedY = newY;
  let resolvedMoveY = moveY;

  for (let row = startRowY; row <= endRowY; row++) {
    for (let col = startCol; col <= endCol; col++) {
      if (map.isSolid(col, row)) {
        if (moveY > 0) {
          resolvedY = row * map.tileHeight - halfH;
          onGround = true;
        } else if (moveY < 0) {
          resolvedY = (row + 1) * map.tileHeight + halfH;
        }
        resolvedMoveY = 0;
      }
    }
  }

  return { x: resolvedX, y: resolvedY, moveX: resolvedMoveX, moveY: resolvedMoveY, onGround };
}

/**
 * DDA grid raycast from (x0,y0) to (x1,y1).
 * Returns { hit, x, y } — position just before the first solid tile boundary,
 * or { hit: false } if the path is clear.
 */
export function raycastTiles(x0, y0, x1, y1, map) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const tw = map.tileWidth;
  const th = map.tileHeight;

  if (dx === 0 && dy === 0) {
    return map.isSolid(Math.floor(x0 / tw), Math.floor(y0 / th))
      ? { hit: true, x: x0, y: y0 }
      : { hit: false };
  }

  let col = Math.floor(x0 / tw);
  let row = Math.floor(y0 / th);

  const stepCol = dx > 0 ? 1 : dx < 0 ? -1 : 0;
  const stepRow = dy > 0 ? 1 : dy < 0 ? -1 : 0;

  let tMaxX, tMaxY, tDeltaX, tDeltaY;

  if (dx !== 0) {
    const nextX = stepCol > 0 ? (col + 1) * tw : col * tw;
    tMaxX = (nextX - x0) / dx;
    tDeltaX = Math.abs(tw / dx);
  } else {
    tMaxX = Infinity;
    tDeltaX = Infinity;
  }

  if (dy !== 0) {
    const nextY = stepRow > 0 ? (row + 1) * th : row * th;
    tMaxY = (nextY - y0) / dy;
    tDeltaY = Math.abs(th / dy);
  } else {
    tMaxY = Infinity;
    tDeltaY = Infinity;
  }

  // Starting cell already solid
  if (map.isSolid(col, row)) {
    return { hit: true, x: x0, y: y0 };
  }

  // Pull back by 0.5px so the bullet stops just outside the tile
  const dist = Math.sqrt(dx * dx + dy * dy);
  const epsilon = 0.5 / dist;

  while (true) {
    let t;
    if (tMaxX < tMaxY) {
      t = tMaxX;
      col += stepCol;
      tMaxX += tDeltaX;
    } else {
      t = tMaxY;
      row += stepRow;
      tMaxY += tDeltaY;
    }

    if (t > 1) break;

    if (map.isSolid(col, row)) {
      const hitT = Math.max(0, t - epsilon);
      return { hit: true, x: x0 + dx * hitT, y: y0 + dy * hitT };
    }
  }

  return { hit: false };
}

/**
 * Segment-circle intersection test.
 * Tests if the line segment from (x0,y0)→(x1,y1) intersects a circle at (cx,cy) with radius r.
 * Returns the parametric t in [0,1] of the earliest intersection, or -1 if none.
 */
export function segmentCircleIntersect(x0, y0, x1, y1, cx, cy, r) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const ocx = x0 - cx;
  const ocy = y0 - cy;

  const a = dx * dx + dy * dy;
  if (a === 0) {
    // Zero-length segment — point-in-circle test
    return (ocx * ocx + ocy * ocy <= r * r) ? 0 : -1;
  }

  const b = 2 * (ocx * dx + ocy * dy);
  const c = ocx * ocx + ocy * ocy - r * r;

  const disc = b * b - 4 * a * c;
  if (disc < 0) return -1;

  const sqrtDisc = Math.sqrt(disc);
  const t1 = (-b - sqrtDisc) / (2 * a);
  if (t1 >= 0 && t1 <= 1) return t1;

  // Second root handles ray starting inside the circle
  const t2 = (-b + sqrtDisc) / (2 * a);
  if (t2 >= 0 && t2 <= 1) return t2;

  return -1;
}
