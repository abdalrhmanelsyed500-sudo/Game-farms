import { describe, expect, it } from 'vitest';
import { FARM_PLOT_X, FARM_PLOT_Y } from '../src/shared/constants/config.js';
import { PlacementRejectReason } from '../src/shared/types/buildings.js';
import { WorldObjectType } from '../src/shared/types/objects.js';
import { WorldManager } from '../src/game/world/WorldManager.js';
import { DEFAULT_WORLD_CONFIG } from '../src/game/world/WorldConfig.js';
import { InventorySystem } from '../src/game/items/InventorySystem.js';
import { LocalInventoryState } from '../src/game/items/LocalInventoryState.js';
import { LocalBuildingState } from '../src/game/buildings/LocalBuildingState.js';
import { BuildingSystem } from '../src/game/buildings/BuildingSystem.js';
import {
  footprintForRotation,
  footprintTilesFor,
  getBuildingDefinitions,
  getBuildingDefinition,
  requireBuildingDefinition,
} from '../src/game/buildings/BuildingCatalog.js';
import { FarmingSystem } from '../src/game/farming/FarmingSystem.js';
import { LocalFarmState } from '../src/game/farming/LocalFarmState.js';
import { ManualClock } from '../src/game/farming/Clock.js';

const PX = FARM_PLOT_X + 6;
const PY = FARM_PLOT_Y + 6;

function makeRichInventory(): InventorySystem {
  const inventory = new InventorySystem(new LocalInventoryState());
  inventory.addItem('item:wood', 200);
  inventory.addItem('item:stone', 200);
  inventory.addItem('item:wheat_seed', 20);
  return inventory;
}

function makeSystem(options: { wood?: number; stone?: number; blocked?: boolean } = {}): {
  buildings: BuildingSystem;
  inventory: InventorySystem;
  farming: FarmingSystem;
  world: ReturnType<WorldManager['getWorld']>;
} {
  const manager = new WorldManager(DEFAULT_WORLD_CONFIG);
  const world = manager.initialize();
  const inventory = new InventorySystem(new LocalInventoryState());
  inventory.addItem('item:wood', options.wood ?? 200);
  inventory.addItem('item:stone', options.stone ?? 200);
  inventory.addItem('item:wheat_seed', 20);
  const farming = new FarmingSystem(world, new LocalFarmState(), inventory, new ManualClock(0));
  const buildings = new BuildingSystem(
    world,
    inventory,
    new LocalBuildingState(),
    (x, y) => farming.getCropAt(x, y) !== null,
    options.blocked === true ? () => true : (x, y) => x === -1 && y === -1,
  );
  return { buildings, inventory, farming, world };
}

describe('BuildingCatalog', () => {
  it('defines the small house, barn, and storage shed', () => {
    const ids = getBuildingDefinitions().map((d) => d.id);
    expect(ids).toEqual(['building:small_house', 'building:barn', 'building:storage_shed']);
  });

  it('gives every building a footprint, cost, and sprite', () => {
    for (const def of getBuildingDefinitions()) {
      expect(def.width).toBeGreaterThanOrEqual(1);
      expect(def.height).toBeGreaterThanOrEqual(1);
      expect(def.cost.length).toBeGreaterThan(0);
      for (const line of def.cost) {
        expect(line.quantity).toBeGreaterThan(0);
      }
      expect(def.spriteKey).toMatch(/^building_/);
    }
    expect(requireBuildingDefinition('building:barn').width).toBe(4);
    expect(getBuildingDefinition('building:nope')).toBeNull();
    expect(() => requireBuildingDefinition('building:nope')).toThrow();
  });

  it('swaps footprint dims on quarter turns only', () => {
    const house = requireBuildingDefinition('building:small_house'); // 3x2
    expect(footprintForRotation(house, 0)).toEqual({ width: 3, height: 2 });
    expect(footprintForRotation(house, 180)).toEqual({ width: 3, height: 2 });
    expect(footprintForRotation(house, 90)).toEqual({ width: 2, height: 3 });
    expect(footprintForRotation(house, 270)).toEqual({ width: 2, height: 3 });
    expect(footprintTilesFor(10, 20, house, 0)).toHaveLength(6);
    expect(footprintTilesFor(10, 20, house, 90)).toHaveLength(6);
  });
});

