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
});
