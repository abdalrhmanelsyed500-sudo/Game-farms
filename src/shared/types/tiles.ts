/**
 * Tile data types. Tiles are pure data — they never render themselves.
 * See game/rendering/TileRenderer.ts for the visual side.
 */
import type { SoilState } from './farming.js';

/** Logical terrain kinds supported in Phase 1. Numeric so TileMap can use typed arrays. */
export enum TerrainType {
  Grass = 0,
  Dirt = 1,
  Water = 2,
  Stone = 3,
  Sand = 4,
  Road = 5,
}

/** All terrain types, useful for iteration / validation. */
export const ALL_TERRAIN_TYPES: readonly TerrainType[] = [
  TerrainType.Grass,
  TerrainType.Dirt,
  TerrainType.Water,
  TerrainType.Stone,
  TerrainType.Sand,
  TerrainType.Road,
];

/** Human-readable terrain names (debugging / tools). */
export const TERRAIN_TYPE_NAMES: Record<TerrainType, string> = {
  [TerrainType.Grass]: 'GRASS',
  [TerrainType.Dirt]: 'DIRT',
  [TerrainType.Water]: 'WATER',
  [TerrainType.Stone]: 'STONE',
  [TerrainType.Sand]: 'SAND',
  [TerrainType.Road]: 'ROAD',
};

/** A single logical tile. Integer (x, y) address + gameplay flags. */
export interface TileData {
  readonly x: number;
  readonly y: number;
  readonly terrain: TerrainType;
  /** Visual variant index (grass_01, grass_02, ...). Data picks it, renderer resolves it. */
  readonly variantId: number;
  readonly walkable: boolean;
  readonly buildable: boolean;
  readonly elevation: number;
  /** Id of the object whose footprint covers this tile, if any. */
  readonly objectId: string | null;
  // -- Phase 2: farming state (additive; terrain behavior unchanged) -----------
  /** Soil condition. Authoritative copy lives in the farm state provider. */
  readonly soil: SoilState;
  /** Whether the soil is currently watered (mirrors soil === Watered). */
  readonly watered: boolean;
  /** Planted crop id, if any. */
  readonly cropId: string | null;
  /** Last computed crop stage (meaningful only when cropId is set). */
  readonly cropStage: number;
  readonly metadata: Readonly<Record<string, unknown>>;
}
