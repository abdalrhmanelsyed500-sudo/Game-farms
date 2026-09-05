import { describe, expect, it } from 'vitest';
import { WorldObjectType } from '../src/shared/types/objects.js';
import {
  compareDepths,
  depthOfEntity,
  depthOfObject,
  depthOfTile,
  isInFrontOf,
  stableTiebreak,
} from '../src/game/isometric/DepthSorter.js';
import { createWorldObject } from '../src/game/world/WorldObject.js';
import { RenderLayer } from '../src/game/rendering/RenderLayers.js';

describe('DepthSorter', () => {
  it('sorts objects by x + y (front = larger sum)', () => {
    const back = createWorldObject(WorldObjectType.Tree, 10, 10, { id: 'back' });
    const front = createWorldObject(WorldObjectType.Tree, 12, 12, { id: 'front' });
    expect(depthOfObject(front)).toBeGreaterThan(depthOfObject(back));
    expect(isInFrontOf(front, back)).toBe(true);
    expect(isInFrontOf(back, front)).toBe(false);
  });

  it('sorts an entity behind vs in front of a tree by footprint edge', () => {
    const tree = createWorldObject(WorldObjectType.Tree, 10, 10, { id: 'tree' }); // 2x2
    // Entity at the tree's back corner (smaller x+y) => behind.
    const behind = depthOfEntity(10.1, 10.1, 'player');
    // Entity past the tree's front edge (larger x+y) => in front.
    const inFront = depthOfEntity(12.1, 12.1, 'player');
    const treeDepth = depthOfObject(tree);
    expect(behind).toBeLessThan(treeDepth);
    expect(inFront).toBeGreaterThan(treeDepth);
  });

  it('sorts multi-tile objects by their front (max x+y) corner', () => {
    const small = createWorldObject(WorldObjectType.Rock, 10, 10, { id: 'small' }); // 1x1
    const big = createWorldObject(WorldObjectType.Tree, 10, 10, { id: 'big' }); // 2x2
    // Same origin, but the 2x2 footprint extends further => sorts in front.
    expect(depthOfObject(big)).toBeGreaterThan(depthOfObject(small));
  });

  it('orders same-tile objects deterministically (no flicker)', () => {
    const a = createWorldObject(WorldObjectType.Flower, 5, 5, { id: 'flower-a' });
    const b = createWorldObject(WorldObjectType.Flower, 5, 5, { id: 'flower-b' });
    const da = depthOfObject(a);
    const db = depthOfObject(b);
    // Deterministic across calls…
    expect(depthOfObject(a)).toBe(da);
    expect(depthOfObject(b)).toBe(db);
    // …and strictly ordered so sprites never z-fight.
    expect(da).not.toBe(db);
    expect(compareDepths({ depth: da, id: a.id }, { depth: db, id: b.id })).not.toBe(0);
  });

  it('produces stable tiebreaks in [0, 1)', () => {
    for (const id of ['a', 'player-placeholder', 'obj-tree-1-2']) {
      const t = stableTiebreak(id);
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThan(1);
      expect(stableTiebreak(id)).toBe(t);
    }
  });

  it('keeps terrain below world objects and everything inside layer bands', () => {
    const maxTile = depthOfTile(255, 255);
    const minObject = depthOfObject(createWorldObject(WorldObjectType.Rock, 0, 0, { id: 'o' }));
    const maxObject = depthOfObject(
      createWorldObject(WorldObjectType.Tree, 254, 254, { id: 'p' }),
    );
    expect(maxTile).toBeLessThan(RenderLayer.WorldObjects);
    expect(minObject).toBeGreaterThanOrEqual(RenderLayer.WorldObjects);
    expect(maxObject).toBeLessThan(RenderLayer.Foreground);
  });

  it('compares depths with id fallback for exact ties', () => {
    expect(compareDepths({ depth: 1, id: 'a' }, { depth: 2, id: 'b' })).toBeLessThan(0);
    expect(compareDepths({ depth: 2, id: 'a' }, { depth: 1, id: 'b' })).toBeGreaterThan(0);
    expect(compareDepths({ depth: 1, id: 'a' }, { depth: 1, id: 'b' })).toBeLessThan(0);
    expect(compareDepths({ depth: 1, id: 'a' }, { depth: 1, id: 'a' })).toBe(0);
  });
});
