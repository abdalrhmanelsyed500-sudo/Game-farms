import Phaser from 'phaser';
import type { SoilState } from '../../shared/types/farming.js';
import { Logger } from '../../shared/utils/Logger.js';
import type { Coordinates } from '../isometric/Coordinates.js';
import type { Chunk } from '../world/Chunk.js';
import type { ChunkManager } from '../world/ChunkManager.js';
import { ObjectRenderer } from '../rendering/ObjectRenderer.js';
import { soilTextureKey } from './CropDefinitions.js';
import type { FarmingSystem } from './FarmingSystem.js';

/**
 * SoilRenderer: tilled/watered soil OVERLAYS.
 *
 * Soil is rendered as a 128×64 diamond overlay ON TOP of the unchanged base
 * terrain tile (grass stays grass underneath). This keeps TileRenderer and
 * the terrain pipeline completely untouched: soil changes never re-resolve
 * base tiles, never touch neighbors, never rebuild chunks.
 *
 * Overlays live in the GroundDecals depth band: above terrain, below all
 * world objects. Same lifecycle pattern as CropRenderer.
 */
export class SoilRenderer {
  private readonly scene: Phaser.Scene;
  private readonly coordinates: Coordinates;
  private readonly chunks: ChunkManager;
  private readonly farming: FarmingSystem;
  private readonly views = new Map<string, Phaser.GameObjects.Image>();
  private attached = false;
  private unsubscribers: Array<() => void> = [];

  public constructor(
    scene: Phaser.Scene,
    coordinates: Coordinates,
    chunks: ChunkManager,
    farming: FarmingSystem,
  ) {
    this.scene = scene;
    this.coordinates = coordinates;
    this.chunks = chunks;
    this.farming = farming;
  }

  public get renderedSoilCount(): number {
    return this.views.size;
  }

  /** Subscribe to chunk + farming events. Idempotent. */
  public attach(): void {
    if (this.attached) {
      return;
    }
    this.unsubscribers.push(
      this.chunks.events.on('chunk-load', (chunk: Chunk) => this.buildChunkSoil(chunk)),
      this.chunks.events.on('chunk-unload', (chunk: Chunk) => this.destroyChunkSoil(chunk)),
      this.farming.events.on('soil-changed', ({ x, y, soil }) => this.updateSoil(x, y, soil)),
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

  private buildChunkSoil(chunk: Chunk): void {
    try {
      for (const tile of this.farming.getSoilTilesInChunk({ x: chunk.chunkX, y: chunk.chunkY })) {
        this.updateSoil(tile.x, tile.y, tile.soil);
      }
    } catch (error) {
      Logger.error('SoilRenderer', `CHUNK_LOAD_ERROR: soil views failed for ${chunk.key}`, error);
    }
  }

  private destroyChunkSoil(chunk: Chunk): void {
    for (const tile of this.farming.getSoilTilesInChunk({ x: chunk.chunkX, y: chunk.chunkY })) {
      this.destroyViewByKey(SoilRenderer.viewKey(tile.x, tile.y));
    }
  }

  // -- single-view updates ------------------------------------------------------------------

  private updateSoil(tileX: number, tileY: number, soil: SoilState): void {
    const key = SoilRenderer.viewKey(tileX, tileY);
    const textureKey = soilTextureKey(soil);
    if (textureKey === null) {
      this.destroyViewByKey(key);
      return;
    }
    const existing = this.views.get(key);
    if (existing) {
      existing.setTexture(textureKey);
      return;
    }
    const center = this.coordinates.tileCenterToScreen(tileX, tileY);
    const overlay = this.scene.add.image(center.x, center.y, textureKey);
    overlay.setName(`soil_${key}`);
    overlay.setDepth(ObjectRenderer.groundDecalDepth(tileX, tileY));
    this.views.set(key, overlay);
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
