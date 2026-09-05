import { FARM_TIME_SCALE } from '../../shared/constants/config.js';
import {
  FarmAction,
  FarmRejectReason,
  SoilState,
  type CropStateData,
  type FarmPlotData,
  type HarvestResult,
} from '../../shared/types/farming.js';
import type { ChunkCoord } from '../../shared/types/coordinates.js';
import { TerrainType } from '../../shared/types/tiles.js';
import { TypedEventEmitter } from '../../shared/utils/EventEmitter.js';
import { Logger } from '../../shared/utils/Logger.js';
import type { World } from '../world/World.js';
import type { InventorySystem } from '../items/InventorySystem.js';
import { getCropDefinition, requireCropDefinition } from './CropDefinitions.js';
import type { Clock } from './Clock.js';
import type { FarmStateProvider } from './FarmStateProvider.js';

/** Events emitted for every farming state change. Renderers/UI subscribe. */
export interface FarmingEvents {
  'soil-changed': { x: number; y: number; soil: SoilState };
  'crop-planted': { crop: CropStateData };
  'crop-watered': { crop: CropStateData };
  'crop-stage': { crop: CropStateData; stage: number };
  'crop-removed': { x: number; y: number; cropId: string };
  'harvest': HarvestResult;
  'action-rejected': { action: FarmAction; x: number; y: number; reason: FarmRejectReason };
}

/** Validation outcome shared by canX() checks. */
export interface FarmValidation {
  readonly ok: boolean;
  readonly reason?: FarmRejectReason;
}

export interface FarmActionResult extends FarmValidation {
  readonly harvest?: HarvestResult;
}

const OK: FarmValidation = { ok: true };

function rejected(reason: FarmRejectReason): FarmValidation {
  return { ok: false, reason };
}

/**
 * FarmingSystem: all Phase 2 farming RULES in one place.
 *
 * - Validates + mutates farming state (soil, crops) via a FarmStateProvider.
 * - Growth derives from TIMESTAMPS (plantedAt/wateredAt + accrued grownMs),
 *   never from timers — server-authoritative growth slots in later.
 * - Emits events per change; knows NOTHING about renderers, scenes, or input.
 *   (WorldScene bridges events → CropRenderer/SoilRenderer/effects.)
 *
 * Depends only on pure modules (World data, provider, seeds, clock):
 * fully unit-testable with a ManualClock and zero Phaser.
 */
export class FarmingSystem {
  public readonly events = new TypedEventEmitter<FarmingEvents>();

  private readonly world: World;
  private readonly farmState: FarmStateProvider;
  private readonly inventory: InventorySystem;
  private readonly clock: Clock;
  private readonly timeScale: number;

  public constructor(
    world: World,
    farmState: FarmStateProvider,
    inventory: InventorySystem,
    clock: Clock,
    timeScale: number = FARM_TIME_SCALE,
  ) {
    this.world = world;
    this.farmState = farmState;
    this.inventory = inventory;
    this.clock = clock;
    this.timeScale = timeScale;
  }

  public getPlot(): FarmPlotData {
    return this.farmState.getPlot();
  }

  public getSoilAt(tileX: number, tileY: number): SoilState {
    return this.farmState.getSoil(tileX, tileY);
  }

  public getCropAt(tileX: number, tileY: number): CropStateData | null {
    return this.farmState.getCrop(tileX, tileY);
  }

  // -- generic action entry -----------------------------------------------------

  /**
   * Single entry point for tools/UI. Routes to the specific action and emits
   * 'action-rejected' on failure so UI can show feedback.
   */
  public execute(action: FarmAction, tileX: number, tileY: number, cropId?: string): FarmActionResult {
    let result: FarmActionResult;
    switch (action) {
      case FarmAction.Till:
        result = this.till(tileX, tileY);
        break;
      case FarmAction.Plant:
        result = this.plant(tileX, tileY, cropId ?? '');
        break;
      case FarmAction.Water:
        result = this.water(tileX, tileY);
        break;
      case FarmAction.Harvest:
        result = this.harvest(tileX, tileY);
        break;
      case FarmAction.Build:
      case FarmAction.Interact:
      default:
        result = rejected(FarmRejectReason.UnsupportedAction);
        break;
    }
    if (!result.ok && result.reason) {
      this.events.emit('action-rejected', { action, x: tileX, y: tileY, reason: result.reason });
    }
    return result;
  }

