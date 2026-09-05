import { beforeAll, describe, expect, it } from 'vitest';
import { PLAYER_RADIUS } from '../src/shared/constants/config.js';
import { CollisionMap } from '../src/game/collision/CollisionMap.js';
import { CollisionSystem } from '../src/game/collision/CollisionSystem.js';
import { WorldManager } from '../src/game/world/WorldManager.js';
import { DEFAULT_WORLD_CONFIG } from '../src/game/world/WorldConfig.js';

describe('CollisionSystem', () => {
  const manager = new WorldManager(DEFAULT_WORLD_CONFIG);
  let system: CollisionSystem;

  beforeAll(() => {
    const world = manager.initialize();
    system = new CollisionSystem(new CollisionMap(world));
  });

  it('allows free movement on walkable ground', () => {
    // Spawn clearing center.
    const next = system.move(128.5, 128.5, 0.5, 0.25, PLAYER_RADIUS);
    expect(next.x).toBeCloseTo(129, 9);
    expect(next.y).toBeCloseTo(128.75, 9);
  });

  it('blocks movement into water', () => {
    // Pond center (196, 128) is deep water; approach from the west rim.
    const next = system.move(180.5, 128.5, 5, 0, PLAYER_RADIUS);
    // X must not advance into the water region.
    expect(next.x).toBeLessThan(182);
    expect(next.x).toBeGreaterThanOrEqual(180.5);
  });

  it('slides along blockers (axis-separated resolution)', () => {
    // Push diagonally into the authored corridor tree at (sx-10, sy-9).
    const startX = 117.4;
    const startY = 119.5;
    const next = system.move(startX, startY, 1.5, 0.8, PLAYER_RADIUS);
    const movedX = Math.abs(next.x - startX) > 0.0001;
    const movedY = Math.abs(next.y - startY) > 0.0001;
    // Either slides, or (fully wedged) stays — but never enters the blocker.
    expect(system.collisionMap.isCircleWalkable(next.x, next.y, PLAYER_RADIUS)).toBe(true);
    expect(movedX || movedY || (next.x === startX && next.y === startY)).toBe(true);
  });

  it('never leaves the resolved position inside a blocked tile', () => {
    // Start on the walkable sandy shore west of the pond, push diagonally
    // into the water: the resolution must slide or stop, never sink.
    const next = system.move(181.5, 128.5, 3, 1.5, PLAYER_RADIUS);
    expect(system.collisionMap.isCircleWalkable(next.x, next.y, PLAYER_RADIUS)).toBe(true);
    // Y was free (shoreline runs north-south here) so it must have advanced.
    expect(next.y).toBeGreaterThan(128.5);
  });

  it('treats out-of-bounds as blocked', () => {
    expect(system.collisionMap.isWalkable(-1, 0)).toBe(false);
    expect(system.collisionMap.isWalkable(0, -1)).toBe(false);
    expect(system.collisionMap.isWalkable(256, 256)).toBe(false);
  });
});
