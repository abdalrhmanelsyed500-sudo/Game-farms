import Phaser from 'phaser';
import { RenderLayer } from '../rendering/RenderLayers.js';
import type { DebugContext } from './DebugContext.js';

/**
 * ChunkOverlay: loaded-chunk boundaries + chunk labels (C).
 * Redraws when the loaded set changes or when toggled — chunk borders are
 * static in world space so no per-frame work is needed.
 */
export class ChunkOverlay {
  private readonly ctx: DebugContext;
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly labels: Phaser.GameObjects.Text[] = [];
  private knownKeys = '';

  public constructor(ctx: DebugContext) {
    this.ctx = ctx;
    this.graphics = ctx.scene.add.graphics().setDepth(RenderLayer.Debug + 2);
    this.applyVisibility();
    ctx.gameState.events.on('debug-changed', () => {
      this.applyVisibility();
      this.redraw();
    });
  }

  /** Called on an interval; redraws only when the loaded set changed. */
  public update(): void {
    if (!this.graphics.visible) {
      return;
    }
    const keys = [...this.ctx.worldManager.getWorld().chunks.getLoadedKeys()].sort().join(';');
    if (keys !== this.knownKeys) {
      this.redraw();
    }
  }

  private applyVisibility(): void {
    const visible = this.ctx.gameState.isChunksVisible();
    this.graphics.setVisible(visible);
    for (const label of this.labels) {
      label.setVisible(visible);
    }
  }

  private redraw(): void {
    const world = this.ctx.worldManager.getWorld();
    const coords = this.ctx.worldManager.coordinates;
    this.knownKeys = [...world.chunks.getLoadedKeys()].sort().join(';');

    const g = this.graphics;
    g.clear();
    for (const label of this.labels) {
      label.destroy();
    }
    this.labels.length = 0;
    if (!g.visible) {
      return;
    }

    for (const key of world.chunks.getLoadedKeys()) {
      const chunk = world.chunks.getLoadedChunk(...this.parseKey(key));
      if (!chunk) {
        continue;
      }
      const { x0, y0, x1, y1 } = chunk.bounds;
      // Chunk corners in world space (outer edges), projected to screen.
      const corners = [
        coords.worldToScreen(x0, y0),
        coords.worldToScreen(x1 + 1, y0),
        coords.worldToScreen(x1 + 1, y1 + 1),
        coords.worldToScreen(x0, y1 + 1),
      ];
      g.lineStyle(2, 0x40c8ff, 0.8);
      g.beginPath();
      g.moveTo(corners[0]?.x ?? 0, corners[0]?.y ?? 0);
      for (let i = 1; i < corners.length; i++) {
        g.lineTo(corners[i]?.x ?? 0, corners[i]?.y ?? 0);
      }
      g.closePath();
      g.strokePath();

      const labelPos = coords.worldToScreen((x0 + x1 + 1) / 2, y0);
      const label = this.ctx.scene.add
        .text(labelPos.x, labelPos.y - 12, `chunk ${key}`, {
          fontFamily: 'monospace',
          fontSize: '14px',
          color: '#40c8ff',
          backgroundColor: '#00000088',
          padding: { x: 4, y: 2 },
        })
        .setOrigin(0.5, 1)
        .setDepth(RenderLayer.Debug + 3);
      label.setVisible(g.visible);
      this.labels.push(label);
    }
  }

  private parseKey(key: string): [number, number] {
    const [x, y] = key.split(',').map(Number);
    return [x ?? 0, y ?? 0];
  }
}
