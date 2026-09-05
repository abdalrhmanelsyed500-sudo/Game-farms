import Phaser from 'phaser';
import { RenderLayer } from '../rendering/RenderLayers.js';
import type { DebugContext } from './DebugContext.js';
import { computeVisibleTileRange, diamondCorners } from './ViewRange.js';

/**
 * CollisionOverlay: walkable/blocked tile visualization (K).
 * Green = walkable, red = blocked. Same redraw-throttle strategy as the
 * grid overlay; collision reads come from World (logical truth).
 */
export class CollisionOverlay {
  private readonly ctx: DebugContext;
  private readonly graphics: Phaser.GameObjects.Graphics;
  private lastScrollX = Number.NaN;
  private lastScrollY = Number.NaN;
  private lastZoom = Number.NaN;

  private static readonly REDRAW_THRESHOLD_PX = 24;

  public constructor(ctx: DebugContext) {
    this.ctx = ctx;
    this.graphics = ctx.scene.add.graphics().setDepth(RenderLayer.Debug + 1);
    this.applyVisibility();
    ctx.gameState.events.on('debug-changed', () => {
      this.applyVisibility();
      this.redraw(true);
    });
  }

  public update(): void {
    if (!this.graphics.visible) {
      return;
    }
    const cam = this.ctx.cameraController.camera;
    const moved =
      Math.abs(cam.scrollX - this.lastScrollX) > CollisionOverlay.REDRAW_THRESHOLD_PX ||
      Math.abs(cam.scrollY - this.lastScrollY) > CollisionOverlay.REDRAW_THRESHOLD_PX ||
      Math.abs(cam.zoom - this.lastZoom) > 0.0001;
    if (moved || Number.isNaN(this.lastScrollX)) {
      this.redraw(false);
    }
  }

  private applyVisibility(): void {
    this.graphics.setVisible(this.ctx.gameState.isCollisionVisible());
  }

  private redraw(force: boolean): void {
    const cam = this.ctx.cameraController.camera;
    if (!force && !this.graphics.visible) {
      return;
    }
    this.lastScrollX = cam.scrollX;
    this.lastScrollY = cam.scrollY;
    this.lastZoom = cam.zoom;
    if (!this.graphics.visible) {
      return;
    }
    const { worldManager } = this.ctx;
    const world = worldManager.getWorld();
    const coords = worldManager.coordinates;
    const config = worldManager.config;
    const range = computeVisibleTileRange(cam, coords, config.width, config.height);

    const g = this.graphics;
    g.clear();
    for (let y = range.y0; y <= range.y1; y++) {
      for (let x = range.x0; x <= range.x1; x++) {
        const center = coords.tileCenterToScreen(x, y);
        const corners = diamondCorners(center.x, center.y);
        const walkable = world.isWalkable(x, y);
        g.fillStyle(walkable ? 0x39d353 : 0xe5484d, walkable ? 0.16 : 0.3);
        g.beginPath();
        g.moveTo(corners[0]?.x ?? 0, corners[0]?.y ?? 0);
        for (let i = 1; i < corners.length; i++) {
          g.lineTo(corners[i]?.x ?? 0, corners[i]?.y ?? 0);
        }
        g.closePath();
        g.fillPath();
      }
    }
  }
}
