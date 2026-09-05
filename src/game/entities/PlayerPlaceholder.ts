import Phaser from 'phaser';
import { PLAYER_RADIUS, PLAYER_SPEED } from '../../shared/constants/config.js';
import type { CollisionSystem } from '../collision/CollisionSystem.js';
import type { Coordinates } from '../isometric/Coordinates.js';
import type { IsoCamera } from '../isometric/IsoCamera.js';
import type { ObjectRenderer, ObjectView } from '../rendering/ObjectRenderer.js';

/**
 * PlayerPlaceholder: TEMPORARY test entity (not the final character system).
 *
 * Exists to validate movement, depth sorting, collision, and world
 * coordinates. Authoritative position is (worldX, worldY) in WORLD units;
 * the sprite position is DERIVED every frame via Coordinates. Sprite
 * coordinates are never read back as state.
 *
 * Movement input arrives in SCREEN space (camera-relative) and is converted
 * to world-space axes: screen-up moves north-west in world space... i.e. the
 * standard isometric mapping where screen diagonals align with world axes.
 */
export class PlayerPlaceholder {
  public static readonly ENTITY_ID = 'player-placeholder';
  public static readonly SPRITE_KEY = 'player_placeholder';

  private worldX: number;
  private worldY: number;
  private readonly speed: number;
  private readonly radius: number;
  private readonly collision: CollisionSystem;
  private readonly coordinates: Coordinates;
  private readonly objectRenderer: ObjectRenderer;
  private view: ObjectView | null = null;

  public constructor(
    spawnX: number,
    spawnY: number,
    collision: CollisionSystem,
    coordinates: Coordinates,
    objectRenderer: ObjectRenderer,
    speed: number = PLAYER_SPEED,
    radius: number = PLAYER_RADIUS,
  ) {
    this.worldX = spawnX;
    this.worldY = spawnY;
    this.collision = collision;
    this.coordinates = coordinates;
    this.objectRenderer = objectRenderer;
    this.speed = speed;
    this.radius = radius;
  }

  public get x(): number {
    return this.worldX;
  }

  public get y(): number {
    return this.worldY;
  }

  public get tileX(): number {
    return Math.floor(this.worldX);
  }

  public get tileY(): number {
    return Math.floor(this.worldY);
  }

  /** Projected ground position (for camera focus / debug). */
  public getScreenPosition(): { x: number; y: number } {
    return this.coordinates.worldToScreen(this.worldX, this.worldY);
  }

  public createView(): void {
    if (this.view) {
      return;
    }
    this.view = this.objectRenderer.createEntity(
      PlayerPlaceholder.SPRITE_KEY,
      PlayerPlaceholder.ENTITY_ID,
    );
    this.syncView();
  }

  public destroyView(): void {
    this.view?.destroy();
    this.view = null;
  }

  /**
   * Move by a SCREEN-space vector (camera-relative). Converts to world axes:
   * screen (1, 0) [right] => world (+x, -y) diagonal; screen (0, 1) [down]
   * => world (+x, +y) diagonal. Normalized so diagonal speed stays constant.
   */
  public moveScreenSpace(sx: number, sy: number, dtSeconds: number): void {
    if (sx === 0 && sy === 0) {
      return;
    }
    // Isometric screen-to-world axis mapping (inverse of the projection's
    // rotation, normalized): screenX axis => (1, -1)/√2, screenY => (1, 1)/√2.
    const inv = 1 / Math.SQRT2;
    const dirX = (sx + sy) * inv;
    const dirY = (-sx + sy) * inv;
    const step = this.speed * dtSeconds;
    const resolved = this.collision.move(this.worldX, this.worldY, dirX * step, dirY * step, this.radius);
    this.worldX = resolved.x;
    this.worldY = resolved.y;
    this.syncView();
  }

  /** Teleport in world units (debug tools / spawn). Still collision-aware. */
  public teleport(worldX: number, worldY: number): void {
    this.worldX = worldX;
    this.worldY = worldY;
    this.syncView();
  }

  private syncView(): void {
    if (this.view) {
      this.objectRenderer.syncEntity(
        this.view,
        PlayerPlaceholder.ENTITY_ID,
        this.worldX,
        this.worldY,
      );
    }
  }

  /** Expose the underlying container for camera-follow-free focus math. */
  public getViewObject(): Phaser.GameObjects.Container | null {
    return this.view?.container ?? null;
  }

  /** Current chunk convenience (debug overlay). */
  public getChunk(isoCamera: IsoCamera): { x: number; y: number } {
    void isoCamera;
    return this.coordinates.worldToChunk(this.worldX, this.worldY);
  }
}
