import { hashString } from '../../shared/utils/MathUtils.js';
import type { WorldObjectData } from '../../shared/types/objects.js';
import { RENDER_DEPTH_EPSILON, RenderLayer } from '../rendering/RenderLayers.js';

/**
 * Deterministic isometric depth sorting.
 *
 * Strategy: within a layer band, depth = layerBase + (sortX + sortY) * eps
 * where (sortX, sortY) is the object's FRONT (maximum x+y) footprint corner.
 * An entity standing at the front edge of a tree's footprint sorts after
 * (in front of) the tree; standing at the back edge sorts before (behind).
 *
 * Ties (same tile, same footprint corner) are broken deterministically by a
 * hash of the object id, scaled far below one epsilon step.
 *
 * Pure + unit-tested. The renderer only applies the numbers produced here.
 */

const TIEBREAK_SCALE = RENDER_DEPTH_EPSILON / 1024;

/** Stable [0, 1) tiebreak fraction derived from an id. */
export function stableTiebreak(id: string): number {
  return (hashString(id) % 1024) / 1024;
}

/** Depth for a sort key inside a layer band. */
export function depthForSortKey(sortX: number, sortY: number, layerBase: number, tiebreakId?: string): number {
  const tie = tiebreakId !== undefined ? stableTiebreak(tiebreakId) * TIEBREAK_SCALE : 0;
  return layerBase + (sortX + sortY) * RENDER_DEPTH_EPSILON + tie;
}

/** Depth of a terrain tile. Tiles never overlap so this only needs stability. */
export function depthOfTile(tileX: number, tileY: number): number {
  return depthForSortKey(tileX, tileY, RenderLayer.Terrain);
}

/**
 * Depth of a world object. Uses the footprint's maximum (x + y) corner so
 * multi-tile objects (2x2 trees, future 4x4 barns) sort by their front edge.
 */
export function depthOfObject(obj: Pick<WorldObjectData, 'id' | 'x' | 'y' | 'width' | 'height'>): number {
  // Front corner: footprint spans [x, x+width) x [y, y+height); the greatest
  // covered integer corner is (x + width - 1, y + height - 1). We sort by the
  // footprint's far EDGE (+ width/height in continuous space is equivalent
  // for ordering, but the corner form keeps keys integral for data checks).
  const sortX = obj.x + obj.width;
  const sortY = obj.y + obj.height;
  return depthForSortKey(sortX, sortY, RenderLayer.WorldObjects, obj.id);
}

/** Depth of a free-moving entity (player, future NPCs/animals). */
export function depthOfEntity(worldX: number, worldY: number, entityId: string): number {
  return depthForSortKey(worldX, worldY, RenderLayer.WorldObjects, entityId);
}

/** Depth comparator for explicit ordering checks (tests, tools). */
export function compareDepths(
  a: { depth: number; id: string },
  b: { depth: number; id: string },
): number {
  if (a.depth !== b.depth) {
    return a.depth - b.depth;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Convenience: is `front` (larger x+y region) correctly rendered in front of
 * `back`? Used by tests and the depth debug tooling.
 */
export function isInFrontOf(
  front: Pick<WorldObjectData, 'id' | 'x' | 'y' | 'width' | 'height'>,
  back: Pick<WorldObjectData, 'id' | 'x' | 'y' | 'width' | 'height'>,
): boolean {
  return depthOfObject(front) > depthOfObject(back);
}
