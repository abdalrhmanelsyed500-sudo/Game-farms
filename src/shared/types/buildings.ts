/**
 * Building data contracts (Phase 3).
 *
 * Pure types/enums — no logic, no Phaser. Building CONTENT (costs,
 * footprints) lives in game/buildings/BuildingCatalog.ts; placement RULES
 * live in PlacementValidator; state changes live in BuildingSystem.
 */

/** One resource line of a building cost. */
export interface BuildingCostEntry {
  readonly itemId: string;
  readonly quantity: number;
}

/** Data-driven building definition. Footprint is in tiles at rotation 0. */
export interface BuildingDefinition {
  /** Stable id, e.g. 'building:small_house'. */
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** Footprint width/height in tiles at rotation 0. */
  readonly width: number;
  readonly height: number;
  /** Resource cost, deducted atomically on placement. */
  readonly cost: readonly BuildingCostEntry[];
  /** Manifest texture key for the placed building + ghost preview. */
  readonly spriteKey: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}

/** Supported placement rotations, degrees clockwise. */
export type BuildingRotation = 0 | 90 | 180 | 270;

/** All supported rotations, in cycle order (R key). */
export const BUILDING_ROTATIONS: readonly BuildingRotation[] = [0, 90, 180, 270];

/** Why a placement was rejected. Exactly one reason per failure. */
export enum PlacementRejectReason {
  UnknownBuilding = 'unknown_building',
  InvalidRotation = 'invalid_rotation',
  OutsideFarmPlot = 'outside_farm_plot',
  FootprintOutOfBounds = 'footprint_out_of_bounds',
  TileOccupied = 'tile_occupied',
  CropInFootprint = 'crop_in_footprint',
  InsufficientResources = 'insufficient_resources',
}

/** One unmet resource line, for UI display ("need 30 more wood"). */
export interface MissingResource {
  readonly itemId: string;
  readonly needed: number;
  readonly have: number;
}

/** Result of a placement validation or attempt. */
export type PlacementResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: PlacementRejectReason; readonly missing?: readonly MissingResource[] };

/** Persisted record of one placed building. */
export interface PlacedBuildingData {
  readonly buildingId: string;
  /** Footprint min-corner tile (after rotation). */
  readonly anchorX: number;
  readonly anchorY: number;
  readonly rotation: BuildingRotation;
  /** Id of the WorldObject created for this building. */
  readonly objectId: string;
}
