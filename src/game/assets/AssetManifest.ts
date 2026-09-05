/**
 * AssetManifest: the single registry of every texture the game uses.
 *
 * Gameplay/rendering code refers to assets ONLY by manifest key
 * (e.g. "tree_01", "tile_grass_02"). Swapping placeholder art for final art
 * later means changing the manifest + loader — never gameplay code.
 *
 * Phase 1: all textures are procedurally generated placeholders
 * (generated: true). File-based entries (path: ...) are supported by
 * AssetLoader for future phases and need no code changes elsewhere.
 */

export type AssetCategory = 'tile' | 'object' | 'entity' | 'fx' | 'ui';

export interface AssetDefinition {
  readonly key: string;
  readonly category: AssetCategory;
  /** Expected pixel dimensions (placeholders respect final dimensions). */
  readonly width: number;
  readonly height: number;
  /** Ground-contact anchor as a fraction of the texture. */
  readonly originX: number;
  readonly originY: number;
  /** True => built at runtime by PlaceholderTextureFactory. */
  readonly generated: boolean;
  /** Future file-based asset path (relative to /assets). */
  readonly path?: string;
}

function tile(key: string): AssetDefinition {
  return { key, category: 'tile', width: 128, height: 64, originX: 0.5, originY: 0.5, generated: true };
}

function obj(
  key: string,
  width: number,
  height: number,
  originX = 0.5,
  originY = 1,
): AssetDefinition {
  return { key, category: 'object', width, height, originX, originY, generated: true };
}

const DEFINITIONS: readonly AssetDefinition[] = [
  // -- terrain tiles (128x64 diamonds) --------------------------------------
  tile('tile_grass_01'),
  tile('tile_grass_02'),
  tile('tile_grass_03'),
  tile('tile_dirt_01'),
  tile('tile_dirt_02'),
  tile('tile_water_01'),
  tile('tile_water_02'),
  tile('tile_stone_01'),
  tile('tile_stone_02'),
  tile('tile_sand_01'),
  tile('tile_road_01'),
  tile('tile_road_02'),

  // -- world objects ----------------------------------------------------------
  obj('tree_01', 144, 208),
  obj('tree_02', 144, 208),
  obj('rock_01', 96, 72),
  obj('flower_01', 48, 64),
  obj('flower_02', 48, 64),
  obj('flower_03', 48, 64),
  obj('bush_01', 96, 80),

  // -- entities -----------------------------------------------------------------
  { key: 'player_placeholder', category: 'entity', width: 64, height: 96, originX: 0.5, originY: 1, generated: true },

  // -- fx / ui ------------------------------------------------------------------
  { key: 'shadow_blob', category: 'fx', width: 64, height: 24, originX: 0.5, originY: 0.5, generated: true },
  { key: 'tile_hover', category: 'ui', width: 128, height: 64, originX: 0.5, originY: 0.5, generated: true },
  { key: 'tile_selected', category: 'ui', width: 128, height: 64, originX: 0.5, originY: 0.5, generated: true },

  // -- Phase 2: farming -------------------------------------------------------------
  tile('soil_tilled'),
  tile('soil_watered'),
  tile('tile_valid'),
  tile('tile_invalid'),
  { key: 'fx_dot', category: 'fx', width: 16, height: 16, originX: 0.5, originY: 0.5, generated: true },

  // Wheat (48x64), corn (56x96 tall), tomato (56x64) — 4 stages each.
  obj('crop_wheat_stage_01', 48, 64),
  obj('crop_wheat_stage_02', 48, 64),
  obj('crop_wheat_stage_03', 48, 64),
  obj('crop_wheat_stage_04', 48, 64),
  obj('crop_corn_stage_01', 56, 96),
  obj('crop_corn_stage_02', 56, 96),
  obj('crop_corn_stage_03', 56, 96),
  obj('crop_corn_stage_04', 56, 96),
  obj('crop_tomato_stage_01', 56, 64),
  obj('crop_tomato_stage_02', 56, 64),
  obj('crop_tomato_stage_03', 56, 64),
  obj('crop_tomato_stage_04', 56, 64),

  // Farmhouse placeholder (Phase 2 static; BuildingSystem arrives later).
  obj('farmhouse_01', 216, 208),
];

export const ASSET_MANIFEST: Readonly<Record<string, AssetDefinition>> = Object.freeze(
  Object.fromEntries(DEFINITIONS.map((d) => [d.key, d])),
);

export const ASSET_KEYS: readonly string[] = DEFINITIONS.map((d) => d.key);

export function getAssetDefinition(key: string): AssetDefinition {
  const def = ASSET_MANIFEST[key];
  if (!def) {
    throw new Error(`ASSET_MANIFEST_ERROR: unknown asset key "${key}"`);
  }
  return def;
}
