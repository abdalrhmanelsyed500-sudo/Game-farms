import Phaser from 'phaser';
import { RenderLayer } from '../rendering/RenderLayers.js';
import type { DebugContext } from './DebugContext.js';

/**
 * CoordinateOverlay: hovered-tile inspector (visible with debug mode).
 * Shows the hovered tile across all three coordinate spaces:
 * world (float), tile (int), screen (px), and chunk.
 * WorldScene pushes hover updates; this class only formats + displays.
 */
export class CoordinateOverlay {
  private readonly text: Phaser.GameObjects.Text;

  public constructor(ctx: DebugContext) {
    this.text = ctx.scene.add
      .text(10, 0, '', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#ffe9a3',
        backgroundColor: '#00000088',
        padding: { x: 8, y: 6 },
        lineSpacing: 2,
      })
      .setScrollFactor(0)
      .setDepth(RenderLayer.Debug + 10);
    this.applyVisibility(ctx.gameState.isDebugVisible());
    ctx.gameState.events.on('debug-changed', (snapshot) => this.applyVisibility(snapshot.debugVisible));
  }

  /** Reposition on resize (anchored bottom-left). */
  public layout(viewportHeight: number): void {
    this.text.setY(viewportHeight - this.text.height - 10);
  }

  public setHover(info: {
    screenX: number;
    screenY: number;
    worldX: number;
    worldY: number;
    tileX: number;
    tileY: number;
    chunkX: number;
    chunkY: number;
  }): void {
    this.text.setText(
      [
        `screen  (${info.screenX.toFixed(0)}, ${info.screenY.toFixed(0)})`,
        `world   (${info.worldX.toFixed(2)}, ${info.worldY.toFixed(2)})`,
        `tile    (${info.tileX}, ${info.tileY})`,
        `chunk   (${info.chunkX}, ${info.chunkY})`,
      ].join('\n'),
    );
  }

  public clear(): void {
    this.text.setText('hover a tile…');
  }

  private applyVisibility(visible: boolean): void {
    this.text.setVisible(visible);
  }
}
