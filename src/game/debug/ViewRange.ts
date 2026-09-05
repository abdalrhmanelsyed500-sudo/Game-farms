import type { TileBounds } from '../../shared/types/coordinates.js';
import type { Coordinates } from '../isometric/Coordinates.js';
import type { IsoCamera } from '../isometric/IsoCamera.js';

/**
 * Compute the integer tile range intersecting the camera view.
 * Projects the four view corners back to world space and pads by one tile.
 * Shared by GridOverlay and CollisionOverlay so both stay in sync.
 */
export function computeVisibleTileRange(
  camera: IsoCamera,
  coordinates: Coordinates,
  worldWidth: number,
  worldHeight: number,
): TileBounds {
  const rect = camera.getViewRect();
  const corners = [
    coordinates.screenToWorld(rect.x, rect.y),
    coordinates.screenToWorld(rect.x + rect.width, rect.y),
    coordinates.screenToWorld(rect.x, rect.y + rect.height),
    coordinates.screenToWorld(rect.x + rect.width, rect.y + rect.height),
  ];
  let x0 = Number.POSITIVE_INFINITY;
  let y0 = Number.POSITIVE_INFINITY;
  let x1 = Number.NEGATIVE_INFINITY;
  let y1 = Number.NEGATIVE_INFINITY;
  for (const c of corners) {
    x0 = Math.min(x0, Math.floor(c.x));
    y0 = Math.min(y0, Math.floor(c.y));
    x1 = Math.max(x1, Math.floor(c.x));
    y1 = Math.max(y1, Math.floor(c.y));
  }
  return {
    x0: Math.max(0, x0 - 1),
    y0: Math.max(0, y0 - 1),
    x1: Math.min(worldWidth - 1, x1 + 1),
    y1: Math.min(worldHeight - 1, y1 + 1),
  };
}

/** Diamond corner offsets for a 128x64 tile centered on (cx, cy). */
export function diamondCorners(cx: number, cy: number): Array<{ x: number; y: number }> {
  return [
    { x: cx, y: cy - 32 },
    { x: cx + 64, y: cy },
    { x: cx, y: cy + 32 },
    { x: cx - 64, y: cy },
  ];
}
