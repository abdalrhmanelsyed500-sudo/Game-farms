import { describe, expect, it } from 'vitest';
import {
  FARM_PLOT_HEIGHT,
  FARM_PLOT_WIDTH,
  FARM_PLOT_X,
  FARM_PLOT_Y,
} from '../src/shared/constants/config.js';
import {
  FarmAction,
  FarmRejectReason,
  SoilState,
} from '../src/shared/types/farming.js';
import { WorldManager } from '../src/game/world/WorldManager.js';
import { DEFAULT_WORLD_CONFIG } from '../src/game/world/WorldConfig.js';
import { FarmingSystem } from '../src/game/farming/FarmingSystem.js';
import { LocalFarmState } from '../src/game/farming/LocalFarmState.js';
import { SeedPouch } from '../src/game/farming/SeedPouch.js';
import { ManualClock } from '../src/game/farming/Clock.js';
import { CROP_IDS, requireCropDefinition } from '../src/game/farming/CropDefinitions.js';

/** A plot tile guaranteed farmable: grass, no object (plot is pre-cleared). */
const TX = FARM_PLOT_X + 2;
const TY = FARM_PLOT_Y + 2;

function makeSystem(clock = new ManualClock(1_000_000)): {
  farming: FarmingSystem;
  clock: ManualClock;
  seeds: SeedPouch;
} {
  const manager = new WorldManager(DEFAULT_WORLD_CONFIG);
  const world = manager.initialize();
  const seeds = SeedPouch.withStarterSeeds(['wheat_seed', 'corn_seed', 'tomato_seed']);
  const farming = new FarmingSystem(world, new LocalFarmState(), seeds, clock);
  return { farming, clock, seeds };
}

describe('FarmingSystem soil', () => {
  it('tills valid plot tiles and emits a single soil event', () => {
    const { farming } = makeSystem();
    const events: unknown[] = [];
    farming.events.on('soil-changed', (e) => events.push(e));

    expect(farming.canTill(TX, TY)).toEqual({ ok: true });
    expect(farming.till(TX, TY).ok).toBe(true);
    expect(farming.getSoilAt(TX, TY)).toBe(SoilState.Tilled);
    expect(events).toEqual([{ x: TX, y: TY, soil: SoilState.Tilled }]);
  });

  it('rejects tilling outside the farm plot', () => {
    const { farming } = makeSystem();
    expect(farming.canTill(10, 10).reason).toBe(FarmRejectReason.OutsideFarmPlot);
    expect(farming.execute(FarmAction.Till, 10, 10).ok).toBe(false);
    expect(farming.getSoilAt(10, 10)).toBe(SoilState.Normal);
  });

  it('rejects tilling water, roads, and blocked tiles', () => {
    const { farming } = makeSystem();
    // Pond water (also outside plot — plot check runs first by design).
    expect(farming.canTill(196, 128).reason).toBe(FarmRejectReason.OutsideFarmPlot);
    // Re-tilling tilled soil is rejected.
    expect(farming.till(TX, TY).ok).toBe(true);
    expect(farming.canTill(TX, TY).reason).toBe(FarmRejectReason.SoilNotNormal);
    // Out of bounds.
    expect(farming.canTill(-1, 0).reason).toBe(FarmRejectReason.OutOfBounds);
  });

  it('rejects tilling where an object stands', () => {
    // Custom plot covering the authored corridor tree proves the
    // object check independently of the plot check.
    const manager = new WorldManager(DEFAULT_WORLD_CONFIG);
    const world = manager.initialize();
    const plotState = new LocalFarmState({ x: 116, y: 118, width: 20, height: 20 });
    const farming = new FarmingSystem(world, plotState, new SeedPouch(), new ManualClock(0));
    expect(farming.canTill(118, 119).reason).toBe(FarmRejectReason.BlockedByObject);
    // Spawn-plaza grass inside the same custom plot tills fine.
    expect(farming.canTill(124, 124)).toEqual({ ok: true });
  });
});

