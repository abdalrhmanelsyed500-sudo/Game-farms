import Phaser from 'phaser';
import { Logger } from '../../shared/utils/Logger.js';
import type { Chunk } from '../world/Chunk.js';
import type { WorldManager } from '../world/WorldManager.js';
import { ObjectRenderer, type ObjectView } from '../rendering/ObjectRenderer.js';
import { TileRenderer, type TileNeighborhood } from '../rendering/TileRenderer.js';
import { TerrainType } from '../../shared/types/tiles.js';
import type { WorldObjectData } from '../../shared/types/objects.js';
import type { Coordinates } from './Coordinates.js';

/**
 * All Phaser GameObjects belonging to one loaded chunk.
 * Views are added directly to the scene (NOT wrapped in a Container) so that
 * global depth sorting interleaves correctly across chunk borders.
 */
export interface ChunkView {
  readonly chunkKey: string;
  readonly tiles: Phaser.GameObjects.Image[];
  readonly objects: ObjectView[];
  tileCount: number;
  objectCount: number;
}

/**
 * IsoRenderer: owns ALL world visuals. Subscribes to ChunkManager load/unload
 * events and builds/destroys per-chunk views through TileRenderer and
 * ObjectRenderer.
 *
 * Lifecycle per chunk: CREATE (event) => BUILD VIEWS => DESTROY (event).
 * Unloaded chunks leave zero GameObjects behind — visuals are destroyed,
 * never merely hidden.
 */
export class IsoRenderer {
  private readonly worldManager: WorldManager;
  private readonly coordinates: Coordinates;
  private readonly tileRenderer: TileRenderer;
  private readonly objectRenderer: ObjectRenderer;
  private readonly views = new Map<string, ChunkView>();
  private attached = false;
  private unsubscribeLoad: (() => void) | null = null;
  private unsubscribeUnload: (() => void) | null = null;

  public constructor(scene: Phaser.Scene, worldManager: WorldManager) {
    this.worldManager = worldManager;
    this.coordinates = worldManager.coordinates;
    this.tileRenderer = new TileRenderer(scene, this.coordinates);
    this.objectRenderer = new ObjectRenderer(scene, this.coordinates);
  }

  public get objectRendererInstance(): ObjectRenderer {
    return this.objectRenderer;
  }

  public get renderedChunkCount(): number {
    return this.views.size;
  }

  public get renderedTileCount(): number {
    let total = 0;
    for (const view of this.views.values()) {
      total += view.tileCount;
    }
    return total;
  }

  public get renderedObjectCount(): number {
    let total = 0;
    for (const view of this.views.values()) {
      total += view.objectCount;
    }
    return total;
  }

  /** Subscribe to chunk streaming events. Idempotent. */
  public attach(): void {
    if (this.attached) {
      return;
    }
    const chunks = this.worldManager.getWorld().chunks;
    this.unsubscribeLoad = chunks.events.on('chunk-load', (chunk) => this.buildChunkView(chunk));
    this.unsubscribeUnload = chunks.events.on('chunk-unload', (chunk) => this.destroyChunkView(chunk.key));
    this.attached = true;
  }

  /** Unsubscribe and destroy every view (scene shutdown). Idempotent. */
  public detach(): void {
    if (!this.attached) {
      return;
    }
    this.unsubscribeLoad?.();
    this.unsubscribeUnload?.();
    this.unsubscribeLoad = null;
    this.unsubscribeUnload = null;
    for (const key of [...this.views.keys()]) {
      this.destroyChunkView(key);
    }
    this.attached = false;
  }

  /** Re-render a single tile after its data changed (future systems). */
  public refreshTile(tileX: number, tileY: number): void {
    const world = this.worldManager.getWorld();
    const coord = world.worldToChunk(tileX, tileY);
    const view = this.views.get(this.coordinates.getChunkKey(coord.x, coord.y));
    if (!view) {
      return;
    }
    const target = TileRenderer.tileName(tileX, tileY);
    const image = view.tiles.find((t) => t.name === target);
    if (image) {
      this.tileRenderer.refreshTile(image, world.getTile(tileX, tileY));
    }
  }

