import { describe, expect, it } from 'vitest';
import { FARM_PLOT_X, FARM_PLOT_Y } from '../src/shared/constants/config.js';
import { FarmAction, SoilState } from '../src/shared/types/farming.js';
import { WorldManager } from '../src/game/world/WorldManager.js';
import { DEFAULT_WORLD_CONFIG } from '../src/game/world/WorldConfig.js';
import { FarmingSystem } from '../src/game/farming/FarmingSystem.js';
import { LocalFarmState } from '../src/game/farming/LocalFarmState.js';
import { InventorySystem } from '../src/game/items/InventorySystem.js';
import { LocalInventoryState } from '../src/game/items/LocalInventoryState.js';
import { ManualClock } from '../src/game/farming/Clock.js';

const TX = FARM_PLOT_X + 5;
const TY = FARM_PLOT_Y + 5;

function makeSystem(): { farming: FarmingSystem; clock: ManualClock } {
  const manager = new WorldManager(DEFAULT_WORLD_CONFIG);
  const world = manager.initialize();
  const clock = new ManualClock(5_000_000);
  const inventory = new InventorySystem(new LocalInventoryState());
  inventory.addItem('item:wheat_seed', 20);
  inventory.addItem('item:corn_seed', 20);
  inventory.addItem('item:tomato_seed', 20);
  const farming = new FarmingSystem(world, new LocalFarmState(), inventory, clock);
  return { farming, clock };
}

describe('FarmingIntegration (tile → system → refresh)', () => {
  it('emits exactly one refresh per state change, for the affected tile only', () => {
    const { farming, clock } = makeSystem();
    // Stub for the WorldScene bridge: soil-changed => isoRenderer.refreshTile.
    const refreshed: Array<{ x: number; y: number }> = [];
    farming.events.on('soil-changed', ({ x, y }) => refreshed.push({ x, y }));

    expect(farming.execute(FarmAction.Till, TX, TY).ok).toBe(true);
    expect(refreshed).toEqual([{ x: TX, y: TY }]);

    expect(farming.execute(FarmAction.Plant, TX, TY, 'wheat').ok).toBe(true);
    expect(refreshed).toHaveLength(1); // planting touches no tile visual

    expect(farming.execute(FarmAction.Water, TX, TY).ok).toBe(true);
    expect(refreshed).toEqual([
      { x: TX, y: TY },
      { x: TX, y: TY },
    ]);

    clock.advance(40_000);
    farming.update();
    expect(refreshed).toHaveLength(2); // growth never refreshes tiles

    expect(farming.execute(FarmAction.Harvest, TX, TY).ok).toBe(true);
    expect(refreshed).toHaveLength(3);
    // Neighboring tile was never refreshed.
    expect(refreshed.every((t) => t.x === TX && t.y === TY)).toBe(true);
  });

  it('emits the full loop event sequence in order', () => {
    const { farming, clock } = makeSystem();
    const sequence: string[] = [];
    farming.events.on('soil-changed', () => sequence.push('soil-changed'));
    farming.events.on('crop-planted', () => sequence.push('crop-planted'));
    farming.events.on('crop-watered', () => sequence.push('crop-watered'));
    farming.events.on('crop-stage', () => sequence.push('crop-stage'));
    farming.events.on('crop-removed', () => sequence.push('crop-removed'));
    farming.events.on('harvest', () => sequence.push('harvest'));

    farming.execute(FarmAction.Till, TX, TY);
    farming.execute(FarmAction.Plant, TX, TY, 'corn');
    farming.execute(FarmAction.Water, TX, TY);
    clock.advance(55_000);
    farming.update();
    farming.execute(FarmAction.Harvest, TX, TY);

    expect(sequence).toEqual([
      'soil-changed', // till
      'crop-planted', // plant
      'soil-changed', // water wets soil
      'crop-watered', // water
      'crop-stage', // matured (0 -> 3 in one jump is a single emission)
      'soil-changed', // harvest dries soil back to tilled
      'crop-removed', // harvest
      'harvest', // reward
    ]);
  });

  it('keeps state intact across simulated chunk unload/reload', () => {
    const { farming } = makeSystem();
    expect(farming.execute(FarmAction.Till, TX, TY).ok).toBe(true);
    expect(farming.execute(FarmAction.Plant, TX, TY, 'tomato').ok).toBe(true);

    // What CropRenderer/SoilRenderer rebuild from on chunk-load:
    const chunk = { x: Math.floor(TX / 32), y: Math.floor(TY / 32) };
    const crops = farming.getCropsInChunk(chunk);
    const soils = farming.getSoilTilesInChunk(chunk);
    expect(crops).toHaveLength(1);
    expect(crops[0]?.cropId).toBe('tomato');
    expect(soils).toEqual([{ x: TX, y: TY, soil: SoilState.Tilled }]);

    // A distant chunk rebuilds nothing.
    expect(farming.getCropsInChunk({ x: 0, y: 0 })).toHaveLength(0);
    expect(farming.getSoilTilesInChunk({ x: 0, y: 0 })).toHaveLength(0);
  });

  it('supports multi-tile farms independently', () => {
    const { farming, clock } = makeSystem();
    const tiles: Array<[number, number, string]> = [
      [TX, TY, 'wheat'],
      [TX + 1, TY, 'corn'],
      [TX, TY + 1, 'tomato'],
    ];
    for (const [x, y, crop] of tiles) {
      expect(farming.execute(FarmAction.Till, x, y).ok).toBe(true);
      expect(farming.execute(FarmAction.Plant, x, y, crop).ok).toBe(true);
      expect(farming.execute(FarmAction.Water, x, y).ok).toBe(true);
    }
    // Wheat (40s) hits its final stage at 30s; tomato (48s) at 36s and
    // corn (55s) at ~41s lag behind. Probe at 35s to split them.
    clock.advance(35_000);
    farming.update();
    expect(farming.canHarvest(TX, TY).ok).toBe(true);
    expect(farming.canHarvest(TX + 1, TY).ok).toBe(false);
    expect(farming.canHarvest(TX, TY + 1).ok).toBe(false);
    // Harvesting one leaves the others untouched.
    expect(farming.execute(FarmAction.Harvest, TX, TY).ok).toBe(true);
    expect(farming.getCropAt(TX + 1, TY)?.cropId).toBe('corn');
    expect(farming.getSoilAt(TX, TY)).toBe(SoilState.Tilled);
  });
});