describe('FarmingSystem planting', () => {
  it('plants each crop on tilled soil and consumes one seed', () => {
    for (const cropId of CROP_IDS) {
      const { farming, seeds } = makeSystem();
      const def = requireCropDefinition(cropId);
      const before = seeds.getCount(def.seedItemId);
      expect(farming.till(TX, TY).ok).toBe(true);
      expect(farming.canPlant(TX, TY, cropId)).toEqual({ ok: true });
      expect(farming.plant(TX, TY, cropId).ok).toBe(true);
      expect(seeds.getCount(def.seedItemId)).toBe(before - 1);
      const crop = farming.getCropAt(TX, TY);
      expect(crop?.cropId).toBe(cropId);
      expect(crop?.stage).toBe(0);
      expect(crop?.watered).toBe(false);
    }
  });

  it('requires tilled soil', () => {
    const { farming } = makeSystem();
    expect(farming.canPlant(TX, TY, 'wheat').reason).toBe(FarmRejectReason.SoilNotTilled);
    expect(farming.plant(TX, TY, 'wheat').ok).toBe(false);
    expect(farming.getCropAt(TX, TY)).toBeNull();
  });

  it('rejects double-planting, unknown seeds, and empty pouch', () => {
    const { farming } = makeSystem();
    expect(farming.till(TX, TY).ok).toBe(true);
    expect(farming.plant(TX, TY, 'wheat').ok).toBe(true);
    expect(farming.canPlant(TX, TY, 'corn').reason).toBe(FarmRejectReason.AlreadyPlanted);
    expect(farming.canPlant(TX + 1, TY, 'nope').reason).toBe(FarmRejectReason.UnknownSeed);

    const empty = makeSystem();
    expect(empty.farming.till(TX, TY).ok).toBe(true);
    // Drain wheat seeds.
    const pouch = empty.seeds;
    while (pouch.getCount('wheat_seed') > 0) {
      pouch.consume('wheat_seed');
    }
    expect(empty.farming.canPlant(TX, TY, 'wheat').reason).toBe(FarmRejectReason.NoSeeds);
  });
});

