import { WorldObjectType, type WorldObjectData } from '../../shared/types/objects.js';
import type { TileCoord } from '../../shared/types/coordinates.js';

/** Default logical footprints per object type (tiles). */
export const OBJECT_FOOTPRINTS: Readonly<Record<WorldObjectType, { width: number; height: number }>> = {
  [WorldObjectType.Tree]: { width: 2, height: 2 },
  [WorldObjectType.Rock]: { width: 1, height: 1 },
  [WorldObjectType.Flower]: { width: 1, height: 1 },
  [WorldObjectType.Bush]: { width: 1, height: 1 },
  [WorldObjectType.Farmhouse]: { width: 3, height: 2 },
};

/** Which object types block movement (decor like flowers does not). */
const BLOCKING_OBJECTS: Readonly<Record<WorldObjectType, boolean>> = {
  [WorldObjectType.Tree]: true,
  [WorldObjectType.Rock]: true,
  [WorldObjectType.Flower]: false,
  [WorldObjectType.Bush]: false,
  [WorldObjectType.Farmhouse]: true,
};

let nextRuntimeId = 1;

/** Create a WorldObjectData with consistent defaults. Prefixed ids keep tests deterministic. */
export function createWorldObject(
  type: WorldObjectType,
  x: number,
  y: number,
  options: {
    id?: string;
    variantId?: number;
    elevation?: number;
    spriteKey?: string;
    walkable?: boolean;
    width?: number;
    height?: number;
    metadata?: Record<string, unknown>;
  } = {},
): WorldObjectData {
  const footprint = OBJECT_FOOTPRINTS[type];
  const variantId = options.variantId ?? 0;
  return {
    id: options.id ?? `obj-${nextRuntimeId++}`,
    type,
    x,
    y,
    width: options.width ?? footprint.width,
    height: options.height ?? footprint.height,
    elevation: options.elevation ?? 0,
    walkable: options.walkable ?? !BLOCKING_OBJECTS[type],
    spriteKey: options.spriteKey ?? defaultSpriteKey(type, variantId),
    variantId,
    metadata: options.metadata ?? {},
  };
}

/** Convention: `${type}_${variant + 1, zero-padded}` => tree_01, rock_01, ... */
export function defaultSpriteKey(type: WorldObjectType, variantId: number): string {
  return `${type}_${String(variantId + 1).padStart(2, '0')}`;
}

/** All integer tiles covered by an object's footprint. */
export function footprintTiles(obj: Pick<WorldObjectData, 'x' | 'y' | 'width' | 'height'>): TileCoord[] {
  const tiles: TileCoord[] = [];
  for (let y = obj.y; y < obj.y + obj.height; y++) {
    for (let x = obj.x; x < obj.x + obj.width; x++) {
      tiles.push({ x, y });
    }
  }
  return tiles;
}

/** Continuous-space center of the footprint (ground anchor reference). */
export function footprintCenter(obj: Pick<WorldObjectData, 'x' | 'y' | 'width' | 'height'>): { x: number; y: number } {
  return { x: obj.x + obj.width / 2, y: obj.y + obj.height / 2 };
}
