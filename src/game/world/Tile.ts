import { SoilState } from '../../shared/types/farming.js';
import { TerrainType, type TileData } from '../../shared/types/tiles.js';

/**
 * Tile helpers. Tiles are plain data (TileData) — this module holds the
 * shared rules about terrain (walkability, buildability) so gameplay code
 * never hard-codes per-terrain behavior in multiple places.
 */

/** Which terrain kinds can be walked on (before object collision). */
const WALKABLE_TERRAIN: Readonly<Record<TerrainType, boolean>> = {
  [TerrainType.Grass]: true,
  [TerrainType.Dirt]: true,
  [TerrainType.Water]: false,
  [TerrainType.Stone]: true,
  [TerrainType.Sand]: true,
  [TerrainType.Road]: true,
};

/** Which terrain kinds can host buildings (future phases; data-ready now). */
const BUILDABLE_TERRAIN: Readonly<Record<TerrainType, boolean>> = {
  [TerrainType.Grass]: true,
  [TerrainType.Dirt]: true,
  [TerrainType.Water]: false,
  [TerrainType.Stone]: false,
  [TerrainType.Sand]: false,
  [TerrainType.Road]: false,
};

export function isTerrainWalkable(terrain: TerrainType): boolean {
  return WALKABLE_TERRAIN[terrain] ?? false;
}

export function isTerrainBuildable(terrain: TerrainType): boolean {
  return BUILDABLE_TERRAIN[terrain] ?? false;
}

/** Create a fully-formed TileData with consistent derived flags. */
export function createTile(
  x: number,
  y: number,
  terrain: TerrainType,
  options: {
    variantId?: number;
    elevation?: number;
    objectId?: string | null;
    metadata?: Record<string, unknown>;
    soil?: SoilState;
    watered?: boolean;
    cropId?: string | null;
    cropStage?: number;
  } = {},
): TileData {
  const soil = options.soil ?? SoilState.Normal;
  return {
    x,
    y,
    terrain,
    variantId: options.variantId ?? 0,
    walkable: isTerrainWalkable(terrain),
    buildable: isTerrainBuildable(terrain),
    elevation: options.elevation ?? 0,
    objectId: options.objectId ?? null,
    soil,
    watered: options.watered ?? soil === SoilState.Watered,
    cropId: options.cropId ?? null,
    cropStage: options.cropStage ?? 0,
    metadata: options.metadata ?? {},
  };
}
