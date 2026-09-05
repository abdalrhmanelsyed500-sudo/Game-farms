import { describe, expect, it } from 'vitest';
import { CHUNK_SIZE, TILE_HEIGHT, TILE_WIDTH } from '../src/shared/constants/config.js';
import {
  chunkToWorldBounds,
  computeWorldOrigin,
  getChunkKey,
  isoPointToTile,
  parseChunkKey,
  screenToWorld,
  tileCenterToScreen,
  worldPixelSize,
  worldToChunk,
  worldToScreen,
  worldToTile,
} from '../src/game/isometric/IsoMath.js';

const ORIGIN = computeWorldOrigin(256, 256);

describe('IsoMath projection', () => {
  it('projects world (0,0) onto the configured origin', () => {
    const p = worldToScreen(0, 0, ORIGIN.x, ORIGIN.y);
    expect(p.x).toBeCloseTo(ORIGIN.x, 10);
    expect(p.y).toBeCloseTo(ORIGIN.y, 10);
  });

  it('follows the standard diamond formula', () => {
    // origin (0,0): screenX = (x - y) * 64, screenY = (x + y) * 32.
    const p = worldToScreen(10, 15, 0, 0);
    expect(p.x).toBeCloseTo((10 - 15) * (TILE_WIDTH / 2), 10);
    expect(p.y).toBeCloseTo((10 + 15) * (TILE_HEIGHT / 2), 10);
  });

  it('round-trips world -> screen -> world for integer tiles', () => {
    for (const [x, y] of [[0, 0], [10, 15], [70, 50], [255, 255], [3, 200]] as const) {
      const s = worldToScreen(x, y, ORIGIN.x, ORIGIN.y);
      const w = screenToWorld(s.x, s.y, ORIGIN.x, ORIGIN.y);
      expect(w.x).toBeCloseTo(x, 9);
      expect(w.y).toBeCloseTo(y, 9);
    }
  });

  it('round-trips world -> screen -> world for float entity positions', () => {
    for (const [x, y] of [[12.45, 8.72], [0.001, 0.999], [255.5, 128.25]] as const) {
      const s = worldToScreen(x, y, ORIGIN.x, ORIGIN.y);
      const w = screenToWorld(s.x, s.y, ORIGIN.x, ORIGIN.y);
      expect(w.x).toBeCloseTo(x, 9);
      expect(w.y).toBeCloseTo(y, 9);
    }
  });

  it('places tile diamonds on exact pixel centers', () => {
    // Tile (0,0) center = world (0.5, 0.5) => (originX, originY + 32).
    const c = tileCenterToScreen(0, 0, ORIGIN.x, ORIGIN.y);
    expect(c.x).toBeCloseTo(ORIGIN.x, 10);
    expect(c.y).toBeCloseTo(ORIGIN.y + TILE_HEIGHT / 2, 10);
  });

  it('resolves the tile under a projected point (pointer picking)', () => {
    // Center of tile (10, 15) must pick back tile (10, 15).
    const center = tileCenterToScreen(10, 15, ORIGIN.x, ORIGIN.y);
    expect(isoPointToTile(center.x, center.y, ORIGIN.x, ORIGIN.y)).toEqual({ x: 10, y: 15 });
    // Corner probes just inside the diamond still resolve to the same tile.
    expect(isoPointToTile(center.x + 60, center.y, ORIGIN.x, ORIGIN.y)).toEqual({ x: 10, y: 15 });
    expect(isoPointToTile(center.x, center.y + 28, ORIGIN.x, ORIGIN.y)).toEqual({ x: 10, y: 15 });
  });

  it('floors world points to their containing tile', () => {
    expect(worldToTile(12.45, 8.72)).toEqual({ x: 12, y: 8 });
    expect(worldToTile(0.999, 0.001)).toEqual({ x: 0, y: 0 });
  });

  it('keeps the whole world in positive pixel space', () => {
    const size = worldPixelSize(256, 256);
    expect(size.width).toBe((256 + 256) * (TILE_WIDTH / 2));
    expect(size.height).toBe((256 + 256) * (TILE_HEIGHT / 2));
    // Extreme corners must land inside [0, size].
    const corners = [
      worldToScreen(0, 0, ORIGIN.x, ORIGIN.y),
      worldToScreen(256, 0, ORIGIN.x, ORIGIN.y),
      worldToScreen(0, 256, ORIGIN.x, ORIGIN.y),
      worldToScreen(256, 256, ORIGIN.x, ORIGIN.y),
    ];
    for (const c of corners) {
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.x).toBeLessThanOrEqual(size.width);
      expect(c.y).toBeLessThanOrEqual(size.height);
    }
  });
});

describe('IsoMath chunks', () => {
  it('converts world tiles to chunk coordinates (spec example)', () => {
    // x=70, y=50 with 32x32 chunks => chunk (2, 1).
    expect(worldToChunk(70, 50, CHUNK_SIZE)).toEqual({ x: 2, y: 1 });
  });

  it('handles chunk boundaries exactly', () => {
    expect(worldToChunk(0, 0)).toEqual({ x: 0, y: 0 });
    expect(worldToChunk(31, 31)).toEqual({ x: 0, y: 0 });
    expect(worldToChunk(32, 32)).toEqual({ x: 1, y: 1 });
    expect(worldToChunk(255, 255)).toEqual({ x: 7, y: 7 });
  });

  it('floors float entity positions before chunk conversion', () => {
    expect(worldToChunk(31.99, 63.5)).toEqual({ x: 0, y: 1 });
  });

  it('converts chunks back to inclusive tile bounds', () => {
    expect(chunkToWorldBounds(2, 1)).toEqual({ x0: 64, y0: 32, x1: 95, y1: 63 });
    expect(chunkToWorldBounds(0, 0)).toEqual({ x0: 0, y0: 0, x1: 31, y1: 31 });
  });

  it('round-trips chunk keys', () => {
    expect(parseChunkKey(getChunkKey(2, 1))).toEqual({ x: 2, y: 1 });
    expect(() => parseChunkKey('nope')).toThrow();
  });
});