describe('PlacementValidator (via BuildingSystem.canPlace)', () => {
  it('accepts an empty plot footprint', () => {
    const { buildings } = makeSystem();
    expect(buildings.canPlace('building:storage_shed', PX, PY, 0)).toEqual({ ok: true });
  });

  it('rejects unknown buildings', () => {
    const { buildings } = makeSystem();
    const result = buildings.canPlace('building:nope', PX, PY, 0);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe(PlacementRejectReason.UnknownBuilding);
    }
  });

  it('rejects invalid rotations', () => {
    const { buildings } = makeSystem();
    for (const rotation of [45, -90, 'left', null, undefined]) {
      const result = buildings.canPlace('building:storage_shed', PX, PY, rotation);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe(PlacementRejectReason.InvalidRotation);
      }
    }
  });

  it('rejects footprints outside the farm plot', () => {
    const { buildings } = makeSystem();
    const outside = buildings.canPlace('building:storage_shed', 0, 0, 0);
    expect(outside.ok).toBe(false);
    if (!outside.ok) {
      expect(outside.reason).toBe(PlacementRejectReason.OutsideFarmPlot);
    }
    // Partially overlapping the plot edge still fails (whole footprint must fit).
    const straddling = buildings.canPlace('building:storage_shed', FARM_PLOT_X - 1, FARM_PLOT_Y, 0);
    expect(straddling.ok).toBe(false);
    if (!straddling.ok) {
      expect(straddling.reason).toBe(PlacementRejectReason.OutsideFarmPlot);
    }
  });

  it('rejects footprints past the world edge', () => {
    const { buildings } = makeSystem();
    const result = buildings.canPlace('building:storage_shed', 255, 255, 0);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe(PlacementRejectReason.FootprintOutOfBounds);
    }
  });

  it('rejects occupied tiles and entity-blocked tiles', () => {
    const { buildings } = makeSystem();
    expect(buildings.place('building:storage_shed', PX, PY, 0).ok).toBe(true);
    const overlap = buildings.canPlace('building:small_house', PX - 1, PY, 0);
    expect(overlap.ok).toBe(false);
    if (!overlap.ok) {
      expect(overlap.reason).toBe(PlacementRejectReason.TileOccupied);
    }
    const blocked = makeSystem({ blocked: true });
    const entity = blocked.buildings.canPlace(
      'building:storage_shed',
      FARM_PLOT_X + 12,
      FARM_PLOT_Y + 8,
      0,
    );
    expect(entity.ok).toBe(false);
    if (!entity.ok) {
      expect(entity.reason).toBe(PlacementRejectReason.TileOccupied);
    }
  });

  it('rejects footprints containing live crops', () => {
    const { buildings, farming } = makeSystem();
    expect(farming.till(PX, PY).ok).toBe(true);
    expect(farming.plant(PX, PY, 'wheat').ok).toBe(true);
    const result = buildings.canPlace('building:storage_shed', PX, PY, 0);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe(PlacementRejectReason.CropInFootprint);
    }
  });

  it('allows building over empty tilled soil', () => {
    const { buildings, farming } = makeSystem();
    expect(farming.till(PX, PY).ok).toBe(true);
    expect(buildings.canPlace('building:storage_shed', PX, PY, 0)).toEqual({ ok: true });
  });

  it('rejects unaffordable placements with missing-resource details', () => {
    const { buildings } = makeSystem({ wood: 10, stone: 10 });
    const result = buildings.canPlace('building:barn', PX, PY, 0);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe(PlacementRejectReason.InsufficientResources);
      expect(result.missing).toContainEqual({ itemId: 'item:wood', needed: 80, have: 10 });
      expect(result.missing).toContainEqual({ itemId: 'item:stone', needed: 40, have: 10 });
    }
  });
});

