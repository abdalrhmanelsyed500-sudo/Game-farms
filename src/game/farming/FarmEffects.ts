import Phaser from 'phaser';
import { Logger } from '../../shared/utils/Logger.js';
import type { Coordinates } from '../isometric/Coordinates.js';
import { RenderLayer } from '../rendering/RenderLayers.js';

/**
 * FarmEffects: lightweight placeholder feedback for farming actions.
 *
 * Tinted dot bursts + floating text, all tweened and self-destroying.
 * Counts are tiny (≤10 sprites per action, short-lived) so no pooling is
 * needed; every effect destroys its own GameObjects on completion.
 */
export class FarmEffects {
  private readonly scene: Phaser.Scene;
  private readonly coordinates: Coordinates;

  public constructor(scene: Phaser.Scene, coordinates: Coordinates) {
    this.scene = scene;
    this.coordinates = coordinates;
  }

  /** Brown soil puff on till. */
  public tillBurst(tileX: number, tileY: number): void {
    this.burst(tileX, tileY, 0x8a5a33, 8, 46, -70);
  }

  /** Green sprout puff on plant. */
  public plantPuff(tileX: number, tileY: number): void {
    this.burst(tileX, tileY, 0x55c25a, 7, 36, -60);
  }

  /** Blue droplets on water. */
  public waterDrops(tileX: number, tileY: number): void {
    this.burst(tileX, tileY, 0x4fa8ff, 9, 40, -34);
  }

  /** Gold burst on harvest. */
  public harvestBurst(tileX: number, tileY: number): void {
    this.burst(tileX, tileY, 0xffd23f, 10, 56, -90);
  }

  /** Floating reward text, e.g. "+3 Wheat". */
  public floatingText(tileX: number, tileY: number, text: string, color = '#ffd23f'): void {
    try {
      const center = this.coordinates.tileCenterToScreen(tileX, tileY);
      const label = this.scene.add
        .text(center.x, center.y - 50, text, {
          fontFamily: 'monospace',
          fontSize: '16px',
          color,
          stroke: '#1a1206',
          strokeThickness: 4,
        })
        .setOrigin(0.5)
        .setDepth(RenderLayer.Effects + 1);
      this.scene.tweens.add({
        targets: label,
        y: label.y - 44,
        alpha: 0,
        duration: 1300,
        ease: 'Cubic.easeOut',
        onComplete: () => label.destroy(),
      });
    } catch (error) {
      Logger.warn('FarmEffects', 'floating text failed', error);
    }
  }

  /** Small red rejection hint at the tile. */
  public rejectHint(tileX: number, tileY: number, text: string): void {
    this.floatingText(tileX, tileY, text, '#ff8a8a');
  }

  private burst(
    tileX: number,
    tileY: number,
    tint: number,
    count: number,
    spread: number,
    rise: number,
  ): void {
    try {
      const center = this.coordinates.tileCenterToScreen(tileX, tileY);
      for (let i = 0; i < count; i++) {
        const dot = this.scene.add
          .image(center.x, center.y - 6, 'fx_dot')
          .setTint(tint)
          .setScale(0.5 + Math.random() * 0.5)
          .setDepth(RenderLayer.Effects);
        const dx = (Math.random() - 0.5) * 2 * spread;
        this.scene.tweens.add({
          targets: dot,
          x: dot.x + dx,
          y: dot.y + rise * (0.5 + Math.random() * 0.7),
          alpha: 0,
          scale: 0.1,
          duration: 450 + Math.random() * 250,
          ease: 'Cubic.easeOut',
          onComplete: () => dot.destroy(),
        });
      }
    } catch (error) {
      Logger.warn('FarmEffects', 'particle burst failed', error);
    }
  }
}