  /**
   * Add ONE object view without rebuilding its chunk (Phase 3: placed
   * buildings). Returns false when the chunk is not loaded (the object then
   * renders normally on chunk load) or the view already exists.
   */
  public addObjectView(obj: WorldObjectData): boolean {
    const world = this.worldManager.getWorld();
    const coord = world.worldToChunk(obj.x, obj.y);
    const view = this.views.get(this.coordinates.getChunkKey(coord.x, coord.y));
    if (!view) {
      return false;
    }
    const name = `object_${obj.id}`;
    if (view.objects.some((o) => o.container.name === name)) {
      return false;
    }
    view.objects.push(this.objectRenderer.createObject(obj));
    view.objectCount = view.objects.length;
    return true;
  }

  /** Remove ONE object view without rebuilding its chunk. False when absent. */
  public removeObjectView(objectId: string): boolean {
    const name = `object_${objectId}`;
    for (const view of this.views.values()) {
      const index = view.objects.findIndex((o) => o.container.name === name);
      if (index >= 0) {
        const [removed] = view.objects.splice(index, 1);
        removed?.destroy();
        view.objectCount = view.objects.length;
        return true;
      }
    }
    return false;
  }

  // -- chunk views ---------------------------------------------------------------

  private buildChunkView(chunk: Chunk): void {
    if (this.views.has(chunk.key)) {
      return;
    }
    const world = this.worldManager.getWorld();
    const view: ChunkView = { chunkKey: chunk.key, tiles: [], objects: [], tileCount: 0, objectCount: 0 };
    try {
      const { x0, y0, x1, y1 } = chunk.bounds;
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const tile = world.getTile(x, y);
          const image = this.tileRenderer.createTile(tile, this.readNeighborhood(world, x, y));
          view.tiles.push(image);
        }
      }
      view.tileCount = view.tiles.length;

      for (const obj of world.getObjectsInChunk(chunk.chunkX, chunk.chunkY)) {
        view.objects.push(this.objectRenderer.createObject(obj));
      }
      view.objectCount = view.objects.length;

      this.views.set(chunk.key, view);
      Logger.debug('IsoRenderer', `chunk ${chunk.key} built (${view.tileCount} tiles, ${view.objectCount} objects)`);
    } catch (error) {
      Logger.error('IsoRenderer', `CHUNK_LOAD_ERROR: failed to build visuals for ${chunk.key}`, error);
      this.destroyViewObjects(view);
    }
  }

  private destroyChunkView(chunkKey: string): void {
    const view = this.views.get(chunkKey);
    if (!view) {
      return;
    }
    this.views.delete(chunkKey);
    this.destroyViewObjects(view);
    Logger.debug('IsoRenderer', `chunk ${chunkKey} destroyed`);
  }

  private destroyViewObjects(view: ChunkView): void {
    for (const tile of view.tiles) {
      tile.destroy();
    }
    view.tiles.length = 0;
    for (const obj of view.objects) {
      obj.destroy();
    }
    view.objects.length = 0;
    view.tileCount = 0;
    view.objectCount = 0;
  }

  /**
   * Read the 8-neighbourhood for the (future) autotiler. Out-of-bounds
   * neighbours report the center terrain so edges stay stable.
   */
  private readNeighborhood(
    world: { getTile(x: number, y: number): { terrain: TerrainType } },
    x: number,
    y: number,
  ): TileNeighborhood {
    const at = (nx: number, ny: number, fallback: TerrainType): TerrainType => {
      try {
        return world.getTile(nx, ny).terrain;
      } catch {
        return fallback;
      }
    };
    const center = at(x, y, TerrainType.Grass);
    return {
      n: at(x, y - 1, center),
      ne: at(x + 1, y - 1, center),
      e: at(x + 1, y, center),
      se: at(x + 1, y + 1, center),
      s: at(x, y + 1, center),
      sw: at(x - 1, y + 1, center),
      w: at(x - 1, y, center),
      nw: at(x - 1, y - 1, center),
    };
  }
}