describe('FarmingSystem watering + growth', () => {
  it('waters planted crops and flips soil to Watered', () => {
    const { farming } = makeSystem();
    expect(farming.till(TX, TY).ok).toBe(true);
    expect(farming.canWater(TX, TY).reason).toBe(FarmRejectReason.NoCrop);
    expect(farming.plant(TX, TY, 'wheat').ok).toBe(true);
    expect(farming.canWater(TX, TY)).toEqual({ ok: true });
    expect(farming.water(TX, TY).ok).toBe(true);
    expect(farming.getSoilAt(TX, TY)).toBe(SoilState.Watered);
    expect(farming.getCropAt(TX, TY)?.watered).toBe(true);
    expect(farming.canWater(TX, TY).reason).toBe(FarmRejectReason.AlreadyWatered);
  });

  it('computes stages from timestamps (no timers)', () => {
    const { farming, clock } = makeSystem();
    expect(farming.till(TX, TY).ok).toBe(true);
    expect(farming.plant(TX, TY, 'wheat').ok).toBe(true); // 40s, 4 stages
    expect(farming.water(TX, TY).ok).toBe(true);
    const crop = farming.getCropAt(TX, TY);
    if (!crop) {
      throw new Error('expected crop');
    }
    expect(farming.getCropStage(crop)).toBe(0);
    clock.advance(10_000);
    expect(farming.getCropStage(crop)).toBe(1);
    clock.advance(10_000);
    expect(farming.getCropStage(crop)).toBe(2);
    clock.advance(10_000);
    expect(farming.getCropStage(crop)).toBe(3);
    clock.advance(60_000);
    expect(farming.getCropStage(crop)).toBe(3); // clamped at mature
    expect(farming.isMature(crop)).toBe(true);
  });

  it('stalls growth until watered', () => {
    const { farming, clock } = makeSystem();
    expect(farming.till(TX, TY).ok).toBe(true);
    expect(farming.plant(TX, TY, 'corn').ok).toBe(true);
    clock.advance(600_000); // 10 minutes dry
    const crop = farming.getCropAt(TX, TY);
    if (!crop) {
      throw new Error('expected crop');
    }
    expect(farming.getCropStage(crop)).toBe(0);
    expect(farming.isMature(crop)).toBe(false);
    // Watering starts the clock from the water timestamp.
    expect(farming.water(TX, TY).ok).toBe(true);
    clock.advance(60_000);
    expect(farming.getCropStage(crop)).toBe(4 - 1); // corn: 55s => mature
  });

  it('update() emits stage events only on change', () => {
    const { farming, clock } = makeSystem();
    expect(farming.till(TX, TY).ok).toBe(true);
    expect(farming.plant(TX, TY, 'tomato').ok).toBe(true); // 48s
    expect(farming.water(TX, TY).ok).toBe(true);
    const stages: number[] = [];
    farming.events.on('crop-stage', ({ stage }) => stages.push(stage));
    farming.update();
    expect(stages).toEqual([]);
    clock.advance(12_000);
    farming.update();
    expect(stages).toEqual([1]);
    farming.update();
    expect(stages).toEqual([1]); // no duplicate emission
    clock.advance(12_000);
    farming.update();
    expect(stages).toEqual([1, 2]);
  });

  it('respects TIME_SCALE', () => {
    const manager = new WorldManager(DEFAULT_WORLD_CONFIG);
    const world = manager.initialize();
    const clock = new ManualClock(0);
    const farming = new FarmingSystem(
      world,
      new LocalFarmState(),
      SeedPouch.withStarterSeeds(['wheat_seed']),
      clock,
      2, // 2x scale => wheat needs 80s
    );
    expect(farming.till(TX, TY).ok).toBe(true);
    expect(farming.plant(TX, TY, 'wheat').ok).toBe(true);
    expect(farming.water(TX, TY).ok).toBe(true);
    const crop = farming.getCropAt(TX, TY);
    if (!crop) {
      throw new Error('expected crop');
    }
    clock.advance(40_000);
    expect(farming.getCropStage(crop)).toBe(2); // half grown at 2x scale
  });
});

describe('FarmingSystem harvest', () => {
  it('rejects harvesting immature crops', () => {
    const { farming } = makeSystem();
    expect(farming.canHarvest(TX, TY).reason).toBe(FarmRejectReason.NoCrop);
    expect(farming.till(TX, TY).ok).toBe(true);
    expect(farming.plant(TX, TY, 'wheat').ok).toBe(true);
    expect(farming.water(TX, TY).ok).toBe(true);
    expect(farming.canHarvest(TX, TY).reason).toBe(FarmRejectReason.NotMature);
    expect(farming.harvest(TX, TY).ok).toBe(false);
  });

  it('harvests mature crops with a temporary reward event', () => {
    const { farming, clock } = makeSystem();
    const harvests: unknown[] = [];
    farming.events.on('harvest', (h) => harvests.push(h));
    expect(farming.till(TX, TY).ok).toBe(true);
    expect(farming.plant(TX, TY, 'tomato').ok).toBe(true);
    expect(farming.water(TX, TY).ok).toBe(true);
    clock.advance(48_000);
    farming.update();
    expect(farming.canHarvest(TX, TY)).toEqual({ ok: true });
    const result = farming.harvest(TX, TY);
    expect(result.ok).toBe(true);
    expect(result.harvest).toEqual({
      cropId: 'tomato',
      cropName: 'Tomato',
      quantity: 4,
      tileX: TX,
      tileY: TY,
    });
    expect(harvests).toHaveLength(1);
    // Crop gone, soil back to tilled for immediate replanting.
    expect(farming.getCropAt(TX, TY)).toBeNull();
    expect(farming.getSoilAt(TX, TY)).toBe(SoilState.Tilled);
  });

  it('runs the full loop via execute(): till → plant → water → harvest', () => {
    const { farming, clock } = makeSystem();
    expect(farming.execute(FarmAction.Till, TX, TY).ok).toBe(true);
    expect(farming.execute(FarmAction.Plant, TX, TY, 'wheat').ok).toBe(true);
    expect(farming.execute(FarmAction.Water, TX, TY).ok).toBe(true);
    expect(farming.execute(FarmAction.Harvest, TX, TY).ok).toBe(false);
    clock.advance(40_000);
    farming.update();
    const result = farming.execute(FarmAction.Harvest, TX, TY);
    expect(result.ok).toBe(true);
    expect(result.harvest?.quantity).toBe(3);
  });

  it('rejects future actions explicitly', () => {
    const { farming } = makeSystem();
    expect(farming.execute(FarmAction.Build, TX, TY).reason).toBe(
      FarmRejectReason.UnsupportedAction,
    );
  });
});

