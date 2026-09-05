import {
  CAMERA_KEYBOARD_SPEED,
  CAMERA_MAX_ZOOM,
  CAMERA_MIN_ZOOM,
  CAMERA_SMOOTHING,
} from '../../shared/constants/config.js';
import { clamp, dampFactor } from '../../shared/utils/MathUtils.js';
import { IsoCamera } from '../isometric/IsoCamera.js';

/**
 * CameraController: input-driven camera behavior with smoothing.
 *
 * - Keyboard vector pans continuously (update loop).
 * - Drag deltas pan immediately into the target (buttery via smoothing).
 * - Wheel/pinch zoom toward the pointer with smooth interpolation.
 * - Scroll targets are clamped to world bounds; zoom is clamped to
 *   [CAMERA_MIN_ZOOM, CAMERA_MAX_ZOOM].
 *
 * WorldScene wires InputManager events to the pan/zoom methods; this class
 * never touches input or scene code directly.
 */
export class CameraController {
  private readonly isoCamera: IsoCamera;
  private targetScrollX: number;
  private targetScrollY: number;
  private targetZoom: number;
  private readonly minZoom: number;
  private readonly maxZoom: number;
  private readonly keyboardSpeed: number;

  public constructor(
    isoCamera: IsoCamera,
    options: {
      minZoom?: number;
      maxZoom?: number;
      keyboardSpeed?: number;
      initialZoom?: number;
    } = {},
  ) {
    this.isoCamera = isoCamera;
    this.minZoom = options.minZoom ?? CAMERA_MIN_ZOOM;
    this.maxZoom = options.maxZoom ?? CAMERA_MAX_ZOOM;
    this.keyboardSpeed = options.keyboardSpeed ?? CAMERA_KEYBOARD_SPEED;
    this.targetScrollX = isoCamera.scrollX;
    this.targetScrollY = isoCamera.scrollY;
    this.targetZoom = options.initialZoom ?? isoCamera.zoom;
  }

  public get camera(): IsoCamera {
    return this.isoCamera;
  }

  public get currentZoom(): number {
    return this.isoCamera.zoom;
  }

  /** Snap (no smoothing) — used for initial placement. */
  public snapTo(worldX: number, worldY: number, zoom?: number): void {
    if (zoom !== undefined) {
      this.targetZoom = clamp(zoom, this.minZoom, this.maxZoom);
      this.isoCamera.setZoom(this.targetZoom);
    }
    const clamped = this.isoCamera.clampScroll(
      worldX - this.isoCamera.viewportWidth / this.targetZoom / 2,
      worldY - this.isoCamera.viewportHeight / this.targetZoom / 2,
      this.targetZoom,
    );
    this.targetScrollX = clamped.x;
    this.targetScrollY = clamped.y;
    this.isoCamera.setScroll(this.targetScrollX, this.targetScrollY);
  }

  /** Pan by a screen-pixel drag delta (positive dx = pointer moved right). */
  public panByScreenDelta(dx: number, dy: number): void {
    this.targetScrollX -= dx / this.targetZoom;
    this.targetScrollY -= dy / this.targetZoom;
    this.clampTarget();
  }

  /**
   * Zoom by a factor around a screen point (the world point under the
   * pointer stays under the pointer).
   */
  public zoomAt(screenX: number, screenY: number, factor: number): void {
    const newZoom = clamp(this.targetZoom * factor, this.minZoom, this.maxZoom);
    if (newZoom === this.targetZoom) {
      return;
    }
    // World point currently under the pointer (in target space).
    const worldX = this.targetScrollX + screenX / this.targetZoom;
    const worldY = this.targetScrollY + screenY / this.targetZoom;
    this.targetZoom = newZoom;
    this.targetScrollX = worldX - screenX / this.targetZoom;
    this.targetScrollY = worldY - screenY / this.targetZoom;
    this.clampTarget();
  }

  /** Per-frame: apply keyboard pan + smooth actual => target. dt in seconds. */
  public update(dtSeconds: number, keyboardVector: { x: number; y: number }): void {
    if (keyboardVector.x !== 0 || keyboardVector.y !== 0) {
      const step = (this.keyboardSpeed * dtSeconds) / this.targetZoom;
      this.targetScrollX += keyboardVector.x * step;
      this.targetScrollY += keyboardVector.y * step;
      this.clampTarget();
    }
    const t = dampFactor(CAMERA_SMOOTHING, dtSeconds);
    const cam = this.isoCamera;
    const newZoom = cam.zoom + (this.targetZoom - cam.zoom) * t;
    // Apply zoom first (it affects the visible rect), then scroll.
    if (Math.abs(newZoom - cam.zoom) > 0.00001) {
      cam.setZoom(newZoom);
    }
    const newScrollX = cam.scrollX + (this.targetScrollX - cam.scrollX) * t;
    const newScrollY = cam.scrollY + (this.targetScrollY - cam.scrollY) * t;
    if (Math.abs(newScrollX - cam.scrollX) > 0.001 || Math.abs(newScrollY - cam.scrollY) > 0.001) {
      cam.setScroll(newScrollX, newScrollY);
    }
  }

  /** Re-clamp targets (call after resize / bounds change). */
  public reapplyBounds(): void {
    this.clampTarget();
    this.isoCamera.setScroll(this.isoCamera.scrollX, this.isoCamera.scrollY);
  }

  private clampTarget(): void {
    const clamped = this.isoCamera.clampScroll(this.targetScrollX, this.targetScrollY, this.targetZoom);
    this.targetScrollX = clamped.x;
    this.targetScrollY = clamped.y;
  }
}
