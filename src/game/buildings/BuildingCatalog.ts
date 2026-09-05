/**
 * BuildingCatalog (Phase 3): single source of truth for building definitions.
 *
 * Data-driven like CropDefinitions/ItemCatalog: costs, footprints, and
 * sprites live here — never hard-coded in the system, validator, or UI.
 * Starter stock (100 wood / 60 stone) affords house+shed together, while
 * the barn forces a real choice (nothing left for a second building).
 */
import type { BuildingDefinition, BuildingRotation } from '../../shared/types/buildings.js';

const BUILDINGS: readonly BuildingDefinition[] = [
  {
    id: 'building:small_house',
    name: 'Small House',
    description: 'A cozy cottage. Purely decorative for now.',
    width: 3,
    height: 2,
    cost: [
      { itemId: 'item:wood', quantity: 50 },
      { itemId: 'item:stone', quantity: 20 },
    ],
    spriteKey: 'building_small_house',
    metadata: {},
  },
  {
    id: 'building:barn',
    name: 'Barn',
    description: 'A big red barn. The farm centerpiece.',
    width: 4,
    height: 3,
    cost: [
      { itemId: 'item:wood', quantity: 80 },
      { itemId: 'item:stone', quantity: 40 },
    ],
    spriteKey: 'building_barn',
    metadata: {},
  },
  {
    id: 'building:storage_shed',
    name: 'Storage Shed',
    description: 'A handy shed for tools that do not exist yet.',
    width: 2,
    height: 2,
    cost: [
      { itemId: 'item:wood', quantity: 30 },
      { itemId: 'item:stone', quantity: 10 },
    ],
    spriteKey: 'building_storage_shed',
    metadata: {},
  },
];

const BY_ID = new Map<string, BuildingDefinition>(BUILDINGS.map((d) => [d.id, d]));

/** All building definitions in build-menu order. */
export function getBuildingDefinitions(): readonly BuildingDefinition[] {
  return BUILDINGS;
}

/** Look up a building by stable id, or null when unknown. */
export function getBuildingDefinition(id: string): BuildingDefinition | null {
  return BY_ID.get(id) ?? null;
}

/** Look up a building by stable id; throws on unknown ids (fail loudly). */
export function requireBuildingDefinition(id: string): BuildingDefinition {
  const def = BY_ID.get(id);
  if (!def) {
    throw new Error(`[BuildingCatalog] unknown building id "${id}"`);
  }
  return def;
}

/**
 * Effective footprint after rotation. Quarter turns swap width/height;
 * the anchor tile stays the footprint's min corner.
 */
export function footprintForRotation(
  def: Pick<BuildingDefinition, 'width' | 'height'>,
  rotation: BuildingRotation,
): { width: number; height: number } {
  if (rotation === 90 || rotation === 270) {
    return { width: def.height, height: def.width };
  }
  return { width: def.width, height: def.height };
}

/** All footprint tiles for an anchor + rotation. */
export function footprintTilesFor(
  anchorX: number,
  anchorY: number,
  def: Pick<BuildingDefinition, 'width' | 'height'>,
  rotation: BuildingRotation,
): Array<{ x: number; y: number }> {
  const { width, height } = footprintForRotation(def, rotation);
  const tiles: Array<{ x: number; y: number }> = [];
  for (let y = anchorY; y < anchorY + height; y++) {
    for (let x = anchorX; x < anchorX + width; x++) {
      tiles.push({ x, y });
    }
  }
  return tiles;
}

/** Type-guard for rotation values coming from UI/debug input. */
export function isBuildingRotation(value: unknown): value is BuildingRotation {
  return value === 0 || value === 90 || value === 180 || value === 270;
}
