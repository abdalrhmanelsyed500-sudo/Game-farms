import Phaser from 'phaser';
import { clamp } from '../../shared/utils/MathUtils.js';

/**
 * IsoCamera: thin, explicit wrapper around the Phaser camera.
 *
 * Owns: scroll/zoom application, bounds clamping, screen<=>world conversion
 * helpers, and view-rectangle queries (drives chunk streaming + debug).
 * Owns NO input handling and NO smoothing — see CameraController.
 */
export class IsoCamera {
  private readonly cam: Phaser.Cameras.Scene2D.Camera;
  private minX = 0;
  private minY = 0;
  private maxX = 0;
  private maxY = 0;
  private hasBounds = false;

  public constructor(cam: Phaser.Cameras.Scene2D.Camera) {
    this.cam = cam;
  }

  public get camera(): Phaser.Cameras.Scene2D.Camera {
    return this.cam;
  }

  public get scrollX(): number {
    return this.cam.scrollX;
  }

  public get scrollY(): number {
    return this.cam.scrollY;
  }

  public get zoom(): number {
    return this.cam.zoom;
  }

  public get viewportWidth(): number {
    return this.cam.width;
  }

  public get viewportHeight(): number {
    return this.cam.height;
  }

  public setScroll(x: number, y: number): void {
    const clamped = this.clampScroll(x, y, this.cam.zoom);
    this.cam.setScroll(clamped.x, clamped.y);
  }

  public setZoom(zoom: number): void {
    this.cam.setZoom(zoom);
    // Zoom changes the visible rect; re-clamp scroll against new extents.
    this.setScroll(this.cam.scrollX, this.cam.scrollY);
  }

  /** World bounds in world-pixels (from WorldManager.getPixelSize). */
  public setBounds(minX: number, minY: number, maxX: number, maxY: number): void {
    this.minX = minX;
    this.minY = minY;
    this.maxX = maxX;
    this.maxY = maxY;
    this.hasBounds = true;
    this.setScroll(this.cam.scrollX, this.cam.scrollY);
  }

  /** Clamp a candidate scroll so the view stays inside world bounds. */
  public clampScroll(x: number, y: number, zoom: number): { x: number; y: number } {
    if (!this.hasBounds) {
      return { x, y };
    }
    const viewW = this.cam.width / zoom;
    const viewH = this.cam.height / zoom;
    const worldW = this.maxX - this.minX;
    const worldH = this.maxY - this.minY;
    // If the view is larger than the world, center on the world.
    const cx = viewW >= worldW ? this.minX + worldW / 2 - viewW / 2 : clamp(x, this.minX, this.maxX - viewW);
    const cy = viewH >= worldH ? this.minY + worldH / 2 - viewH / 2 : clamp(y, this.minY, this.maxY - viewH);
    return { x: cx, y: cy };
  }

  /** Screen (canvas) pixels => world pixels, honoring scroll + zoom. */
  public screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    const out = this.cam.getWorldPoint(screenX, screenY);
    return { x: out.x, y: out.y };
  }

  /** Center the view on a world-pixel point. */
  public centerOn(worldX: number, worldY: number): void {
    this.setScroll(worldX - this.cam.width / this.cam.zoom / 2, worldY - this.cam.height / this.cam.zoom / 2);
  }

  /** Current visible rectangle in world pixels. */
  public getViewRect(): { x: number; y: number; width: number; height: number } {
    return {
      x: this.cam.scrollX,
      y: this.cam.scrollY,
      width: this.cam.width / this.cam.zoom,
      height: this.cam.height / this.cam.zoom,
    };
  }

  /** World-pixel center of the current view (streaming anchor). */
  public getViewCenter(): { x: number; y: number } {
    const rect = this.getViewRect();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  }
}