  // -- till ----------------------------------------------------------------------

  public canTill(tileX: number, tileY: number): FarmValidation {
    if (!this.world.isInBounds(tileX, tileY)) {
      return rejected(FarmRejectReason.OutOfBounds);
    }
    if (!this.isInPlot(tileX, tileY)) {
      return rejected(FarmRejectReason.OutsideFarmPlot);
    }
    const tile = this.world.getTile(tileX, tileY);
    if (tile.terrain !== TerrainType.Grass && tile.terrain !== TerrainType.Dirt) {
      return rejected(FarmRejectReason.BadTerrain);
    }
    if (tile.objectId !== null || !tile.walkable) {
      return rejected(FarmRejectReason.BlockedByObject);
    }
    if (this.farmState.getSoil(tileX, tileY) !== SoilState.Normal) {
      return rejected(FarmRejectReason.SoilNotNormal);
    }
    if (this.farmState.getCrop(tileX, tileY) !== null) {
      return rejected(FarmRejectReason.AlreadyPlanted);
    }
    return OK;
  }

  public till(tileX: number, tileY: number): FarmActionResult {
    const check = this.canTill(tileX, tileY);
    if (!check.ok) {
      return check;
    }
    this.farmState.setSoil(tileX, tileY, SoilState.Tilled);
    this.events.emit('soil-changed', { x: tileX, y: tileY, soil: SoilState.Tilled });
    return OK;
  }

  // -- plant ---------------------------------------------------------------------

  public canPlant(tileX: number, tileY: number, cropId: string): FarmValidation {
    if (!this.world.isInBounds(tileX, tileY)) {
      return rejected(FarmRejectReason.OutOfBounds);
    }
    if (!this.isInPlot(tileX, tileY)) {
      return rejected(FarmRejectReason.OutsideFarmPlot);
    }
    const def = getCropDefinition(cropId);
    if (!def) {
      return rejected(FarmRejectReason.UnknownSeed);
    }
    if (this.farmState.getCrop(tileX, tileY) !== null) {
      return rejected(FarmRejectReason.AlreadyPlanted);
    }
    if (this.farmState.getSoil(tileX, tileY) !== SoilState.Tilled) {
      return rejected(FarmRejectReason.SoilNotTilled);
    }
    if (!this.inventory.hasItem(seedItemIdForCrop(def), 1)) {
      return rejected(FarmRejectReason.NoSeeds);
    }
    return OK;
  }

  public plant(tileX: number, tileY: number, cropId: string): FarmActionResult {
    const check = this.canPlant(tileX, tileY, cropId);
    if (!check.ok) {
      return check;
    }
    const def = requireCropDefinition(cropId);
    const seedItem = seedItemIdForCrop(def);
    // Atomic: seed is consumed only if the crop is created. Any failure
    // below restores the seed — no partial states, no lost items.
    const consumed = this.inventory.removeItem(seedItem, 1);
    if (consumed.missing > 0) {
      return rejected(FarmRejectReason.NoSeeds);
    }
    try {
      const crop: CropStateData = {
        cropId,
        tileX,
        tileY,
        plantedAtMs: this.clock.nowMs(),
        grownMs: 0,
        wateredAtMs: null,
        watered: false,
        stage: 0,
      };
      this.farmState.setCrop(crop);
      this.events.emit('crop-planted', { crop });
    } catch (error) {
      this.inventory.addItem(seedItem, 1);
      throw error;
    }
    return OK;
  }

  // -- water ---------------------------------------------------------------------

  public canWater(tileX: number, tileY: number): FarmValidation {
    if (!this.world.isInBounds(tileX, tileY)) {
      return rejected(FarmRejectReason.OutOfBounds);
    }
    const crop = this.farmState.getCrop(tileX, tileY);
    if (!crop) {
      return rejected(FarmRejectReason.NoCrop);
    }
    if (crop.watered) {
      return rejected(FarmRejectReason.AlreadyWatered);
    }
    return OK;
  }

  public water(tileX: number, tileY: number): FarmActionResult {
    const check = this.canWater(tileX, tileY);
    if (!check.ok) {
      return check;
    }
    const crop = this.farmState.getCrop(tileX, tileY);
    if (!crop) {
      return rejected(FarmRejectReason.NoCrop);
    }
    crop.watered = true;
    crop.wateredAtMs = this.clock.nowMs();
    this.farmState.setCrop(crop);
    this.farmState.setSoil(tileX, tileY, SoilState.Watered);
    this.events.emit('soil-changed', { x: tileX, y: tileY, soil: SoilState.Watered });
    this.events.emit('crop-watered', { crop });
    return OK;
  }

