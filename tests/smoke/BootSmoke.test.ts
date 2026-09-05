// @vitest-environment jsdom
/**
 * BootSmoke: end-to-end boot verification WITHOUT a GPU.
 *
 * Boots the REAL game (BootScene => PreloadScene => WorldScene) under jsdom
 * with a stubbed Canvas2D context (installed by tests/smoke/setup.ts before
 * Phaser is imported). Pixels are meaningless here, but every wiring path
 * executes for real: asset generation, world build, chunk streaming,
 * renderer construction, camera, input, player, and debug tools.
 * Any undefined reference / bad Phaser API usage fails loudly.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import Phaser from 'phaser';
import { createPhaserConfig } from '../../src/game/GameConfig.js';
import type { WorldScene } from '../../src/game/scenes/WorldScene.js';
import { FarmAction, ToolType, type HarvestResult } from '../../src/shared/types/farming.js';
import type { FarmingSystem } from '../../src/game/farming/FarmingSystem.js';
import type { Toolbar } from '../../src/game/ui/Toolbar.js';

type AnyRecord = Record<string, unknown>;

async function waitFor(condition: () => boolean, timeoutMs: number, label: string): Promise<void> {
  const started = Date.now();
  for (;;) {
    if (condition()) {
      return;
    }
    if (Date.now() - started > timeoutMs) {
      throw new Error(`SMOKE_TIMEOUT waiting for ${label}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('BootSmoke (jsdom + stubbed canvas)', () => {
  let game: Phaser.Game | null = null;

  beforeAll(() => {
    const container = document.createElement('div');
    container.id = 'game-container';
    document.body.appendChild(container);
    const config = createPhaserConfig(container);
    config.type = Phaser.CANVAS; // deterministic renderer for the smoke env
    config.banner = false;
    game = new Phaser.Game(config);
    // jsdom never fires these on its own; Phaser boots on DOMContentLoaded.
    document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
    window.dispatchEvent(new window.Event('load'));
  }, 30000);

  afterAll(() => {
    game?.destroy(true);
    game = null;
  });

  it('boots through Boot => Preload => World', async () => {
    if (!game) {
      throw new Error('game was not created');
    }
    await waitFor(() => game?.scene.isActive('World') ?? false, 25000, 'World scene active');
    expect(game.scene.isActive('World')).toBe(true);
  }, 30000);

  it('streams chunks and renders tiles + objects + player', async () => {
    if (!game) {
      throw new Error('game was not created');
    }
    await waitFor(() => game?.scene.isActive('World') ?? false, 25000, 'World scene active');
    // Let the loop run so streaming + smoothing + overlays all execute.
    await sleep(1200);

    const scene = game.scene.getScene('World') as unknown as AnyRecord & WorldScene;
    const isoRenderer = (scene as AnyRecord)['isoRenderer'] as {
      renderedChunkCount: number;
      renderedTileCount: number;
      renderedObjectCount: number;
    };
    expect(isoRenderer.renderedChunkCount).toBe(9); // radius 1 => 3x3
    expect(isoRenderer.renderedTileCount).toBe(9 * 32 * 32);
    expect(isoRenderer.renderedObjectCount).toBeGreaterThan(0);

    // All manifest textures must exist after Preload.
    for (const key of ['tile_grass_01', 'tree_01', 'rock_01', 'player_placeholder', 'tile_hover']) {
      expect(scene.textures.exists(key)).toBe(true);
    }
  }, 30000);

  it('exercises camera, picking, player movement, and debug toggles', async () => {
    if (!game) {
      throw new Error('game was not created');
    }
    await waitFor(() => game?.scene.isActive('World') ?? false, 25000, 'World scene active');
    const scene = game.scene.getScene('World') as unknown as AnyRecord;
    const cameraController = scene['cameraController'] as {
      panByScreenDelta(dx: number, dy: number): void;
      zoomAt(x: number, y: number, factor: number): void;
      currentZoom: number;
    };
    const player = scene['player'] as {
      x: number;
      y: number;
      moveScreenSpace(sx: number, sy: number, dt: number): void;
    };
    const pickTile = scene['pickTile'] as (x: number, y: number) => unknown;
    const context = scene['context'] as {
      state: {
        toggleDebug(): void;
        toggleGrid(): void;
        toggleChunks(): void;
        toggleCollision(): void;
        isGridVisible(): boolean;
      };
    };

    const startX = player.x;
    player.moveScreenSpace(1, 0, 0.25);
    expect(player.x !== startX || player.y !== 128.5).toBe(true);

    const zoomBefore = cameraController.currentZoom;
    cameraController.zoomAt(512, 384, 1.25);
    cameraController.panByScreenDelta(120, 80);
    await sleep(400); // allow smoothing toward targets
    expect(cameraController.currentZoom).toBeGreaterThan(zoomBefore);

    const tile = (pickTile as (this: unknown, x: number, y: number) => unknown).call(scene, 512, 384) as {
      x: number;
      y: number;
    } | null;
    expect(tile).not.toBeNull();

    // Debug toggles must not throw and must flip state.
    context.state.toggleGrid();
    expect(context.state.isGridVisible()).toBe(true);
    context.state.toggleGrid();
    context.state.toggleDebug();
    context.state.toggleChunks();
    context.state.toggleCollision();
    context.state.toggleDebug();
    context.state.toggleChunks();
    context.state.toggleCollision();
    await sleep(400); // overlays redraw under toggled state
  }, 30000);

  it('runs the farming loop end-to-end with single-view updates', async () => {
    if (!game) {
      throw new Error('game was not created');
    }
    await waitFor(() => game?.scene.isActive('World') ?? false, 25000, 'World scene active');
    const scene = game.scene.getScene('World') as unknown as AnyRecord;
    const phaserScene = game.scene.getScene('World') as Phaser.Scene;
    const farming = scene['farming'] as FarmingSystem;
    const cropRenderer = scene['cropRenderer'] as { renderedCropCount: number };
    const soilRenderer = scene['soilRenderer'] as { renderedSoilCount: number };
    const toolbar = scene['toolbar'] as Toolbar;
    const player = scene['player'] as {
      setTool(t: ToolType): void;
      setSeedId(id: string | null): void;
      getTool(): ToolType;
    };

    // Farming textures were generated by Preload.
    for (const key of ['soil_tilled', 'soil_watered', 'tile_valid', 'crop_wheat_stage_01', 'farmhouse_01']) {
      expect(phaserScene.textures.exists(key)).toBe(true);
    }

    // Toolbar is laid out and hit-testable (relative: jsdom has no layout).
    const bar = toolbar.getBarRect();
    expect(bar.width).toBeGreaterThan(0);
    expect(bar.height).toBeGreaterThan(0);
    expect(toolbar.containsScreenPoint(bar.x + bar.width / 2, bar.y + bar.height / 2)).toBe(true);
    expect(toolbar.containsScreenPoint(bar.x + bar.width / 2, bar.y - 1000)).toBe(false);
    toolbar.setSelected(ToolType.Hoe, null);

    // Plot interior tile in loaded chunk (3,4).
    const TX = 106;
    const TY = 142;
    const displayBefore = phaserScene.children.length;

    player.setTool(ToolType.Hoe);
    expect(farming.execute(FarmAction.Till, TX, TY).ok).toBe(true);
    expect(soilRenderer.renderedSoilCount).toBe(1);

    player.setSeedId('wheat');
    expect(player.getTool()).toBe(ToolType.Seed);
    expect(farming.execute(FarmAction.Plant, TX, TY, 'wheat').ok).toBe(true);
    expect(cropRenderer.renderedCropCount).toBe(1);

    player.setTool(ToolType.WateringCan);
    expect(farming.execute(FarmAction.Water, TX, TY).ok).toBe(true);

    // Single-view updates only: soil overlay + crop container, no rebuilds.
    const displayAfter = phaserScene.children.length;
    expect(displayAfter - displayBefore).toBeLessThanOrEqual(4);

    // Invalid actions change nothing.
    expect(farming.execute(FarmAction.Till, 10, 10).ok).toBe(false);
    expect(soilRenderer.renderedSoilCount).toBe(1);
    expect(farming.canHarvest(TX, TY).ok).toBe(false);

    // Mature via the debug helper, then harvest for real.
    expect(farming.forceMatureCrop(TX, TY)).toBe(true);
    const harvests: HarvestResult[] = [];
    farming.events.on('harvest', (h) => harvests.push(h));
    player.setTool(ToolType.Hand);
    const result = farming.execute(FarmAction.Harvest, TX, TY);
    expect(result.ok).toBe(true);
    expect(harvests).toHaveLength(1);
    expect(harvests[0]?.quantity).toBe(3);
    await sleep(300); // harvest effects/tweens run without errors
    expect(cropRenderer.renderedCropCount).toBe(0);
    expect(soilRenderer.renderedSoilCount).toBe(1); // tilled soil remains
  }, 30000);
});
