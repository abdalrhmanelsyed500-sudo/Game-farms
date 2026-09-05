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
    factory.generateFarming();
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

  // -- farming (Phase 2) ---------------------------------------------------------------

  private generateFarming(): void {
    this.soilTile('soil_tilled', 201, 0x6e4a2c, false);
    this.soilTile('soil_watered', 202, 0x4e3320, true);
    this.validityTile('tile_valid', 0x39d353, true);
    this.validityTile('tile_invalid', 0xe5484d, false);

    const g = this.g;
    g.clear();
    g.fillStyle(0xffffff, 0.35);
    g.fillCircle(8, 8, 7);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(8, 8, 4.5);
    g.generateTexture('fx_dot', 16, 16);

    this.wheatStage(1);
    this.wheatStage(2);
    this.wheatStage(3);
    this.wheatStage(4);
    this.cornStage(1);
    this.cornStage(2);
    this.cornStage(3);
    this.cornStage(4);
    this.tomatoStage(1);
    this.tomatoStage(2);
    this.tomatoStage(3);
    this.tomatoStage(4);
    this.farmhouse('farmhouse_01');
  }

  /** Tilled-soil diamond overlay: dark soil + furrow rows. Watered = darker + sheen. */
  private soilTile(key: string, seed: number, base: number, watered: boolean): void {
    const g = this.g;
    g.clear();
    g.fillStyle(base, 1);
    this.diamondPath({ cx: 64, cy: 32, w: 120, h: 58 });
    g.fillPath();
    // Furrows: diagonal ridges across the diamond.
    g.lineStyle(3, watered ? 0x2e1f12 : 0x54371f, 0.9);
    for (let i = 0; i < 5; i++) {
      const y = 14 + i * 9;
      g.beginPath();
      g.moveTo(28, y);
      g.lineTo(100, y - 12);
      g.strokePath();
    }
    g.lineStyle(1.5, watered ? 0x6b4c30 : 0x8a5f3a, 0.9);
    for (let i = 0; i < 5; i++) {
      const y = 16 + i * 9;
      g.beginPath();
      g.moveTo(28, y);
      g.lineTo(100, y - 12);
      g.strokePath();
    }
    if (watered) {
      g.fillStyle(0x4f9fe8, 0.22);
      this.diamondPath({ cx: 64, cy: 32, w: 120, h: 58 });
      g.fillPath();
      g.lineStyle(2, 0x9fd4ff, 0.7);
      g.beginPath();
      g.moveTo(40, 34);
      g.lineTo(56, 28);
      g.moveTo(66, 38);
      g.lineTo(82, 32);
      g.strokePath();
    }
    // Clod speckles (deterministic).
    const rand = makeSpeckle(seed);
    for (let i = 0; i < 12; i++) {
      const x = 20 + rand() * 88;
      const y = 10 + rand() * 44;
      if (Math.abs(x - 64) / 54 + Math.abs(y - 32) / 25 > 1) {
        continue;
      }
      g.fillStyle(watered ? 0x3a2716 : 0x9a6f45, 0.8);
      g.fillEllipse(x, y, 4 + rand() * 4, 2 + rand() * 2);
    }
    g.lineStyle(2, watered ? 0x2c5a8a : 0x3f2812, 0.7);
    this.diamondPath({ cx: 64, cy: 32, w: 120, h: 58 });
    g.strokePath();
    g.generateTexture(key, 128, 64);
  }

  /**
   * Validity highlight: colored diamond + glyph (check vs cross) so meaning
   * never relies on color alone.
   */
  private validityTile(key: string, color: number, valid: boolean): void {
    const g = this.g;
    g.clear();
    g.fillStyle(color, 0.2);
    this.diamondPath({ cx: 64, cy: 32, w: 126, h: 62 });
    g.fillPath();
    g.lineStyle(3, color, 0.95);
    this.diamondPath({ cx: 64, cy: 32, w: 124, h: 60 });
    g.strokePath();
    g.lineStyle(5, 0xffffff, 0.95);
    g.beginPath();
    if (valid) {
      g.moveTo(52, 33);
      g.lineTo(61, 42);
      g.lineTo(78, 22);
    } else {
      g.moveTo(54, 22);
      g.lineTo(74, 42);
      g.moveTo(74, 22);
      g.lineTo(54, 42);
    }
    g.strokePath();
    g.generateTexture(key, 128, 64);
  }

  // -- wheat (48x64): sprouts -> tuft -> pale heads -> golden ------------------------

  private wheatStage(stage: number): void {
    const g = this.g;
    g.clear();
    const key = `crop_wheat_stage_${String(stage).padStart(2, '0')}`;
    if (stage === 1) {
      g.lineStyle(3, 0x55a95c, 1);
      for (const [x, lean] of [[18, -4], [26, 1], [33, 5]] as const) {
        g.beginPath();
        g.moveTo(x, 64);
        g.lineTo(x + lean, 44);
        g.strokePath();
      }
    } else if (stage === 2) {
      g.fillStyle(0x3f8a45, 1);
      g.fillEllipse(24, 52, 34, 26);
      g.fillStyle(0x55a95c, 1);
      g.fillEllipse(24, 46, 28, 22);
      g.lineStyle(2, 0x2c6b33, 1);
      for (let i = 0; i < 5; i++) {
        g.beginPath();
        g.moveTo(12 + i * 6, 52);
        g.lineTo(12 + i * 6, 34);
        g.strokePath();
      }
    } else {
      const ripe = stage === 4;
      const stalk = ripe ? 0xd8a83f : 0x6aa84f;
      const head = ripe ? 0xf2c230 : 0xb9d97a;
      for (let i = 0; i < 5; i++) {
        const x = 10 + i * 7;
        const top = 26 - (i % 2) * 4;
        g.lineStyle(2.5, stalk, 1);
        g.beginPath();
        g.moveTo(x, 64);
        g.lineTo(x, top);
        g.strokePath();
        g.fillStyle(head, 1);
        g.fillEllipse(x, top - 4, 7, 13);
        g.lineStyle(1, ripe ? 0xa87c1f : 0x7a9a4a, 1);
        g.beginPath();
        g.moveTo(x - 4, top - 8);
        g.lineTo(x - 7, top - 13);
        g.moveTo(x + 4, top - 8);
        g.lineTo(x + 7, top - 13);
        g.strokePath();
      }
    }
    g.generateTexture(key, 48, 64);
  }

  // -- corn (56x96): sprout -> leafy -> ears -> tasseled ------------------------------

  private cornStage(stage: number): void {
    const g = this.g;
    g.clear();
    const key = `crop_corn_stage_${String(stage).padStart(2, '0')}`;
    if (stage === 1) {
      g.lineStyle(4, 0x55a95c, 1);
      g.beginPath();
      g.moveTo(28, 96);
      g.lineTo(28, 70);
      g.strokePath();
      g.fillStyle(0x66c06c, 1);
      g.fillEllipse(21, 72, 16, 8);
      g.fillEllipse(35, 72, 16, 8);
    } else if (stage === 2) {
      g.lineStyle(6, 0x3f8a45, 1);
      g.beginPath();
      g.moveTo(28, 96);
      g.lineTo(28, 44);
      g.strokePath();
      g.fillStyle(0x4c9a52, 1);
      g.fillEllipse(16, 66, 24, 12);
      g.fillEllipse(40, 66, 24, 12);
      g.fillEllipse(20, 52, 22, 11);
      g.fillEllipse(36, 52, 22, 11);
    } else {
      const ripe = stage === 4;
      g.lineStyle(7, ripe ? 0x4c8a45 : 0x3f8a45, 1);
      g.beginPath();
      g.moveTo(28, 96);
      g.lineTo(28, 16);
      g.strokePath();
      g.fillStyle(0x4c9a52, 1);
      g.fillEllipse(14, 74, 26, 13);
      g.fillEllipse(42, 74, 26, 13);
      g.fillEllipse(16, 56, 24, 12);
      g.fillEllipse(40, 56, 24, 12);
      // Ears.
      g.fillStyle(ripe ? 0xf2c230 : 0x7ab648, 1);
      g.fillRoundedRect(31, 54, 10, 22, 4);
      g.fillRoundedRect(15, 64, 10, 20, 4);
      g.fillStyle(0x8fd47a, 1);
      g.fillTriangle(31, 54, 41, 54, 36, 44);
      g.fillTriangle(15, 64, 25, 64, 20, 55);
      if (ripe) {
        g.fillStyle(0xd8b25a, 1);
        g.fillEllipse(28, 12, 20, 12);
      } else {
        g.fillStyle(0x66c06c, 1);
        g.fillEllipse(28, 14, 16, 10);
      }
    }
    g.generateTexture(key, 56, 96);
  }

  // -- tomato (56x64): sprout -> bush -> flowers -> red fruit -------------------------

  private tomatoStage(stage: number): void {
    const g = this.g;
    g.clear();
    const key = `crop_tomato_stage_${String(stage).padStart(2, '0')}`;
    if (stage === 1) {
      g.lineStyle(3, 0x55a95c, 1);
      g.beginPath();
      g.moveTo(28, 64);
      g.lineTo(28, 42);
      g.strokePath();
      g.fillStyle(0x66c06c, 1);
      g.fillEllipse(22, 44, 14, 8);
      g.fillEllipse(34, 44, 14, 8);
    } else {
      g.fillStyle(0x2c6b33, 1);
      g.fillEllipse(28, 48, 50, 34);
      g.fillStyle(0x3f8a45, 1);
      g.fillEllipse(28, 42, 42, 28);
      g.fillStyle(0x55a95c, 1);
      g.fillEllipse(22, 36, 24, 16);
      if (stage === 3) {
        g.fillStyle(0xf2e230, 1);
        for (const [x, y] of [[18, 40], [30, 34], [38, 44]] as const) {
          g.fillCircle(x, y, 3);
        }
      } else if (stage === 4) {
        g.fillStyle(0xd63b2f, 1);
        for (const [x, y] of [[16, 44], [26, 38], [36, 46], [30, 52]] as const) {
          g.fillCircle(x, y, 5);
        }
        g.fillStyle(0xff8a7a, 1);
        g.fillCircle(24, 36, 1.8);
        g.fillCircle(34, 44, 1.8);
      }
    }
    g.generateTexture(key, 56, 64);
  }

  // -- farmhouse placeholder (216x208, bottom-center anchor) --------------------------

  private farmhouse(key: string): void {
    const g = this.g;
    g.clear();
    // Stone foundation.
    g.fillStyle(0x8f8f88, 1);
    g.fillRect(28, 178, 160, 30);
    g.fillStyle(0x6f6f68, 1);
    for (let i = 0; i < 6; i++) {
      g.fillRect(32 + i * 26, 186, 14, 4);
    }
    // Timber walls.
    g.fillStyle(0xb98a56, 1);
    g.fillRect(36, 108, 144, 74);
    g.fillStyle(0x9a6f42, 1);
    for (let x = 52; x < 180; x += 16) {
      g.fillRect(x, 108, 4, 74);
    }
    // Big pitched roof.
    g.fillStyle(0x8a4a34, 1);
    g.fillTriangle(14, 112, 202, 112, 108, 30);
    g.fillStyle(0xa85f42, 1);
    g.fillTriangle(108, 30, 202, 112, 108, 112);
    g.fillStyle(0x6e3826, 1);
    g.fillTriangle(14, 112, 40, 112, 108, 40);
    // Roof ridge + eaves shadow.
    g.lineStyle(5, 0x5c2f20, 1);
    g.beginPath();
    g.moveTo(108, 30);
    g.lineTo(108, 34);
    g.strokePath();
    g.fillStyle(0x5c2f20, 1);
    g.fillRect(14, 108, 188, 8);
    // Chimney with (static) smoke hint.
    g.fillStyle(0x7a7a74, 1);
    g.fillRect(142, 44, 20, 52);
    g.fillStyle(0x5c5c58, 1);
    g.fillRect(142, 44, 20, 8);
    g.fillStyle(0xd8d8d2, 0.5);
    g.fillCircle(152, 30, 7);
    g.fillCircle(156, 20, 9);
    // Door.
    g.fillStyle(0x5c3a22, 1);
    g.fillRoundedRect(94, 138, 28, 44, 4);
    g.fillStyle(0xf2c230, 1);
    g.fillCircle(116, 162, 2.5);
    // Windows with warm light.
    for (const wx of [52, 142] as const) {
      g.fillStyle(0x5c3a22, 1);
      g.fillRect(wx - 3, 133, 30, 30);
      g.fillStyle(0xffd76a, 1);
      g.fillRect(wx, 136, 24, 24);
      g.lineStyle(2, 0x5c3a22, 1);
      g.beginPath();
      g.moveTo(wx + 12, 136);
      g.lineTo(wx + 12, 160);
      g.moveTo(wx, 148);
      g.lineTo(wx + 24, 148);
      g.strokePath();
    }
    // Hay bale by the wall.
    g.fillStyle(0xd8b25a, 1);
    g.fillCircle(190, 190, 13);
    g.lineStyle(2, 0xa87c1f, 1);
    g.beginPath();
    g.moveTo(178, 190);
    g.lineTo(202, 190);
    g.strokePath();
    g.generateTexture(key, 216, 208);
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