  // -- harvest --------------------------------------------------------------------

  public canHarvest(tileX: number, tileY: number): FarmValidation {
    if (!this.world.isInBounds(tileX, tileY)) {
      return rejected(FarmRejectReason.OutOfBounds);
    }
    const crop = this.farmState.getCrop(tileX, tileY);
    if (!crop) {
      return rejected(FarmRejectReason.NoCrop);
    }
    const def = requireCropDefinition(crop.cropId);
    if (this.getCropStage(crop) < def.growthStages - 1) {
      return rejected(FarmRejectReason.NotMature);
    }
    if (!this.inventory.canAdd(yieldItemIdForCrop(def), def.yieldAmount)) {
      return rejected(FarmRejectReason.InventoryFull);
    }
    return OK;
  }

  public harvest(tileX: number, tileY: number): FarmActionResult {
    const check = this.canHarvest(tileX, tileY);
    if (!check.ok) {
      return check;
    }
    const crop = this.farmState.removeCrop(tileX, tileY);
    if (!crop) {
      return rejected(FarmRejectReason.NoCrop);
    }
    const def = requireCropDefinition(crop.cropId);
    // Atomic: the yield must fully fit or nothing happens — the crop is
    // replanted and any partially added items are rolled back. Harvests are
    // never silently deleted by a full inventory.
    const yieldItem = yieldItemIdForCrop(def);
    const added = this.inventory.addItem(yieldItem, def.yieldAmount);
    if (added.leftover > 0) {
      if (added.added > 0) {
        this.inventory.removeItem(yieldItem, added.added);
      }
      this.farmState.setCrop(crop);
      return rejected(FarmRejectReason.InventoryFull);
    }
    // Soil stays tilled (dries back) so the tile can be replanted immediately.
    this.farmState.setSoil(tileX, tileY, SoilState.Tilled);
    this.events.emit('soil-changed', { x: tileX, y: tileY, soil: SoilState.Tilled });
    this.events.emit('crop-removed', { x: tileX, y: tileY, cropId: crop.cropId });
    const result: HarvestResult = {
      cropId: crop.cropId,
      cropName: def.name,
      quantity: def.yieldAmount,
      tileX,
      tileY,
    };
    this.events.emit('harvest', result);
    Logger.info('Farming', `harvested ${result.quantity}x ${result.cropName} at (${tileX}, ${tileY})`);
    return { ok: true, harvest: result };
  }

  // -- growth -----------------------------------------------------------------------

  /**
   * Advance growth bookkeeping. Called every frame; emits 'crop-stage' ONLY
   * for crops whose stage actually changed (renderers update single views).
   */
  public update(): void {
    const nowMs = this.clock.nowMs();
    for (const crop of this.farmState.getAllCrops()) {
      const stage = this.computeStage(crop, nowMs);
      if (stage !== crop.stage) {
        // Roll accrued time into grownMs so timestamps stay exact.
        crop.grownMs = this.effectiveGrownMs(crop, nowMs);
        if (crop.watered) {
          crop.wateredAtMs = nowMs;
        }
        crop.stage = stage;
        this.farmState.setCrop(crop);
        this.events.emit('crop-stage', { crop, stage });
      }
    }
  }

  /** Live stage for a crop (0-based). Pure function of timestamps. */
  public getCropStage(crop: CropStateData, nowMs: number = this.clock.nowMs()): number {
    return this.computeStage(crop, nowMs);
  }

  /** Wall-clock age since planting (ms). */
  public getCropAgeMs(crop: CropStateData, nowMs: number = this.clock.nowMs()): number {
    return Math.max(0, nowMs - crop.plantedAtMs);
  }

  /**
   * Growth milliseconds accrued. Crops only grow while watered
   * (waterRequired definitions; unwatered crops stall at their stage).
   */
  public effectiveGrownMs(crop: CropStateData, nowMs: number): number {
    requireCropDefinition(crop.cropId); // corrupt crop ids fail loudly
    let grown = crop.grownMs;
    if (crop.watered && crop.wateredAtMs !== null) {
      grown += Math.max(0, nowMs - crop.wateredAtMs);
    }
    return grown;
  }

