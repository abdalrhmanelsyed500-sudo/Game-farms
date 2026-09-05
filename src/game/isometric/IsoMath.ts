import {
  CHUNK_SIZE,
  TILE_HALF_HEIGHT,
  TILE_HALF_WIDTH,
  TILE_HEIGHT,
  TILE_WIDTH,
} from '../../shared/constants/config.js';
import type {
  ChunkCoord,
  IsoPoint,
  TileBounds,
  TileCoord,
  WorldPoint,
} from '../../shared/types/coordinates.js';

/**
 * Diamond isometric projection math.
 *
 * All functions here are PURE and deterministic: same inputs => same outputs,
 * no Phaser dependency, fully unit-testable in Node.
 *
 * Convention:
 * - World tile (tx, ty) occupies the unit square [tx, tx+1) x [ty, ty+1).
 * - worldToScreen(wx, wy) maps a world POINT to its projected pixel.
 * - A tile's diamond is CENTERED on worldToScreen(tx + 0.5, ty + 0.5).
 * - Entities stand ON worldToScreen(x, y) (ground-contact point).
 *
 * Standard diamond projection:
 *   screenX = originX + (x - y) * (TILE_WIDTH / 2)
 *   screenY = originY + (x + y) * (TILE_HEIGHT / 2)
 */

/** Project a world point to isometric world-pixel coordinates. */
export function worldToScreen(
  worldX: number,
  worldY: number,
  originX: number,
  originY: number,
  tileWidth: number = TILE_WIDTH,
  tileHeight: number = TILE_HEIGHT,
): IsoPoint {
  return {
    x: originX + (worldX - worldY) * (tileWidth / 2),
    y: originY + (worldX + worldY) * (tileHeight / 2),
  };
}

/** Inverse projection: isometric world-pixels back to a world point. */
export function screenToWorld(
  screenX: number,
  screenY: number,
  originX: number,
  originY: number,
  tileWidth: number = TILE_WIDTH,
  tileHeight: number = TILE_HEIGHT,
): WorldPoint {
  const dx = screenX - originX;
  const dy = screenY - originY;
  const halfW = tileWidth / 2;
  const halfH = tileHeight / 2;
  return {
    x: (dx / halfW + dy / halfH) / 2,
    y: (dy / halfH - dx / halfW) / 2,
  };
}

/** Alias kept for API symmetry with the spec: world => isometric pixels. */
export function worldToIsometric(
  worldX: number,
  worldY: number,
  originX: number,
  originY: number,
): IsoPoint {
  return worldToScreen(worldX, worldY, originX, originY);
}

/** Alias kept for API symmetry with the spec: isometric pixels => world. */
export function isometricToWorld(
  isoX: number,
  isoY: number,
  originX: number,
  originY: number,
): WorldPoint {
  return screenToWorld(isoX, isoY, originX, originY);
}

/** Which tile contains a world point (tiles are unit squares, floor-based). */
export function worldToTile(worldX: number, worldY: number): TileCoord {
  return { x: Math.floor(worldX), y: Math.floor(worldY) };
}

/**
 * Full pointer-pick pipeline helper (pure part): given an isometric
 * world-pixel position, return the integer tile under it.
 */
export function isoPointToTile(isoX: number, isoY: number, originX: number, originY: number): TileCoord {
  const world = screenToWorld(isoX, isoY, originX, originY);
  return worldToTile(world.x, world.y);
}

/** Projected center of a tile's diamond. */
export function tileCenterToScreen(
  tileX: number,
  tileY: number,
  originX: number,
  originY: number,
): IsoPoint {
  return worldToScreen(tileX + 0.5, tileY + 0.5, originX, originY);
}

/** Which chunk contains a tile (or a world point — floats are floored first). */
export function worldToChunk(worldX: number, worldY: number, chunkSize: number = CHUNK_SIZE): ChunkCoord {
  return {
    x: Math.floor(Math.floor(worldX) / chunkSize),
    y: Math.floor(Math.floor(worldY) / chunkSize),
  };
}

/** Inclusive tile bounds covered by a chunk. */
export function chunkToWorldBounds(chunkX: number, chunkY: number, chunkSize: number = CHUNK_SIZE): TileBounds {
  return {
    x0: chunkX * chunkSize,
    y0: chunkY * chunkSize,
    x1: chunkX * chunkSize + chunkSize - 1,
    y1: chunkY * chunkSize + chunkSize - 1,
  };
}

/** Canonical string key for a chunk coordinate ("cx,cy"). */
export function getChunkKey(chunkX: number, chunkY: number): string {
  return `${chunkX},${chunkY}`;
}

/** Parse a chunk key produced by getChunkKey. Throws on malformed input. */
export function parseChunkKey(key: string): ChunkCoord {
  const parts = key.split(',');
  if (parts.length !== 2) {
    throw new Error(`CHUNK_KEY_ERROR: malformed chunk key "${key}"`);
  }
  const x = Number(parts[0]);
  const y = Number(parts[1]);
  if (!Number.isInteger(x) || !Number.isInteger(y)) {
    throw new Error(`CHUNK_KEY_ERROR: malformed chunk key "${key}"`);
  }
  return { x, y };
}

/**
 * Compute the projection origin so the whole world sits in positive pixel
 * space: world (0,0) projects to (originX, 0) and the leftmost world point
 * (0, H) projects to x = 0.
 */
export function computeWorldOrigin(_worldWidth: number, worldHeight: number): IsoPoint {
  return {
    x: worldHeight * TILE_HALF_WIDTH,
    y: 0,
  };
}

/** Total projected pixel size of a W x H tile world. */
export function worldPixelSize(worldWidth: number, worldHeight: number): { width: number; height: number } {
  // Width spans (x - y) over [0, W] x [0, H] => (W + H) half-widths.
  // Height spans (x + y) over [0, W] x [0, H] => (W + H) half-heights.
  return {
    width: (worldWidth + worldHeight) * TILE_HALF_WIDTH,
    height: (worldWidth + worldHeight) * TILE_HALF_HEIGHT,
  };
}

/** Re-export tile dims for modules that only import IsoMath. */
export const ISO_TILE_WIDTH = TILE_WIDTH;
export const ISO_TILE_HEIGHT = TILE_HEIGHT;
