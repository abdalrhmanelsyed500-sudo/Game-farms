import type { CollisionMap } from './CollisionMap.js';

/**
 * CollisionSystem: resolves attempted movement against the CollisionMap.
 *
 * Axis-separated sliding: try full move, then X-only, then Y-only. This gives
 * smooth wall-sliding for free and is deterministic. Pure function of
 * (position, delta, map, radius) — trivially unit-testable.
 */
export class CollisionSystem {
  private readonly map: CollisionMap;

  public constructor(map: CollisionMap) {
    this.map = map;
  }

  public get collisionMap(): CollisionMap {
    return this.map;
  }

  /**
   * Resolve one movement step. Returns the new position (may equal the old
   * one when fully blocked).
   */
  public move(
    x: number,
    y: number,
    dx: number,
    dy: number,
    radius: number,
  ): { x: number; y: number } {
    // Fast path: full move is free.
    if (this.map.isCircleWalkable(x + dx, y + dy, radius)) {
      return { x: x + dx, y: y + dy };
    }
    // Slide along Y-blockers: try X-only.
    const canX = dx !== 0 && this.map.isCircleWalkable(x + dx, y, radius);
    // Slide along X-blockers: try Y-only.
    const canY = dy !== 0 && this.map.isCircleWalkable(x, y + dy, radius);
    return {
      x: canX ? x + dx : x,
      y: canY ? y + dy : y,
    };
  }
}
