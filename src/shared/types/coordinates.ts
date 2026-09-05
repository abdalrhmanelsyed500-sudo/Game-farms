/**
 * Coordinate-space types.
 *
 * The engine works with THREE distinct coordinate spaces. They must never be
 * mixed up — gameplay state always lives in WORLD coordinates:
 *
 * 1. WORLD / GRID coordinates — logical tiles (integers) and entity positions
 *    (floats). This is the authoritative space for all gameplay state.
 * 2. ISOMETRIC / WORLD-PIXEL coordinates — projected pixel positions of the
 *    world surface (Phaser world space, before camera scroll/zoom).
 * 3. SCREEN coordinates — raw pixels on the canvas / pointer positions.
 */

/** Logical world position. Integers address tiles; floats address points (entities). */
export interface WorldPoint {
  readonly x: number;
  readonly y: number;
}

/** Projected isometric pixel position in Phaser world space. */
export interface IsoPoint {
  readonly x: number;
  readonly y: number;
}

/** Raw canvas pixel position (e.g. pointer position). */
export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

/** Integer tile address. */
export interface TileCoord {
  readonly x: number;
  readonly y: number;
}

/** Integer chunk address. */
export interface ChunkCoord {
  readonly x: number;
  readonly y: number;
}

/** Axis-aligned rectangle in tile space (inclusive bounds). */
export interface TileBounds {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}
