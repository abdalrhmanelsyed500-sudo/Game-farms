import { TypedEventEmitter } from '../../shared/utils/EventEmitter.js';
import { Logger } from '../../shared/utils/Logger.js';
import type { ChunkCoord } from '../../shared/types/coordinates.js';
import { getChunkKey } from '../isometric/IsoMath.js';
import { Chunk } from './Chunk.js';

/** Events emitted when the loaded chunk set changes. */
export interface ChunkManagerEvents {
  'chunk-load': Chunk;
  'chunk-unload': Chunk;
}

/**
 * ChunkManager: decides WHICH chunks are loaded. Pure logic — it owns Chunk
 * data shells and emits load/unload events; IsoRenderer subscribes and owns
 * the visuals. This split keeps streaming unit-testable without Phaser.
 */
export class ChunkManager {
  public readonly events = new TypedEventEmitter<ChunkManagerEvents>();

  private readonly chunksX: number;
  private readonly chunksY: number;
  private readonly chunkSize: number;
  private loadRadius: number;
  private readonly loaded = new Map<string, Chunk>();

  public constructor(chunksX: number, chunksY: number, chunkSize: number, loadRadius: number) {
    this.chunksX = chunksX;
    this.chunksY = chunksY;
    this.chunkSize = chunkSize;
    this.loadRadius = loadRadius;
  }

  public get radius(): number {
    return this.loadRadius;
  }

  public setRadius(radius: number): void {
    if (radius < 0) {
      throw new Error(`CHUNK_MANAGER_ERROR: negative radius ${radius}`);
    }
    this.loadRadius = radius;
  }

  public get loadedCount(): number {
    return this.loaded.size;
  }

  public getLoadedKeys(): readonly string[] {
    return [...this.loaded.keys()];
  }

  public getLoadedChunk(chunkX: number, chunkY: number): Chunk | null {
    return this.loaded.get(getChunkKey(chunkX, chunkY)) ?? null;
  }

  public isLoaded(chunkX: number, chunkY: number): boolean {
    return this.loaded.has(getChunkKey(chunkX, chunkY));
  }

  public isValidChunk(chunkX: number, chunkY: number): boolean {
    return chunkX >= 0 && chunkY >= 0 && chunkX < this.chunksX && chunkY < this.chunksY;
  }

  /**
   * Recompute the desired chunk set around `center` and emit load/unload
   * events for the difference. Call when the camera chunk changes (or the
   * radius changes). Distant chunk shells are dropped so only nearby chunks
   * consume memory.
   */
  public update(center: ChunkCoord, radius: number = this.loadRadius): void {
    const desired = this.desiredChunkKeys(center, radius);

    // Unload first (frees memory before new allocations).
    for (const [key, chunk] of this.loaded) {
      if (!desired.has(key)) {
        this.loaded.delete(key);
        chunk.markUnloaded();
        this.events.emit('chunk-unload', chunk);
      }
    }

    // Then load newly desired chunks, nearest-first for faster pop-in.
    const toLoad = [...desired]
      .filter((key) => !this.loaded.has(key))
      .sort((a, b) => this.distanceToCenterSq(a, center) - this.distanceToCenterSq(b, center));

    for (const key of toLoad) {
      const [cx, cy] = key.split(',').map(Number) as [number, number];
      try {
        const chunk = new Chunk(cx, cy, this.chunkSize);
        chunk.markLoaded();
        this.loaded.set(key, chunk);
        this.events.emit('chunk-load', chunk);
      } catch (error) {
        Logger.error('ChunkManager', `CHUNK_LOAD_ERROR: failed to create chunk ${key}`, error);
      }
    }
  }

  /** Unload everything (scene shutdown / world switch). */
  public unloadAll(): void {
    for (const [, chunk] of this.loaded) {
      chunk.markUnloaded();
      this.events.emit('chunk-unload', chunk);
    }
    this.loaded.clear();
  }

  /** All valid chunk keys within Chebyshev `radius` of center. */
  public desiredChunkKeys(center: ChunkCoord, radius: number = this.loadRadius): Set<string> {
    const keys = new Set<string>();
    for (let cy = center.y - radius; cy <= center.y + radius; cy++) {
      for (let cx = center.x - radius; cx <= center.x + radius; cx++) {
        if (this.isValidChunk(cx, cy)) {
          keys.add(getChunkKey(cx, cy));
        }
      }
    }
    return keys;
  }

  private distanceToCenterSq(key: string, center: ChunkCoord): number {
    const [cx, cy] = key.split(',').map(Number) as [number, number];
    const dx = cx - center.x;
    const dy = cy - center.y;
    return dx * dx + dy * dy;
  }
}