describe('BuildingSystem.place', () => {
  it('deducts the exact cost and registers a blocking WorldObject', () => {
    const { buildings, inventory, world } = makeSystem();
    const events: string[] = [];
    buildings.events.on('building-placed', ({ object }) => events.push(object.id));

    expect(world.isWalkable(PX, PY)).toBe(true);
    const result = buildings.place('building:small_house', PX, PY, 0);
    expect(result).toEqual({ ok: true });

    expect(inventory.getQuantity('item:wood')).toBe(150);
    expect(inventory.getQuantity('item:stone')).toBe(180);
    expect(events).toHaveLength(1);

    const placed = buildings.getPlaced();
    expect(placed).toHaveLength(1);
    const record = placed[0]!;
    expect(record.buildingId).toBe('building:small_house');
    expect(record.anchorX).toBe(PX);
    expect(record.rotation).toBe(0);

    const object = world.getObject(record.objectId);
    expect(object?.type).toBe(WorldObjectType.Building);
    expect(object?.width).toBe(3);
    expect(object?.height).toBe(2);
    expect(object?.spriteKey).toBe('building_small_house');
    expect(object?.metadata).toMatchObject({ buildingId: 'building:small_house', rotation: 0 });
    // Collision follows from the shared walkability — no second system.
    expect(world.isWalkable(PX, PY)).toBe(false);
    expect(world.isWalkable(PX + 2, PY + 1)).toBe(false);
    expect(world.isWalkable(PX + 3, PY)).toBe(true);
  });

  it('applies rotation to the registered footprint', () => {
    const { buildings, world } = makeSystem();
    expect(buildings.place('building:small_house', PX, PY, 90).ok).toBe(true);
    const record = buildings.getPlaced()[0]!;
    expect(record.rotation).toBe(90);
    const object = world.getObject(record.objectId);
    expect(object?.width).toBe(2);
    expect(object?.height).toBe(3);
  });

  it('charges nothing when placement fails (atomic)', () => {
    const poor = makeSystem({ wood: 10, stone: 10 });
    expect(poor.buildings.place('building:barn', PX, PY, 0).ok).toBe(false);
    expect(poor.inventory.getQuantity('item:wood')).toBe(10);
    expect(poor.inventory.getQuantity('item:stone')).toBe(10);
    expect(poor.buildings.getPlaced()).toHaveLength(0);

    const { buildings, inventory } = makeSystem();
    expect(buildings.place('building:storage_shed', PX, PY, 0).ok).toBe(true);
    const woodAfterFirst = inventory.getQuantity('item:wood');
    // Overlapping retry fails and charges nothing extra.
    expect(buildings.place('building:storage_shed', PX, PY, 0).ok).toBe(false);
    expect(inventory.getQuantity('item:wood')).toBe(woodAfterFirst);
    expect(buildings.getPlaced()).toHaveLength(1);
  });

  it('starter stock affords house+shed but forces a choice on the barn', () => {
    const inventory = new InventorySystem(new LocalInventoryState());
    inventory.addItem('item:wood', 100);
    inventory.addItem('item:stone', 60);
    const manager = new WorldManager(DEFAULT_WORLD_CONFIG);
    const world = manager.initialize();
    const buildings = new BuildingSystem(world, inventory, new LocalBuildingState(), () => false);
    expect(buildings.place('building:small_house', PX, PY, 0).ok).toBe(true);
    expect(buildings.place('building:storage_shed', PX + 4, PY, 0).ok).toBe(true);
    // 20 wood / 30 stone left: the barn (80/40) is out of reach.
    const barn = buildings.canPlace('building:barn', PX, PY + 4, 0);
    expect(barn.ok).toBe(false);
    if (!barn.ok) {
      expect(barn.reason).toBe(PlacementRejectReason.InsufficientResources);
    }
  });

  it('demolish removes the object and restores walkability', () => {
    const { buildings, world } = makeSystem();
    expect(buildings.place('building:storage_shed', PX, PY, 0).ok).toBe(true);
    const record = buildings.getPlaced()[0]!;
    let removed = 0;
    buildings.events.on('building-removed', () => removed++);
    expect(buildings.demolish(record.objectId)).toBe(true);
    expect(removed).toBe(1);
    expect(world.getObject(record.objectId)).toBeNull();
    expect(world.isWalkable(PX, PY)).toBe(true);
    expect(buildings.getPlaced()).toHaveLength(0);
    expect(buildings.demolish('ghost')).toBe(false);
  });

  it('keeps records in state across system instances', () => {
    const manager = new WorldManager(DEFAULT_WORLD_CONFIG);
    const world = manager.initialize();
    const state = new LocalBuildingState();
    const first = new BuildingSystem(world, makeRichInventory(), state, () => false);
    expect(first.place('building:barn', PX, PY, 0).ok).toBe(true);
    const second = new BuildingSystem(world, makeRichInventory(), state, () => false);
    expect(second.getPlaced()).toHaveLength(1);
    expect(second.getPlaced()[0]?.buildingId).toBe('building:barn');
  });
});
