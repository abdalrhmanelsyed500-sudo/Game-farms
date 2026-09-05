/**
 * BuildingSystem (Phase 3): owns building placement.
 *
 * Pure logic, no Phaser: validates through PlacementValidator, deducts
 * resources ATOMICALLY (every cost line checked before any is removed, so a
 * failed placement never half-charges), registers a WorldObject of type
 * Building (collision follows automatically from the existing walkability),
 * and records the placement in state. Rendering observes 'building-placed'
 * and adds a single object view — chunks are never rebuilt.
 */
import { Logger } from '../../shared/utils/Logger.js';
import { TypedEventEmitter } from '../../shared/utils/EventEmitter.js';
import {
  PlacementRejectReason,
  type BuildingRotation,
  type PlacedBuildingData,
  type PlacementResult,
} from '../../shared/types/buildings.js';
import { WorldObjectType, type WorldObjectData } from '../../shared/types/objects.js';
import type { InventorySystem } from '../items/InventorySystem.js';
import type { World } from '../world/World.js';
import { createWorldObject } from '../world/WorldObject.js';
import {
  footprintForRotation,
  requireBuildingDefinition,
} from './BuildingCatalog.js';
import { PlacementValidator, type PlacementContext } from './PlacementValidator.js';
import type { BuildingStateProvider } from './BuildingStateProvider.js';

export interface BuildingEvents {
  /** A building was placed: state record + the WorldObject to render. */
  'building-placed': { record: PlacedBuildingData; object: WorldObjectData };
  /** A building was demolished (dev/reset flows). */
  'building-removed': { record: PlacedBuildingData };
}

export function describePlacementRejection(result: Extract<PlacementResult, { ok: false }>): string {
  switch (result.reason) {
    case PlacementRejectReason.UnknownBuilding:
      return 'Unknown building.';
    case PlacementRejectReason.InvalidRotation:
      return 'Invalid rotation (use 0/90/180/270).';
    case PlacementRejectReason.OutsideFarmPlot:
      return 'Buildings must fit inside your farm plot.';
    case PlacementRejectReason.FootprintOutOfBounds:
      return 'Too close to the edge of the world.';
    case PlacementRejectReason.TileOccupied:
      return 'That space is occupied.';
    case PlacementRejectReason.CropInFootprint:
      return 'Crops are in the way — harvest or clear them first.';
    case PlacementRejectReason.InsufficientResources: {
      const details = (result.missing ?? [])
        .map((m) => `${m.itemId} (${m.have}/${m.needed})`)
        .join(', ');
      return details ? `Not enough resources: ${details}.` : 'Not enough resources.';
    }
  }
}

export class BuildingSystem {
  public readonly events = new TypedEventEmitter<BuildingEvents>();

  private readonly world: World;
  private readonly inventory: InventorySystem;
  private readonly state: BuildingStateProvider;
  private readonly validator: PlacementValidator;
  private nextBuildingNumber = 1;

  public constructor(
    world: World,
    inventory: InventorySystem,
    state: BuildingStateProvider,
    hasCropAt: (tileX: number, tileY: number) => boolean,
    isEntityBlocked?: (tileX: number, tileY: number) => boolean,
  ) {
    this.world = world;
    this.inventory = inventory;
    this.state = state;
    const ctx: PlacementContext = { world, inventory, hasCropAt, isEntityBlocked };
    this.validator = new PlacementValidator(ctx);
  }

  /** All placed buildings (state records). */
  public getPlaced(): readonly PlacedBuildingData[] {
    return this.state.getAll();
  }

  /** Validate without placing (ghost preview + UI gating). */
  public canPlace(
    buildingId: string,
    anchorX: number,
    anchorY: number,
    rotation: unknown,
  ): PlacementResult {
    return this.validator.validate(buildingId, anchorX, anchorY, rotation);
  }

  /**
   * Place a building. Returns ok:false with a reason on any failure and
   * changes NOTHING (no partial charges, no orphan objects).
   */
  public place(
    buildingId: string,
    anchorX: number,
    anchorY: number,
    rotation: BuildingRotation,
  ): PlacementResult {
    const check = this.validator.validate(buildingId, anchorX, anchorY, rotation);
    if (!check.ok) {
      return check;
    }
    const def = requireBuildingDefinition(buildingId);
    const footprint = footprintForRotation(def, rotation);

    // Atomic deduction: every line re-checked up front (validator already
    // passed, but inventory is shared — never half-charge on a race).
    const removable = def.cost.every((line) => this.inventory.canRemove(line.itemId, line.quantity));
    if (!removable) {
      return this.validator.validate(buildingId, anchorX, anchorY, rotation);
    }
    for (const line of def.cost) {
      this.inventory.removeItem(line.itemId, line.quantity);
    }

    const objectId = `building-${this.nextBuildingNumber++}`;
    const object = createWorldObject(WorldObjectType.Building, anchorX, anchorY, {
      id: objectId,
      width: footprint.width,
      height: footprint.height,
      spriteKey: def.spriteKey,
      metadata: { buildingId, rotation },
    });
    try {
      this.world.addObject(object);
    } catch (error) {
      // Paranoia path: world registration failed AFTER charging — refund.
      for (const line of def.cost) {
        this.inventory.addItem(line.itemId, line.quantity);
      }
      throw error;
    }
    const record: PlacedBuildingData = {
      buildingId,
      anchorX,
      anchorY,
      rotation,
      objectId,
    };
    this.state.add(record);
    Logger.info('Buildings', `placed ${buildingId} at (${anchorX}, ${anchorY}) rot=${rotation}`);
    this.events.emit('building-placed', { record, object });
    return { ok: true };
  }

  /**
   * Remove a placed building (dev/reset flows; no refund — resources are
   * sunk costs, matching the "no economy" scope).
   */
  public demolish(objectId: string): boolean {
    const record = this.state.removeByObjectId(objectId);
    if (!record) {
      return false;
    }
    this.world.removeObject(objectId);
    this.events.emit('building-removed', { record });
    return true;
  }
}
