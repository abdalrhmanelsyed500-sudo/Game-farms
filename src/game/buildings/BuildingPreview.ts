import Phaser from 'phaser';
import type { Coordinates } from '../isometric/Coordinates.js';
import { RenderLayer } from '../rendering/RenderLayers.js';

/**
 * BuildingPreview: the build-mode ghost (Phase 3).
 *
 * World-space visuals: one validity diamond per footprint tile
 * (tile_valid/tile_invalid) + a translucent building sprite centered on the
 * footprint. Pure view — placement RULES stay in PlacementValidator.
 *
 * NOTE: placeholder art does not rotate; rotation changes the footprint
 * dims (which IS previewed exactly) while the sprite keeps its authored
 * orientation. Final art can add per-rotation frames later.
 */
export class BuildingPreview {
  private readonly scene: Phaser.Scene;
  private readonly coordinates: Coordinates;
  private readonly diamonds: Phaser.GameObjects.Image[] = [];
  private readonly ghost: Phaser.GameObjects.Image;
  private active = false;

  public constructor(scene: Phaser.Scene, coordinates: Coordinates) {
    this.scene = scene;
    this.coordinates = coordinates;
    // Pool for the largest catalog footprint (barn 4x3 = 12).
    for (let i = 0; i < 12; i++) {
      const diamond = scene.add
        .image(0, 0, 'tile_valid')
        .setDepth(RenderLayer.SelectionHighlight)
        .setVisible(false);
      this.diamonds.push(diamond);
    }
    this.ghost = scene.add
      .image(0, 0, 'fx_dot')
      .setDepth(RenderLayer.SelectionHighlight + 1)
      .setAlpha(0.6)
      .setVisible(false);
  }

  public get visible(): boolean {
    return this.active;
  }

  /** Arm the ghost with a building sprite; hidden until update() runs. */
  public show(spriteKey: string): void {
    this.active = true;
    if (this.scene.textures.exists(spriteKey)) {
      this.ghost.setTexture(spriteKey);
    }
    this.ghost.setVisible(true);
  }

  /**
   * Move the ghost to a footprint: diamonds on every tile, sprite centered
   * on the footprint, green/red by validity.
   */
  public update(footprint: ReadonlyArray<{ x: number; y: number }>, valid: boolean): void {
    if (!this.active) {
      return;
    }
    const texture = valid ? 'tile_valid' : 'tile_invalid';
    this.diamonds.forEach((diamond, i) => {
      const tile = footprint[i];
      if (!tile) {
        diamond.setVisible(false);
        return;
      }
      const center = this.coordinates.tileCenterToScreen(tile.x, tile.y);
      diamond.setTexture(texture).setPosition(center.x, center.y).setVisible(true);
    });
    if (footprint.length > 0) {
      const avg = footprint.reduce(
        (acc, t) => ({ x: acc.x + t.x, y: acc.y + t.y }),
        { x: 0, y: 0 },
      );
      const center = this.coordinates.tileCenterToScreen(
        avg.x / footprint.length,
        avg.y / footprint.length,
      );
      this.ghost.setPosition(center.x, center.y);
      this.ghost.setTint(valid ? 0xffffff : 0xff5a4a);
    }
  }

  /** Hide every ghost visual (stays armed until show() with a new sprite). */
  public hide(): void {
    this.active = false;
    this.ghost.setVisible(false);
    for (const diamond of this.diamonds) {
      diamond.setVisible(false);
    }
  }

  public destroy(): void {
    this.ghost.destroy();
    for (const diamond of this.diamonds) {
      diamond.destroy();
    }
    this.diamonds.length = 0;
  }
}