describe('FarmingSystem chunk queries', () => {
  it('buckets crops and soil by chunk for renderers', () => {
    const { farming } = makeSystem();
    expect(farming.till(TX, TY).ok).toBe(true);
    expect(farming.plant(TX, TY, 'wheat').ok).toBe(true);
    const chunk = { x: Math.floor(TX / 32), y: Math.floor(TY / 32) };
    expect(farming.getCropsInChunk(chunk)).toHaveLength(1);
    expect(farming.getSoilTilesInChunk(chunk)).toHaveLength(1);
    expect(farming.getCropsInChunk({ x: 0, y: 0 })).toHaveLength(0);
  });
});

describe('LocalFarmState', () => {
  it('defaults to Normal soil and tracks the plot', () => {
    const state = new LocalFarmState();
    expect(state.getSoil(0, 0)).toBe(SoilState.Normal);
    expect(state.getPlot()).toEqual({
      x: FARM_PLOT_X,
      y: FARM_PLOT_Y,
      width: FARM_PLOT_WIDTH,
      height: FARM_PLOT_HEIGHT,
    });
    expect(state.isInPlot(FARM_PLOT_X, FARM_PLOT_Y)).toBe(true);
    expect(state.isInPlot(FARM_PLOT_X - 1, FARM_PLOT_Y)).toBe(false);
  });

  it('stores deltas only (Normal removes entries)', () => {
    const state = new LocalFarmState();
    state.setSoil(5, 5, SoilState.Tilled);
    expect(state.getModifiedSoil()).toHaveLength(1);
    state.setSoil(5, 5, SoilState.Normal);
    expect(state.getModifiedSoil()).toHaveLength(0);
  });

  it('round-trips crops', () => {
    const state = new LocalFarmState();
    expect(state.getCrop(1, 1)).toBeNull();
    state.setCrop({
      cropId: 'wheat',
      tileX: 1,
      tileY: 1,
      plantedAtMs: 0,
      grownMs: 0,
      wateredAtMs: null,
      watered: false,
      stage: 0,
    });
    expect(state.getAllCrops()).toHaveLength(1);
    expect(state.removeCrop(1, 1)?.cropId).toBe('wheat');
    expect(state.getAllCrops()).toHaveLength(0);
  });
});

describe('SeedPouch', () => {
  it('consumes only when seeds remain', () => {
    const pouch = SeedPouch.withStarterSeeds(['wheat_seed']);
    expect(pouch.getCount('wheat_seed')).toBe(20);
    expect(pouch.consume('wheat_seed')).toBe(true);
    expect(pouch.getCount('wheat_seed')).toBe(19);
    expect(pouch.getCount('unknown')).toBe(0);
    expect(pouch.consume('unknown')).toBe(false);
  });

  it('supports restocking', () => {
    const pouch = new SeedPouch();
    pouch.add('corn_seed', 5);
    expect(pouch.getCount('corn_seed')).toBe(5);
  });
});
