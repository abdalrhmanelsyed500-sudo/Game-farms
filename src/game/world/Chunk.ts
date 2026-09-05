import { getChunkKey } from '../isometric/IsoMath.js';
import type { WorldObjectData } from '../../shared/types/objects.js';
import type { TileBounds } from '../../shared/types/coordinates.js';

/**
 * Chunk: a square region of the world (CHUNK_SIZE x CHUNK_SIZE tiles).
 *
 * Data-side responsibilities only: identity, bounds, the objects whose
 * footprint origin falls inside, and load state. Tile data itself lives in
 * the shared TileMap; visuals are owned by IsoRenderer and keyed by chunk key.
 */
export class Chunk {
  public readonly chunkX: number;
  public readonly chunkY: number;
  public readonly size: number;
  public readonly key: string;
  public readonly bounds: TileBounds;

  private objects: WorldObjectData[] = [];
  private loaded = false;

  public constructor(chunkX: number, chunkY: number, size: number) {
    this.chunkX = chunkX;
    this.chunkY = chunkY;
    this.size = size;
    this.key = getChunkKey(chunkX, chunkY);
    this.bounds = {
      x0: chunkX * size,
      y0: chunkY * size,
      x1: chunkX * size + size - 1,
      y1: chunkY * size + size - 1,
    };
  }

  public get isLoaded(): boolean {
    return this.loaded;
  }

  public getObjects(): readonly WorldObjectData[] {
    return this.objects;
  }

  public setObjects(objects: readonly WorldObjectData[]): void {
    this.objects = [...objects];
  }

  public addObject(obj: WorldObjectData): void {
    this.objects.push(obj);
  }

  public removeObject(objectId: string): boolean {
    const index = this.objects.findIndex((o) => o.id === objectId);
    if (index === -1) {
      return false;
    }
    this.objects.splice(index, 1);
    return true;
  }

  public markLoaded(): void {
    this.loaded = true;
  }

  public markUnloaded(): void {
    this.loaded = false;
  }

  public containsTile(tileX: number, tileY: number): boolean {
    return (
      tileX >= this.bounds.x0 &&
      tileX <= this.bounds.x1 &&
      tileY >= this.bounds.y0 &&
      tileY <= this.bounds.y1
    );
  }
}
