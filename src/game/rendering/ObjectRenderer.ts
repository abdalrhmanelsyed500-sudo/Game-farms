import Phaser from 'phaser';
import { ELEVATION_STEP_PX } from '../../shared/constants/config.js';
import type { WorldObjectData } from '../../shared/types/objects.js';
import { getAssetDefinition } from '../assets/AssetManifest.js';
import type { Coordinates } from '../isometric/Coordinates.js';
import { depthForSortKey, depthOfEntity, depthOfObject } from '../isometric/DepthSorter.js';
import { footprintCenter } from '../world/WorldObject.js';
import { RenderLayer } from './RenderLayers.js';

/**
 * Handle for a rendered world object / entity view.
 * The container holds [shadow, sprite]; sync() re-projects after movement.
 */
export interface ObjectView {
  readonly container: Phaser.GameObjects.Container;
  readonly sprite: Phaser.GameObjects.Image;
  readonly shadow: Phaser.GameObjects.Image;
  sync(worldX: number, worldY: number): void;
  destroy(): void;
}

/**
 * ObjectRenderer: turns logical WorldObjectData / entity positions into
 * Phaser views.
 *
 * Anchor rule: every view is positioned by its GROUND-CONTACT point
 * (bottom-center of the sprite, origin 0.5/1.0 from the manifest) projected
 * from logical coordinates. Visual height extends upward freely; the logical
 * footprint stays on the ground. No per-object manual offsets.
 */
export class ObjectRenderer {
  private readonly scene: Phaser.Scene;
  private readonly coordinates: Coordinates;

  public constructor(scene: Phaser.Scene, coordinates: Coordinates) {
    this.scene = scene;
    this.coordinates = coordinates;
  }

  /** Create a view for a static world object (tree, rock, decor). */
  public createObject(obj: WorldObjectData): ObjectView {
    const center = footprintCenter(obj);
    const view = this.buildView(obj.spriteKey, obj.id, this.shadowScaleFor(obj.width));
    this.placeView(view, center.x, center.y, obj.elevation, depthOfObject(obj));
    view.container.setName(`object_${obj.id}`);
    return view;
  }

  /** Create a view for a free-moving entity (player placeholder). */
  public createEntity(spriteKey: string, entityId: string): ObjectView {
    const view = this.buildView(spriteKey, entityId, 0.55);
    view.container.setName(`entity_${entityId}`);
    return view;
  }

  /** Re-project an entity view after it moved in world coordinates. */
  public syncEntity(view: ObjectView, entityId: string, worldX: number, worldY: number, elevation = 0): void {
    this.placeView(view, worldX, worldY, elevation, depthOfEntity(worldX, worldY, entityId));
  }

  // -- internals ---------------------------------------------------------------

  private buildView(spriteKey: string, debugId: string, shadowScale: number): ObjectView {
    const def = getAssetDefinition(spriteKey);
    const sprite = this.scene.add.image(0, 0, spriteKey);
    sprite.setOrigin(def.originX, def.originY);
    sprite.setName(`sprite_${debugId}`);

    const shadow = this.scene.add.image(0, 0, 'shadow_blob');
    shadow.setAlpha(0.32);
    shadow.setScale(shadowScale);
    shadow.setName(`shadow_${debugId}`);

    const container = this.scene.add.container(0, 0, [shadow, sprite]);
    // NOTE: children of a Container render in list order; the container's own
    // depth is what participates in global sorting. Shadow-under-sprite is
    // guaranteed by list order, so we only set the container depth.
    const view: ObjectView = {
      container,
      sprite,
      shadow,
      sync: () => {
        // Static views never move; entity sync goes through syncEntity().
      },
      destroy: () => {
        // Explicit child destruction — never rely on container destroy
        // semantics for memory management.
        sprite.destroy();
        shadow.destroy();
        container.destroy();
      },
    };
    return view;
  }

  private placeView(
    view: ObjectView,
    worldX: number,
    worldY: number,
    elevation: number,
    depth: number,
  ): void {
    const ground = this.coordinates.worldToScreen(worldX, worldY);
    const lift = elevation * ELEVATION_STEP_PX;
    view.container.setPosition(ground.x, ground.y - lift);
    view.container.setDepth(depth);
  }

  /**
   * Shadow width scales with footprint so 2x2 trees ground themselves
   * believably while flowers keep a subtle dot. Purely visual.
   */
  private shadowScaleFor(footprintWidth: number): number {
    if (footprintWidth >= 2) {
      return 1.4;
    }
    return 0.7;
  }

  /** Ground-decal depth helper (reserved for future blob shadows / decals). */
  public static groundDecalDepth(sortX: number, sortY: number): number {
    return depthForSortKey(sortX, sortY, RenderLayer.GroundDecals);
  }
}
