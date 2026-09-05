import Phaser from 'phaser';
import { TOOLBAR_HEIGHT_PX } from '../../shared/constants/config.js';
import { TypedEventEmitter } from '../../shared/utils/EventEmitter.js';
import { CROP_IDS, getCropDefinition } from '../farming/CropDefinitions.js';
import { seedItemIdForCrop } from '../farming/FarmingSystem.js';
import { requireItemDefinition } from '../items/ItemCatalog.js';
import { RenderLayer } from '../rendering/RenderLayers.js';

export interface SeedPickerEvents {
  /** A crop button was clicked. WorldScene equips the seed tool for it. */
  'seed-picked': { cropId: string };
}

const ROW_WIDTH = 220;
const ROW_HEIGHT = 40;
const ROW_GAP = 6;
const PADDING = 10;

/**
 * SeedPickerPopup: crop chooser above the toolbar (Phase 3).
 *
 * Screen-fixed, Ui+5 depth, hidden by default. Lists every catalog crop with
 * its icon and live seed count — the catalog is the crop list, so new crops
 * appear here with zero UI changes.
 */
export class SeedPickerPopup {
  public readonly events = new TypedEventEmitter<SeedPickerEvents>();

  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private readonly panel: Phaser.GameObjects.Rectangle;
  private readonly countTexts = new Map<string, Phaser.GameObjects.Text>();
  private readonly counts = new Map<string, number>();
  private panelRect = { x: 0, y: 0, width: 0, height: 0 };

  public constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0);
    this.container.setScrollFactor(0);
    this.container.setDepth(RenderLayer.Ui + 5);
    this.container.setVisible(false);

    const height = CROP_IDS.length * (ROW_HEIGHT + ROW_GAP) - ROW_GAP + PADDING * 2 + 22;
    this.panel = scene.add.rectangle(0, 0, ROW_WIDTH + PADDING * 2, height, 0x0c140e, 0.92);
    this.panel.setStrokeStyle(2, 0xd8a83f, 1);
    this.container.add(this.panel);

    const title = scene.add
      .text(0, -height / 2 + PADDING + 8, 'SEEDS', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#ffe9a3',
      })
      .setOrigin(0.5);
    this.container.add(title);

    let cursorY = -height / 2 + PADDING + 22 + ROW_HEIGHT / 2;
    for (const cropId of CROP_IDS) {
      this.buildRow(cropId, cursorY);
      cursorY += ROW_HEIGHT + ROW_GAP;
    }
  }

  public get visible(): boolean {
    return this.container.visible;
  }

  /** Anchor above the toolbar (bottom-center). */
  public layout(viewportWidth: number, viewportHeight: number): void {
    const cx = viewportWidth / 2;
    const cy = viewportHeight - TOOLBAR_HEIGHT_PX - 12 - this.panel.height / 2 - 8;
    this.container.setPosition(cx, cy);
    this.panelRect = {
      x: cx - this.panel.width / 2,
      y: cy - this.panel.height / 2,
      width: this.panel.width,
      height: this.panel.height,
    };
  }

  public containsScreenPoint(screenX: number, screenY: number): boolean {
    if (!this.container.visible) {
      return false;
    }
    const r = this.panelRect;
    return screenX >= r.x && screenX <= r.x + r.width && screenY >= r.y && screenY <= r.y + r.height;
  }

  /** Refresh live seed counts (crop id → remaining seeds). */
  public setCounts(counts: ReadonlyMap<string, number>): void {
    for (const [cropId, count] of counts) {
      this.counts.set(cropId, count);
      this.countTexts.get(cropId)?.setText(`x${count}`);
    }
  }

  public show(): void {
    this.container.setVisible(true);
  }

  public hide(): void {
    this.container.setVisible(false);
  }

  public toggle(): void {
    this.container.setVisible(!this.container.visible);
  }

  public destroy(): void {
    this.events.removeAllListeners();
    this.container.destroy(true);
  }

  private buildRow(cropId: string, y: number): void {
    const def = getCropDefinition(cropId);
    const name = (def?.name ?? cropId).toUpperCase();
    const bg = this.scene.add.rectangle(0, y, ROW_WIDTH, ROW_HEIGHT, 0x1d2b1f, 1);
    bg.setStrokeStyle(1, 0x3f6b3a, 1);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerdown', () => this.events.emit('seed-picked', { cropId }));
    bg.on('pointerover', () => bg.setStrokeStyle(2, 0x9fe0a3, 1));
    bg.on('pointerout', () => bg.setStrokeStyle(1, 0x3f6b3a, 1));

    let iconKey = 'fx_dot';
    if (def) {
      try {
        iconKey = requireItemDefinition(seedItemIdForCrop(def)).iconKey;
      } catch {
        iconKey = 'fx_dot';
      }
    }
    const icon = this.scene.add.image(-ROW_WIDTH / 2 + 24, y, iconKey);
    icon.setDisplaySize(28, 28);
    const label = this.scene.add
      .text(-ROW_WIDTH / 2 + 44, y, name, {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#e8f0e8',
      })
      .setOrigin(0, 0.5);
    const count = this.scene.add
      .text(ROW_WIDTH / 2 - 12, y, `x${this.counts.get(cropId) ?? 0}`, {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#ffe9a3',
      })
      .setOrigin(1, 0.5);
    this.countTexts.set(cropId, count);
    this.container.add([bg, icon, label, count]);
  }
}
