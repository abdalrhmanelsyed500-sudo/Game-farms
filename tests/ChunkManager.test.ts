import { describe, expect, it } from 'vitest';
import { ChunkManager } from '../src/game/world/ChunkManager.js';

/** 8x8 chunks of 32 (mirrors the 256-tile Phase 1 world). */
function makeManager(radius = 1): ChunkManager {
  return new ChunkManager(8, 8, 32, radius);
}

describe('ChunkManager', () => {
  it('loads the radius neighborhood around the center', () => {
    const manager = makeManager(1);
    manager.update({ x: 4, y: 4 });
    expect(manager.loadedCount).toBe(9);
    expect(manager.isLoaded(3, 3)).toBe(true);
    expect(manager.isLoaded(5, 5)).toBe(true);
    expect(manager.isLoaded(2, 4)).toBe(false);
  });

  it('clips the desired set at world edges', () => {
    const manager = makeManager(1);
    manager.update({ x: 0, y: 0 });
    expect(manager.loadedCount).toBe(4); // only (0..1, 0..1) are valid
    expect(manager.isLoaded(0, 0)).toBe(true);
    expect(manager.isLoaded(1, 1)).toBe(true);
  });

  it('supports larger radii', () => {
    const manager = makeManager(2);
    manager.update({ x: 4, y: 4 });
    expect(manager.loadedCount).toBe(25);
  });

  it('emits load/unload events for the set difference', () => {
    const manager = makeManager(1);
    const loaded: string[] = [];
    const unloaded: string[] = [];
    manager.events.on('chunk-load', (chunk) => loaded.push(chunk.key));
    manager.events.on('chunk-unload', (chunk) => unloaded.push(chunk.key));

    manager.update({ x: 4, y: 4 });
    expect(loaded).toHaveLength(9);
    expect(unloaded).toHaveLength(0);

    // Re-updating the same center emits nothing (stable set).
    loaded.length = 0;
    manager.update({ x: 4, y: 4 });
    expect(loaded).toHaveLength(0);
    expect(unloaded).toHaveLength(0);

    // Moving one chunk east: unload 3 (west column), load 3 (east column).
    manager.update({ x: 5, y: 4 });
    expect(unloaded.sort()).toEqual(['3,3', '3,4', '3,5']);
    expect(loaded.sort()).toEqual(['6,3', '6,4', '6,5']);
    expect(manager.loadedCount).toBe(9);
  });

  it('unloadAll clears everything with events', () => {
    const manager = makeManager(1);
    let unloads = 0;
    manager.events.on('chunk-unload', () => unloads++);
    manager.update({ x: 4, y: 4 });
    manager.unloadAll();
    expect(manager.loadedCount).toBe(0);
    expect(unloads).toBe(9);
    expect(manager.getLoadedChunk(4, 4)).toBeNull();
  });

  it('rejects negative radii', () => {
    const manager = makeManager();
    expect(() => manager.setRadius(-1)).toThrow();
  });
});
