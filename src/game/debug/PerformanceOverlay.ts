import Phaser from 'phaser';
import { DEBUG_REFRESH_HZ } from '../../shared/constants/config.js';
import { RenderLayer } from '../rendering/RenderLayers.js';
import type { DebugContext } from './DebugContext.js';

/**
 * PerformanceOverlay: lightweight renderer stats (visible with debug mode).
 * FPS, smoothed frame time, rendered object counts, loaded chunks, and
 * texture count. No heavy profiler — just enough to catch regressions.
 */
export class PerformanceOverlay {
  private readonly ctx: DebugContext;
  private readonly text: Phaser.GameObjects.Text;
  private accumulator = 0;
  private frameMsEma = 16.7;
  private readonly refreshInterval: number;

  public constructor(ctx: DebugContext) {
    this.ctx = ctx;
    this.refreshInterval = 1 / DEBUG_REFRESH_HZ;
    this.text = ctx.scene.add
      .text(0, 10, '', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#9adcff',
        backgroundColor: '#00000088',
        padding: { x: 8, y: 6 },
        lineSpacing: 2,
        align: 'right',
      })
      .setScrollFactor(0)
      .setOrigin(1, 0)
      .setDepth(RenderLayer.Debug + 10);
    this.applyVisibility();
    ctx.gameState.events.on('debug-changed', () => this.applyVisibility());
  }

  /** Reposition on resize (anchored top-right). */
  public layout(viewportWidth: number): void {
    this.text.setX(viewportWidth - 10);
  }

  public update(dtSeconds: number): void {
    // Always track the EMA so the first visible refresh is already stable.
    const ms = dtSeconds * 1000;
    this.frameMsEma += (ms - this.frameMsEma) * 0.08;

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
    const { scene, worldManager, isoRenderer } = this.ctx;
    const world = worldManager.getWorld();
    const fps = Math.round(scene.game.loop.actualFps);
    const textureCount = scene.textures.list ? Object.keys(scene.textures.list).length : 0;
    const displayList = scene.children.length;
    return [
      `FPS ${fps}  (${this.frameMsEma.toFixed(1)} ms)`,
      `chunks ${world.chunks.loadedCount}`,
      `tiles ${isoRenderer.renderedTileCount}  objs ${isoRenderer.renderedObjectCount}`,
      `display list ${displayList}  textures ${textureCount}`,
    ];
  }
}
