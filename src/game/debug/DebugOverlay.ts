import Phaser from 'phaser';
import { DEBUG_REFRESH_HZ } from '../../shared/constants/config.js';
import { TERRAIN_TYPE_NAMES } from '../../shared/types/tiles.js';
import { RenderLayer } from '../rendering/RenderLayers.js';
import type { DebugContext } from './DebugContext.js';

/**
 * DebugOverlay: main inspection panel (F3). Fixed to the screen.
 * Shows FPS, player/camera/chunk state, selection, and streaming stats.
 * Refreshes at DEBUG_REFRESH_HZ — string building never runs per-frame.
 */
export class DebugOverlay {
  private readonly ctx: DebugContext;
  private readonly text: Phaser.GameObjects.Text;
  private accumulator = 0;
  private readonly refreshInterval: number;

  public constructor(ctx: DebugContext) {
    this.ctx = ctx;
    this.refreshInterval = 1 / DEBUG_REFRESH_HZ;
    this.text = ctx.scene.add
      .text(10, 10, '', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#c8ffc8',
        backgroundColor: '#00000088',
        padding: { x: 8, y: 6 },
        lineSpacing: 2,
      })
      .setScrollFactor(0)
      .setDepth(RenderLayer.Debug + 10);
    this.applyVisibility();
    ctx.gameState.events.on('debug-changed', () => this.applyVisibility());
  }

  public update(dtSeconds: number): void {
    this.accumulator += dtSeconds;
    if (this.accumulator < this.refreshInterval) {
      return;
    }
    this.accumulator = 0;
    if (this.text.visible) {
      this.text.setText(this.buildLines().join('\n'));
    }
  }

  private applyVisibility(): void {
    this.text.setVisible(this.ctx.gameState.isDebugVisible());
  }

  private buildLines(): string[] {
    const { worldManager, player, cameraController, isoRenderer, gameState, scene } = this.ctx;
    const world = worldManager.getWorld();
    const cam = cameraController.camera;
    const coords = worldManager.coordinates;
    const viewCenter = cam.getViewCenter();
    const centerWorld = coords.screenToWorld(viewCenter.x, viewCenter.y);
    const camChunk = coords.worldToChunk(centerWorld.x, centerWorld.y);
    const playerChunk = coords.worldToChunk(player.x, player.y);
    const fps = Math.round(scene.game.loop.actualFps);

    const selected = gameState.getSelectedTile();
    const hover = gameState.getHoverTile();
    const selectedTerrain =
      selected && world.isInBounds(selected.x, selected.y)
        ? TERRAIN_TYPE_NAMES[world.getTile(selected.x, selected.y).terrain]
        : '—';

    const lines = [
      `FPS ${fps}  |  F3 debug  G grid  C chunks  K collision`,
      `player  world (${player.x.toFixed(2)}, ${player.y.toFixed(2)})  tile (${player.tileX}, ${player.tileY})  chunk (${playerChunk.x}, ${playerChunk.y})`,
      `camera  scroll (${cam.scrollX.toFixed(0)}, ${cam.scrollY.toFixed(0)})  zoom ${cam.zoom.toFixed(2)}  chunk (${camChunk.x}, ${camChunk.y})`,
      `stream  loaded ${world.chunks.loadedCount} chunks  |  rendered ${isoRenderer.renderedTileCount} tiles / ${isoRenderer.renderedObjectCount} objects`,
      `hover   ${hover ? `(${hover.x}, ${hover.y})` : '—'}   selected ${selected ? `(${selected.x}, ${selected.y}) ${selectedTerrain}` : '—'}`,
      `world   ${worldManager.config.width}x${worldManager.config.height}  seed ${worldManager.config.seed}  origin (${coords.originX}, ${coords.originY})`,
    ];
    const farmingLines = this.ctx.getFarmingDebugLines?.();
    if (farmingLines) {
      lines.push(...farmingLines);
    }
    return lines;
  }
}
