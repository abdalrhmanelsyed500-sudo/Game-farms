/**
 * Farming data contracts (Phase 2).
 *
 * Pure types/enums — no logic, no Phaser. Shared by FarmingSystem (rules),
 * renderers (visuals), and tests. Crop CONTENT (durations, yields) lives in
 * game/farming/CropDefinitions.ts, never hard-coded in the system.
 */

/** Soil states. Only the Phase 2 subset is implemented; more can extend this. */
export enum SoilState {
  Normal = 'normal',
  Tilled = 'tilled',
  Watered = 'watered',
}

/** Player's selected farming tool (temporary system; inventory comes later). */
export enum ToolType {
  None = 'none',
  Hoe = 'hoe',
  Seed = 'seed',
  WateringCan = 'watering_can',
  /** Hand: harvest mature crops + generic interact. */
  Hand = 'hand',
}

/** Generic farm actions. BUILD/INTERACT are reserved for future phases. */
export enum FarmAction {
  Till = 'till',
  Plant = 'plant',
  Water = 'water',
  Harvest = 'harvest',
  Build = 'build',
  Interact = 'interact',
}

/** Data-driven crop definition. One system serves all crops. */
export interface CropDefinition {
  readonly id: string;
  readonly name: string;
  /** Total growth time in seconds at TIME_SCALE 1 (dev-tuned, see config). */
  readonly growthDurationSec: number;
  /** Number of visual stages (Phase 2: 4 for every crop). */
  readonly growthStages: number;
  readonly yieldItemId: string;
  readonly yieldAmount: number;
  readonly seedItemId: string;
  readonly waterRequired: boolean;
}

/** Authoritative per-tile crop state. Growth derives from timestamps. */
export interface CropStateData {
  readonly cropId: string;
  readonly tileX: number;
  readonly tileY: number;
  /** Epoch ms when planted (source of truth for age). */
  readonly plantedAtMs: number;
  /** Growth milliseconds accrued while watered (rolled forward by update). */
  grownMs: number;
  /** Epoch ms when (last) watered; null when never watered. */
  wateredAtMs: number | null;
  /** Whether the crop is currently watered. */
  watered: boolean;
  /** Last computed stage (cache; recomputed from timestamps). */
  stage: number;
}

/** Data-driven farm plot rectangle (future: player-owned area). */
export interface FarmPlotData {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Temporary harvest result (real InventorySystem arrives in a later phase). */
export interface HarvestResult {
  readonly cropId: string;
  readonly cropName: string;
  readonly quantity: number;
  readonly tileX: number;
  readonly tileY: number;
}

/** Machine-readable reasons for rejected farming actions (UI feedback). */
export enum FarmRejectReason {
  OutsideFarmPlot = 'outside-farm-plot',
  BadTerrain = 'bad-terrain',
  BlockedByObject = 'blocked-by-object',
  SoilNotNormal = 'soil-not-normal',
  SoilNotTilled = 'soil-not-tilled',
  NoCrop = 'no-crop',
  AlreadyPlanted = 'already-planted',
  AlreadyWatered = 'already-watered',
  NotMature = 'not-mature',
  NoSeeds = 'no-seeds',
  UnknownSeed = 'unknown-seed',
  OutOfBounds = 'out-of-bounds',
  UnsupportedAction = 'unsupported-action',
  /** Harvest blocked: inventory cannot hold the yield (crop stays planted). */
  InventoryFull = 'inventory-full',
}