  public isMature(crop: CropStateData, nowMs: number = this.clock.nowMs()): boolean {
    const def = requireCropDefinition(crop.cropId);
    return this.computeStage(crop, nowMs) >= def.growthStages - 1;
  }

  private computeStage(crop: CropStateData, nowMs: number): number {
    const def = requireCropDefinition(crop.cropId);
    const totalMs = def.growthDurationSec * 1000 * this.timeScale;
    if (totalMs <= 0) {
      return def.growthStages - 1;
    }
    const grown = this.effectiveGrownMs(crop, nowMs);
    const stage = Math.floor((grown / totalMs) * def.growthStages);
    return Math.min(Math.max(stage, 0), def.growthStages - 1);
  }

  // -- renderer queries ---------------------------------------------------------------

  public getCropsInChunk(chunk: ChunkCoord): readonly CropStateData[] {
    const size = this.world.config.chunkSize;
    const x0 = chunk.x * size;
    const y0 = chunk.y * size;
    return this.farmState
      .getAllCrops()
      .filter((c) => c.tileX >= x0 && c.tileX < x0 + size && c.tileY >= y0 && c.tileY < y0 + size);
  }

  public getSoilTilesInChunk(
    chunk: ChunkCoord,
  ): ReadonlyArray<{ x: number; y: number; soil: SoilState }> {
    const size = this.world.config.chunkSize;
    const x0 = chunk.x * size;
    const y0 = chunk.y * size;
    return this.farmState
      .getModifiedSoil()
      .filter((t) => t.x >= x0 && t.x < x0 + size && t.y >= y0 && t.y < y0 + size);
  }

  // -- test/debug only ---------------------------------------------------------------------

  /**
   * TEST/DEBUG ONLY: instantly mature a crop (used by the smoke test to
   * validate the harvest path without waiting out growth).
   */
  public forceMatureCrop(tileX: number, tileY: number): boolean {
    const crop = this.farmState.getCrop(tileX, tileY);
    if (!crop) {
      return false;
    }
    const def = requireCropDefinition(crop.cropId);
    crop.grownMs = def.growthDurationSec * 1000 * this.timeScale;
    crop.watered = true;
    crop.wateredAtMs = this.clock.nowMs();
    crop.stage = def.growthStages - 1;
    this.farmState.setCrop(crop);
    this.events.emit('crop-stage', { crop, stage: crop.stage });
    return true;
  }

  private isInPlot(tileX: number, tileY: number): boolean {
    const plot = this.farmState.getPlot();
    return (
      tileX >= plot.x &&
      tileY >= plot.y &&
      tileX < plot.x + plot.width &&
      tileY < plot.y + plot.height
    );
  }
}

/**
 * CropDefinition legacy ids ("wheat_seed") predate the namespaced item ids
 * ("item:wheat_seed"). CropDefinitions is a stable module, so the bridge
 * lives here — in exactly one place, shared by the system and its callers.
 */
export function seedItemIdForCrop(def: { seedItemId: string }): string {
  return `item:${def.seedItemId}`;
}

export function yieldItemIdForCrop(def: { yieldItemId: string }): string {
  return `item:${def.yieldItemId}`;
}

/** Human-readable rejection text for floating UI feedback. */
export function describeRejectReason(reason: FarmRejectReason): string {
  switch (reason) {
    case FarmRejectReason.OutsideFarmPlot:
      return 'Outside farm plot';
    case FarmRejectReason.BadTerrain:
      return 'Cannot farm here';
    case FarmRejectReason.BlockedByObject:
      return 'Blocked';
    case FarmRejectReason.SoilNotNormal:
      return 'Already tilled';
    case FarmRejectReason.SoilNotTilled:
      return 'Till the soil first';
    case FarmRejectReason.NoCrop:
      return 'No crop here';
    case FarmRejectReason.AlreadyPlanted:
      return 'Already planted';
    case FarmRejectReason.AlreadyWatered:
      return 'Already watered';
    case FarmRejectReason.NotMature:
      return 'Not ready yet';
    case FarmRejectReason.NoSeeds:
      return 'Out of seeds';
    case FarmRejectReason.UnknownSeed:
      return 'Unknown seed';
    case FarmRejectReason.OutOfBounds:
      return 'Out of bounds';
    case FarmRejectReason.UnsupportedAction:
      return 'Not available yet';
    case FarmRejectReason.InventoryFull:
      return 'Inventory full';
  }
}
