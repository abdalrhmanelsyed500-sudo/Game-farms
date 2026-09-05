/**
 * PlacementValidator (Phase 3): pure placement rules for buildings.
 *
 * No Phaser, no mutation: answers "can this building go here?" with exactly
 * one PlacementRejectReason on failure. Collision is NOT duplicated here —
 * occupancy/terrain answers come from the existing World (the same source
 * CollisionMap uses), crops from FarmingSystem, resources from inventory.
 */
import {
  FARM_PLOT_HEIGHT,
  FARM_PLOT_WIDTH,
  FARM_PLOT_X,
  FARM_PLOT_Y,
} from '../../shared/constants/config.js';
import {
  PlacementRejectReason,
  type BuildingRotation,
  type MissingResource,
  type PlacementResult,
} from '../../shared/types/buildings.js';
import type { World } from '../world/World.js';
import type { InventorySystem } from '../items/InventorySystem.js';
import {
  footprintTilesFor,
  getBuildingDefinition,
  isBuildingRotation,
} from './BuildingCatalog.js';

/** Everything the validator queries (narrow interfaces keep it unit-testable). */
export interface PlacementContext {
  readonly world: Pick<World, 'isInBounds' | 'isWalkable' | 'getTile'>;
  readonly inventory: Pick<InventorySystem, 'getQuantity'>;
  /** True when a live crop occupies the tile (from FarmingSystem). */
  hasCropAt(tileX: number, tileY: number): boolean;
  /** Optional entity blocker (the player tile). Defaults to "nothing". */
  isEntityBlocked?(tileX: number, tileY: number): boolean;
}

export class PlacementValidator {
  private readonly ctx: PlacementContext;

  public constructor(ctx: PlacementContext) {
    this.ctx = ctx;
  }

  /**
   * Validate a placement. Rotation is `unknown` on purpose: UI/debug input
   * arrives untyped, and InvalidRotation is a first-class answer.
   */
  public validate(
    buildingId: string,
    anchorX: number,
    anchorY: number,
    rotation: unknown,
  ): PlacementResult {
    const def = getBuildingDefinition(buildingId);
    if (!def) {
      return { ok: false, reason: PlacementRejectReason.UnknownBuilding };
    }
    if (!isBuildingRotation(rotation)) {
      return { ok: false, reason: PlacementRejectReason.InvalidRotation };
    }
    const tiles = footprintTilesFor(anchorX, anchorY, def, rotation as BuildingRotation);

    for (const tile of tiles) {
      if (!this.ctx.world.isInBounds(tile.x, tile.y)) {
        return { ok: false, reason: PlacementRejectReason.FootprintOutOfBounds };
      }
    }
    for (const tile of tiles) {
      if (!PlacementValidator.isInsideFarmPlot(tile.x, tile.y)) {
        return { ok: false, reason: PlacementRejectReason.OutsideFarmPlot };
      }
    }
    for (const tile of tiles) {
      const data = this.ctx.world.getTile(tile.x, tile.y);
      if (data.objectId !== null || !this.ctx.world.isWalkable(tile.x, tile.y)) {
        return { ok: false, reason: PlacementRejectReason.TileOccupied };
      }
      if (this.ctx.isEntityBlocked?.(tile.x, tile.y) === true) {
        return { ok: false, reason: PlacementRejectReason.TileOccupied };
      }
      if (this.ctx.hasCropAt(tile.x, tile.y)) {
        return { ok: false, reason: PlacementRejectReason.CropInFootprint };
      }
    }

    const missing: MissingResource[] = [];
    for (const line of def.cost) {
      const have = this.ctx.inventory.getQuantity(line.itemId);
      if (have < line.quantity) {
        missing.push({ itemId: line.itemId, needed: line.quantity, have });
      }
    }
    if (missing.length > 0) {
      return { ok: false, reason: PlacementRejectReason.InsufficientResources, missing };
    }
    return { ok: true };
  }

  public static isInsideFarmPlot(tileX: number, tileY: number): boolean {
    return (
      tileX >= FARM_PLOT_X &&
      tileY >= FARM_PLOT_Y &&
      tileX < FARM_PLOT_X + FARM_PLOT_WIDTH &&
      tileY < FARM_PLOT_Y + FARM_PLOT_HEIGHT
    );
  }
}
