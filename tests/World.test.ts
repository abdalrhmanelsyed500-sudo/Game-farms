import { beforeAll, describe, expect, it } from 'vitest';
import { PLAYER_SPAWN_TILE_X, PLAYER_SPAWN_TILE_Y } from '../src/shared/constants/config.js';
import { TerrainType } from '../src/shared/types/tiles.js';
import { WorldObjectType } from '../src/shared/types/objects.js';
import { WorldManager } from '../src/game/world/WorldManager.js';
import { DEFAULT_WORLD_CONFIG } from '../src/game/world/WorldConfig.js';

describe('World', () => {
  const manager = new WorldManager(DEFAULT_WORLD_CONFIG);

  beforeAll(() => {
    manager.initialize();
  });

  it('initializes the demo world with configured dimensions', () => {
    const world = manager.getWorld();
    expect(world.config.width).toBe(256);
    expect(world.config.height).toBe(256);
  });

  it('getTile returns consistent tiles with terrain + flags', () => {
    const world = manager.getWorld();
    const tile = world.getTile(PLAYER_SPAWN_TILE_X, PLAYER_SPAWN_TILE_Y);
    expect(tile.x).toBe(PLAYER_SPAWN_TILE_X);
    expect(tile.y).toBe(PLAYER_SPAWN_TILE_Y);
    expect(tile.terrain).toBe(TerrainType.Grass);
    expect(tile.walkable).toBe(true);
  });

  it('setTile persists terrain changes', () => {
    const world = manager.getWorld();
    const before = world.getTile(200, 200);
    world.setTile({ ...before, terrain: TerrainType.Stone });
    expect(world.getTile(200, 200).terrain).toBe(TerrainType.Stone);
    // Restore to keep other tests deterministic.
    world.setTile({ ...before, terrain: before.terrain });
  });

  it('rejects out-of-bounds tile access loudly', () => {
    const world = manager.getWorld();
    expect(() => world.getTile(-1, 0)).toThrow();
    expect(() => world.getTile(256, 256)).toThrow();
    expect(world.isInBounds(0, 0)).toBe(true);
    expect(world.isInBounds(255, 255)).toBe(true);
    expect(world.isInBounds(256, 0)).toBe(false);
  });

  it('contains authored regions: road (west), pond (east), forest (north)', () => {
    const world = manager.getWorld();
    // West road: x ~ 40 column must contain road tiles.
    let roadFound = false;
    for (let y = 0; y < 256 && !roadFound; y++) {
      for (let x = 20; x < 60; x++) {
        if (world.getTile(x, y).terrain === TerrainType.Road) {
          roadFound = true;
          break;
        }
      }
    }
    expect(roadFound).toBe(true);
    // East pond center is water.
    expect(world.getTile(196, 128).terrain).toBe(TerrainType.Water);
    // North band has trees.
    const forestObjects = world.getObjectsInChunk(4, 1);
    expect(forestObjects.some((o) => o.type === WorldObjectType.Tree)).toBe(true);
  });

  it('keeps the spawn clearing walkable and object-free', () => {
    const world = manager.getWorld();
    for (let y = PLAYER_SPAWN_TILE_Y - 6; y <= PLAYER_SPAWN_TILE_Y + 6; y++) {
      for (let x = PLAYER_SPAWN_TILE_X - 6; x <= PLAYER_SPAWN_TILE_X + 6; x++) {
        expect(world.isWalkable(x, y)).toBe(true);
      }
    }
  });

  it('blocks water and tree footprints, allows grass/roads', () => {
    const world = manager.getWorld();
    expect(world.isWalkable(196, 128)).toBe(false); // pond water
    expect(world.isWalkable(PLAYER_SPAWN_TILE_X, PLAYER_SPAWN_TILE_Y)).toBe(true);
    // A tree footprint tile near spawn (depth-test corridor) must be blocked.
    expect(world.isWalkable(PLAYER_SPAWN_TILE_X - 10, PLAYER_SPAWN_TILE_Y - 9)).toBe(false);
    expect(world.isWalkableAt(128.5, 128.5)).toBe(true);
  });

  it('indexes objects by id and by chunk', () => {
    const world = manager.getWorld();
    const chunkObjects = world.getObjectsInChunk(4, 4);
    expect(chunkObjects.length).toBeGreaterThan(0);
    const first = chunkObjects[0];
    if (!first) {
      throw new Error('expected objects in chunk (4,4)');
    }
    expect(world.getObject(first.id)).toEqual(first);
    expect(world.getObject('does-not-exist')).toBeNull();
  });

  it('converts world <=> chunk coordinates consistently', () => {
    const world = manager.getWorld();
    expect(world.worldToChunk(70, 50)).toEqual({ x: 2, y: 1 });
    expect(world.chunkToWorldBounds(2, 1)).toEqual({ x0: 64, y0: 32, x1: 95, y1: 63 });
  });

  it('tracks loaded chunks through the streaming update', () => {
    const world = manager.getWorld();
    world.chunks.update({ x: 4, y: 4 });
    expect(world.chunks.isLoaded(4, 4)).toBe(true);
    expect(world.getChunk(4, 4)).not.toBeNull();
    expect(world.chunks.loadedCount).toBe(9); // radius 1 => 3x3
  });

  it('clamps world points into bounds', () => {
    const world = manager.getWorld();
    expect(world.clampToBounds(-5, 300)).toEqual({ x: 0.001, y: 255.999 });
    expect(world.clampToBounds(128.5, 128.5)).toEqual({ x: 128.5, y: 128.5 });
  });
});
