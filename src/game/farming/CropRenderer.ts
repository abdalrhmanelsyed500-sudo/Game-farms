import type { CropStateData } from '../../shared/types/farming.js';
import { Logger } from '../../shared/utils/Logger.js';
import { depthForSortKey } from '../isometric/DepthSorter.js';
import type { Chunk } from '../world/Chunk.js';
import type { ChunkManager } from '../world/ChunkManager.js';
import { ObjectRenderer, type ObjectView } from '../rendering/ObjectRenderer.js';
import { RenderLayer } from '../rendering/RenderLayers.js';
import { cropTextureKey } from './CropDefinitions.js';
import type { FarmingSystem } from './FarmingSystem.js';

/**
 * CropRenderer: crop VISUALS only — zero farming rules.
 *
 * - Subscribes to ChunkManager load/unload (builds/destroys per-chunk views
 *   from FarmingSystem state, so visuals survive streaming).
 * - Subscribes to FarmingSystem events (plant/stage/remove update ONE view).
 * - Positions/depths crops through the existing ObjectRenderer + DepthSorter:
 *   1x1 footprint convention, interleaved with trees/player/objects.
 */
export class CropRenderer {
  private readonly chunks: ChunkManager;
  private readonly objectRenderer: ObjectRenderer;
  private readonly farming: FarmingSystem;
  private readonly views = new Map<string, ObjectView>();
  private attached = false;
  private unsubscribers: Array<() => void> = [];

  public constructor(
    chunks: ChunkManager,
    objectRenderer: ObjectRenderer,
    farming: FarmingSystem,
  ) {
    this.chunks = chunks;
    this.objectRenderer = objectRenderer;
    this.farming = farming;
  }

  public get renderedCropCount(): number {
    return this.views.size;
  }

  /** Subscribe to chunk + farming events. Idempotent. */
  public attach(): void {
    if (this.attached) {
      return;
    }
    this.unsubscribers.push(
      this.chunks.events.on('chunk-load', (chunk: Chunk) => this.buildChunkCrops(chunk)),
      this.chunks.events.on('chunk-unload', (chunk: Chunk) => this.destroyChunkCrops(chunk)),
      this.farming.events.on('crop-planted', ({ crop }) => this.createCropView(crop)),
      this.farming.events.on('crop-stage', ({ crop, stage }) => this.updateCropStage(crop, stage)),
      this.farming.events.on('crop-removed', ({ x, y }) => this.destroyCropView(x, y)),
    );
    this.attached = true;
  }

  /** Unsubscribe and destroy every view. Idempotent. */
  public detach(): void {
    if (!this.attached) {
      return;
    }
    for (const off of this.unsubscribers) {
      off();
    }
    this.unsubscribers = [];
    for (const key of [...this.views.keys()]) {
      this.destroyViewByKey(key);
    }
    this.attached = false;
  }

  // -- chunk lifecycle ---------------------------------------------------------------

  private buildChunkCrops(chunk: Chunk): void {
    try {
      for (const crop of this.farming.getCropsInChunk({ x: chunk.chunkX, y: chunk.chunkY })) {
        this.createCropView(crop);
      }
    } catch (error) {
      Logger.error('CropRenderer', `CHUNK_LOAD_ERROR: crop views failed for ${chunk.key}`, error);
    }
  }

  private destroyChunkCrops(chunk: Chunk): void {
    for (const crop of this.farming.getCropsInChunk({ x: chunk.chunkX, y: chunk.chunkY })) {
      this.destroyCropView(crop.tileX, crop.tileY);
    }
  }

  // -- single-view updates (never rebuild chunks) -----------------------------------------

  private createCropView(crop: CropStateData): void {
    const key = CropRenderer.viewKey(crop.tileX, crop.tileY);
    if (this.views.has(key)) {
      return;
    }
    const viewId = `crop-${crop.cropId}-${crop.tileX}-${crop.tileY}`;
    const view = this.objectRenderer.createEntity(cropTextureKey(crop.cropId, crop.stage), viewId);
    // Ground anchor: tile center; depth: 1x1 footprint front corner.
    this.objectRenderer.syncEntity(view, viewId, crop.tileX + 0.5, crop.tileY + 0.5);
    view.container.setDepth(
      depthForSortKey(crop.tileX + 1, crop.tileY + 1, RenderLayer.WorldObjects, viewId),
    );
    view.container.setName(`cropview_${key}`);
    this.views.set(key, view);
  }

  private updateCropStage(crop: CropStateData, stage: number): void {
    const view = this.views.get(CropRenderer.viewKey(crop.tileX, crop.tileY));
    if (!view) {
      // Crop's chunk is not loaded — the view is built on chunk-load.
      return;
    }
    view.sprite.setTexture(cropTextureKey(crop.cropId, stage));
  }

  private destroyCropView(tileX: number, tileY: number): void {
    this.destroyViewByKey(CropRenderer.viewKey(tileX, tileY));
  }

  private destroyViewByKey(key: string): void {
    const view = this.views.get(key);
    if (!view) {
      return;
    }
    this.views.delete(key);
    view.destroy();
  }

  private static viewKey(tileX: number, tileY: number): string {
    return `${tileX},${tileY}`;
  }
}
