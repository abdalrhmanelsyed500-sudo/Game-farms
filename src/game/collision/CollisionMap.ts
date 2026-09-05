import type { World } from '../world/World.js';

/**
 * CollisionMap: answers "can something be here?" using LOGICAL coordinates.
 *
 * It wraps World walkability and adds shape queries (circle vs blocked
 * tiles) for entities with a radius. Pure logic — no Phaser physics; Phaser
 * is only the presentation layer, never the source of collision truth.
 */
export class CollisionMap {
  private readonly world: World;

  public constructor(world: World) {
    this.world = world;
  }

  /** Integer tile walkability (terrain + object footprints + bounds). */
  public isWalkable(tileX: number, tileY: number): boolean {
    return this.world.isWalkable(tileX, tileY);
  }

  /**
   * Can a circle (center + radius in world units) rest here? Checks every
   * tile the circle overlaps. Used for entity movement resolution.
   */
  public isCircleWalkable(worldX: number, worldY: number, radius: number): boolean {
    const x0 = Math.floor(worldX - radius);
    const x1 = Math.floor(worldX + radius);
    const y0 = Math.floor(worldY - radius);
    const y1 = Math.floor(worldY + radius);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (!this.isWalkable(tx, ty)) {
          // Only reject when the circle actually reaches into the tile.
          if (this.circleOverlapsTile(worldX, worldY, radius, tx, ty)) {
            return false;
          }
        }
      }
    }
    return true;
  }

  /**
   * Circle-vs-unit-tile overlap test. Tiles are [tx, tx+1) x [ty, ty+1).
   */
  private circleOverlapsTile(
    cx: number,
    cy: number,
    radius: number,
    tx: number,
    ty: number,
  ): boolean {
    const nearestX = Math.min(Math.max(cx, tx), tx + 1);
    const nearestY = Math.min(Math.max(cy, ty), ty + 1);
    const dx = cx - nearestX;
    const dy = cy - nearestY;
    return dx * dx + dy * dy < radius * radius;
  }
}
