import Phaser from 'phaser';
import { Logger } from '../../shared/utils/Logger.js';
import { ASSET_KEYS } from './AssetManifest.js';

/**
 * PlaceholderTextureFactory: generates clean development textures at runtime.
 *
 * All art is ORIGINAL and drawn in code (no external assets, no copies of
 * any existing game). Placeholders respect final dimensions, anchors, and
 * isometric alignment so real art can replace them 1:1 later.
 *
 * Deterministic: all "random" speckle uses a local LCG seeded per texture,
 * so textures are identical on every load.
 */

/** Tiny deterministic PRNG for texture speckle (independent of world seed). */
function makeSpeckle(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

interface DiamondSpec {
  cx: number;
  cy: number;
  w: number;
  h: number;
}

export class PlaceholderTextureFactory {
  public static createAll(scene: Phaser.Scene): void {
    const factory = new PlaceholderTextureFactory(scene);
    factory.generateTiles();
    factory.generateObjects();
    factory.generateEntities();
    factory.generateFx();
    factory.verifyAll();
  }

  private readonly scene: Phaser.Scene;
  private readonly g: Phaser.GameObjects.Graphics;

  private constructor(scene: Phaser.Scene) {
    this.scene = scene;
    // Graphics used purely as a drawing surface; hidden from the camera.
    this.g = scene.add.graphics().setVisible(false);
  }

  // -- tiles -------------------------------------------------------------------

  private generateTiles(): void {
    this.tile('tile_grass_01', 101, 0x63ad52, 0x4c8a40, 'blades');
    this.tile('tile_grass_02', 102, 0x6cb45a, 0x529245, 'speckle');
    this.tile('tile_grass_03', 103, 0x5da34c, 0x47853d, 'blades');
    this.tile('tile_dirt_01', 111, 0x9a6b42, 0x7c5433, 'clumps');
    this.tile('tile_dirt_02', 112, 0xa3764b, 0x835d39, 'clumps');
    this.waterTile('tile_water_01', 121, 0x3d7fc2, 0);
    this.waterTile('tile_water_02', 122, 0x4589cc, 1);
    this.tile('tile_stone_01', 131, 0x9d9d94, 0x7e7e78, 'cracks');
    this.tile('tile_stone_02', 132, 0xa8a8a0, 0x86867f, 'cracks');
    this.tile('tile_sand_01', 141, 0xe2ca85, 0xc4a966, 'speckle');
    this.tile('tile_road_01', 151, 0xc4a26d, 0xa37f52, 'pebbles');
    this.tile('tile_road_02', 152, 0xcda976, 0xaa8757, 'pebbles');
  }

  private diamondPath(spec: DiamondSpec): void {
    const { cx, cy, w, h } = spec;
    this.g.beginPath();
    this.g.moveTo(cx, cy - h / 2);
    this.g.lineTo(cx + w / 2, cy);
    this.g.lineTo(cx, cy + h / 2);
    this.g.lineTo(cx - w / 2, cy);
    this.g.closePath();
  }

  /** Standard diamond tile with edge definition + deterministic detail. */
  private tile(
    key: string,
    seed: number,
    base: number,
    dark: number,
    detail: 'speckle' | 'blades' | 'clumps' | 'cracks' | 'pebbles',
  ): void {
    const g = this.g;
    g.clear();
    // Base diamond.
    g.fillStyle(base, 1);
    this.diamondPath({ cx: 64, cy: 32, w: 128, h: 64 });
    g.fillPath();
    // Subtle top-light: lighter inner diamond.
    g.fillStyle(0xffffff, 0.07);
    this.diamondPath({ cx: 64, cy: 30, w: 112, h: 54 });
    g.fillPath();
    // Crisp edge for tile readability.
    g.lineStyle(2, dark, 0.55);
    this.diamondPath({ cx: 64, cy: 32, w: 126, h: 62 });
    g.strokePath();

    const rand = makeSpeckle(seed);
    // Keep detail inside the diamond: sample points, reject outside.
    const inside = (x: number, y: number): boolean =>
      Math.abs(x - 64) / 58 + Math.abs(y - 32) / 28 <= 1;

    if (detail === 'speckle' || detail === 'pebbles') {
      for (let i = 0; i < 26; i++) {
        const x = 8 + rand() * 112;
        const y = 6 + rand() * 52;
        if (!inside(x, y)) {
          continue;
        }
        const light = rand() > 0.5;
        g.fillStyle(light ? 0xffffff : dark, detail === 'pebbles' ? 0.5 : 0.22);
        const r = detail === 'pebbles' ? 1.6 + rand() * 1.4 : 1 + rand() * 1.4;
        g.fillCircle(x, y, r);
      }
    } else if (detail === 'blades') {
      for (let i = 0; i < 22; i++) {
        const x = 8 + rand() * 112;
        const y = 6 + rand() * 52;
        if (!inside(x, y)) {
          continue;
        }
        g.lineStyle(1.6, rand() > 0.4 ? dark : 0xd9f2c8, 0.7);
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + (rand() - 0.5) * 3, y - 3 - rand() * 3);
        g.strokePath();
      }
    } else if (detail === 'clumps') {
      for (let i = 0; i < 14; i++) {
        const x = 8 + rand() * 112;
        const y = 6 + rand() * 52;
        if (!inside(x, y)) {
          continue;
        }
        g.fillStyle(rand() > 0.5 ? dark : 0xd9b58c, 0.55);
        g.fillEllipse(x, y, 5 + rand() * 6, 2.5 + rand() * 2.5);
      }
    } else if (detail === 'cracks') {
      g.lineStyle(1.4, dark, 0.6);
      for (let i = 0; i < 4; i++) {
        let x = 20 + rand() * 88;
        let y = 12 + rand() * 40;
        if (!inside(x, y)) {
          continue;
        }
        g.beginPath();
        g.moveTo(x, y);
        for (let s = 0; s < 3; s++) {
          x += (rand() - 0.5) * 22;
          y += (rand() - 0.5) * 12;
          g.lineTo(x, y);
        }
        g.strokePath();
      }
      for (let i = 0; i < 10; i++) {
        const x = 8 + rand() * 112;
        const y = 6 + rand() * 52;
        if (!inside(x, y)) {
          continue;
        }
        g.fillStyle(0xffffff, 0.18);
        g.fillCircle(x, y, 1 + rand());
      }
    }
    g.generateTexture(key, 128, 64);
  }

  private waterTile(key: string, seed: number, base: number, phase: number): void {
    const g = this.g;
    g.clear();
    g.fillStyle(base, 1);
    this.diamondPath({ cx: 64, cy: 32, w: 128, h: 64 });
    g.fillPath();
    g.fillStyle(0xbfe3ff, 0.16);
    this.diamondPath({ cx: 64, cy: 30, w: 108, h: 52 });
    g.fillPath();
    g.lineStyle(2, 0x2c5a8a, 0.6);
    this.diamondPath({ cx: 64, cy: 32, w: 126, h: 62 });
    g.strokePath();
    // Wave strokes.
    const rand = makeSpeckle(seed);
    g.lineStyle(2, 0xd6ecff, 0.5);
    for (let i = 0; i < 5; i++) {
      const y = 14 + i * 9 + phase * 4;
      const x = 30 + rand() * 40;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + 12, y - 4);
      g.lineTo(x + 24, y);
      g.strokePath();
    }
    g.generateTexture(key, 128, 64);
  }

  // -- objects -------------------------------------------------------------------

  private generateObjects(): void {
    this.treeRound('tree_01');
    this.treePine('tree_02');
    this.rock('rock_01');
    this.flower('flower_01', 0xe14b5a);
    this.flower('flower_02', 0xf2c230);
    this.flower('flower_03', 0xf5f2e8);
    this.bush('bush_01');
  }

  /** Round-canopy tree, 144x208, anchor bottom-center. */
  private treeRound(key: string): void {
    const g = this.g;
    g.clear();
    // Trunk.
    g.fillStyle(0x6b4a2e, 1);
    g.fillTriangle(66, 208, 78, 208, 75, 150);
    g.fillTriangle(66, 208, 75, 150, 69, 150);
    g.fillStyle(0x7d5a3a, 1);
    g.fillRect(70, 150, 6, 58);
    // Canopy: back / mid / front blobs.
    g.fillStyle(0x2c6b33, 1);
    g.fillEllipse(72, 108, 116, 108);
    g.fillEllipse(44, 128, 70, 62);
    g.fillEllipse(100, 128, 70, 62);
    g.fillStyle(0x3f8a45, 1);
    g.fillEllipse(72, 96, 96, 88);
    g.fillEllipse(50, 116, 58, 50);
    g.fillEllipse(94, 116, 58, 50);
    g.fillStyle(0x55a95c, 1);
    g.fillEllipse(62, 82, 58, 52);
    g.fillEllipse(86, 96, 52, 46);
    // Highlight + fruit dots.
    g.fillStyle(0x9fe0a3, 0.8);
    g.fillEllipse(56, 68, 24, 16);
    const rand = makeSpeckle(7);
    g.fillStyle(0xd94f4f, 1);
    for (let i = 0; i < 6; i++) {
      g.fillCircle(40 + rand() * 64, 70 + rand() * 60, 3);
    }
    g.generateTexture(key, 144, 208);
  }

  /** Pine tree, 144x208, anchor bottom-center. */
  private treePine(key: string): void {
    const g = this.g;
    g.clear();
    g.fillStyle(0x6b4a2e, 1);
    g.fillRect(66, 168, 12, 40);
    const layers: Array<[number, number, number]> = [
      [72, 8, 44],
      [72, 52, 58],
      [72, 100, 72],
      [72, 148, 84],
    ];
    for (const [cx, top, halfW] of layers) {
      g.fillStyle(0x2c6b33, 1);
      g.fillTriangle(cx - halfW, top + 56, cx + halfW, top + 56, cx, top);
      g.fillStyle(0x3f8a45, 1);
      g.fillTriangle(cx - halfW + 12, top + 56, cx + halfW - 6, top + 56, cx, top + 10);
    }
    // Snow-free highlight edge.
    g.lineStyle(3, 0x66c06c, 0.9);
    g.beginPath();
    g.moveTo(72, 8);
    g.lineTo(116, 156);
    g.strokePath();
    g.generateTexture(key, 144, 208);
  }

  /** Rock, 96x72, anchor bottom-center. */
  private rock(key: string): void {
    const g = this.g;
    g.clear();
    g.fillStyle(0x6f6f68, 1);
    g.fillEllipse(48, 62, 84, 22);
    g.fillStyle(0x8f8f88, 1);
    g.beginPath();
    g.moveTo(12, 62);
    g.lineTo(26, 30);
    g.lineTo(52, 14);
    g.lineTo(76, 30);
    g.lineTo(86, 62);
    g.closePath();
    g.fillPath();
    // Facets.
    g.fillStyle(0xa8a8a2, 1);
    g.beginPath();
    g.moveTo(26, 30);
    g.lineTo(52, 14);
    g.lineTo(48, 62);
    g.lineTo(22, 62);
    g.closePath();
    g.fillPath();
    g.fillStyle(0x7a7a74, 1);
    g.beginPath();
    g.moveTo(52, 14);
    g.lineTo(76, 30);
    g.lineTo(72, 62);
    g.lineTo(48, 62);
    g.closePath();
    g.fillPath();
    g.fillStyle(0xd8d8d2, 0.9);
    g.fillTriangle(30, 32, 46, 20, 40, 36);
    g.generateTexture(key, 96, 72);
  }

  /** Flower, 48x64, anchor bottom-center. */
  private flower(key: string, petal: number): void {
    const g = this.g;
    g.clear();
    g.lineStyle(3, 0x3f8a45, 1);
    g.beginPath();
    g.moveTo(24, 64);
    g.lineTo(24, 30);
    g.strokePath();
    g.fillStyle(0x4c9a52, 1);
    g.fillEllipse(17, 50, 14, 7);
    g.fillEllipse(31, 44, 14, 7);
    const cx = 24;
    const cy = 22;
    g.fillStyle(petal, 1);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      g.fillCircle(cx + Math.cos(a) * 8, cy + Math.sin(a) * 8, 6);
    }
    g.fillStyle(0xfff3b0, 1);
    g.fillCircle(cx, cy, 5);
    g.fillStyle(0xe09b2d, 1);
    g.fillCircle(cx, cy, 2.5);
    g.generateTexture(key, 48, 64);
  }

  /** Bush, 96x80, anchor bottom-center. */
  private bush(key: string): void {
    const g = this.g;
    g.clear();
    g.fillStyle(0x2c6b33, 1);
    g.fillEllipse(48, 56, 84, 48);
    g.fillEllipse(30, 48, 52, 38);
    g.fillEllipse(66, 48, 52, 38);
    g.fillStyle(0x3f8a45, 1);
    g.fillEllipse(48, 48, 68, 38);
    g.fillEllipse(34, 42, 40, 30);
    g.fillEllipse(62, 42, 40, 30);
    g.fillStyle(0x66c06c, 0.9);
    g.fillEllipse(40, 36, 26, 16);
    g.fillEllipse(58, 40, 20, 13);
    g.generateTexture(key, 96, 80);
  }

  // -- entities -------------------------------------------------------------------

  private generateEntities(): void {
    const g = this.g;
    g.clear();
    // Boots.
    g.fillStyle(0x4a3423, 1);
    g.fillRoundedRect(22, 82, 9, 14, 3);
    g.fillRoundedRect(33, 82, 9, 14, 3);
    // Body: blue tunic.
    g.fillStyle(0x3b6fd4, 1);
    g.fillRoundedRect(18, 48, 28, 36, 8);
    g.fillStyle(0x2f58ad, 1);
    g.fillRoundedRect(18, 70, 28, 14, { tl: 0, tr: 0, bl: 8, br: 8 });
    // Belt.
    g.fillStyle(0x6b4a2e, 1);
    g.fillRect(18, 66, 28, 5);
    g.fillStyle(0xf2c230, 1);
    g.fillRect(29, 66, 6, 5);
    // Arms.
    g.fillStyle(0x3b6fd4, 1);
    g.fillRoundedRect(10, 52, 9, 24, 4);
    g.fillRoundedRect(45, 52, 9, 24, 4);
    g.fillStyle(0xf0c39a, 1);
    g.fillCircle(14, 78, 5);
    g.fillCircle(50, 78, 5);
    // Head.
    g.fillStyle(0xf0c39a, 1);
    g.fillCircle(32, 36, 13);
    // Eyes (facing viewer = facing south).
    g.fillStyle(0x22303c, 1);
    g.fillCircle(27, 36, 2.2);
    g.fillCircle(37, 36, 2.2);
    // Smile.
    g.lineStyle(2, 0x8a5a44, 1);
    g.beginPath();
    g.moveTo(28, 42);
    g.lineTo(36, 42);
    g.strokePath();
    // Straw hat.
    g.fillStyle(0xe3b64f, 1);
    g.fillEllipse(32, 27, 52, 14);
    g.fillStyle(0xd6a83f, 1);
    g.fillEllipse(32, 22, 30, 16);
    g.fillStyle(0xb03a3a, 1);
    g.fillRect(17, 24, 30, 4);
    g.generateTexture('player_placeholder', 64, 96);
  }

  // -- fx / ui -------------------------------------------------------------------

  private generateFx(): void {
    const g = this.g;
    // Soft ground shadow.
    g.clear();
    g.fillStyle(0x0a140c, 1);
    g.fillEllipse(32, 12, 60, 20);
    g.generateTexture('shadow_blob', 64, 24);

    // Hover highlight: white diamond outline + faint fill.
    g.clear();
    g.fillStyle(0xffffff, 0.14);
    this.diamondPath({ cx: 64, cy: 32, w: 126, h: 62 });
    g.fillPath();
    g.lineStyle(3, 0xffffff, 0.95);
    this.diamondPath({ cx: 64, cy: 32, w: 124, h: 60 });
    g.strokePath();
    g.generateTexture('tile_hover', 128, 64);

    // Selection highlight: warm yellow diamond.
    g.clear();
    g.fillStyle(0xffe066, 0.18);
    this.diamondPath({ cx: 64, cy: 32, w: 126, h: 62 });
    g.fillPath();
    g.lineStyle(4, 0xffd23f, 1);
    this.diamondPath({ cx: 64, cy: 32, w: 122, h: 58 });
    g.strokePath();
    g.generateTexture('tile_selected', 128, 64);
  }

  private verifyAll(): void {
    for (const key of ASSET_KEYS) {
      if (!this.scene.textures.exists(key)) {
        Logger.error('Assets', `ASSET_LOAD_ERROR: texture "${key}" was not generated`);
      }
    }
    this.g.destroy();
  }
}
