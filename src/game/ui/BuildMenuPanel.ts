import Phaser from 'phaser';
import type { BuildingRotation } from '../../shared/types/buildings.js';
import { TypedEventEmitter } from '../../shared/utils/EventEmitter.js';
import { getBuildingDefinitions } from '../buildings/BuildingCatalog.js';
import { requireItemDefinition } from '../items/ItemCatalog.js';
import type { InventorySystem } from '../items/InventorySystem.js';
import { RenderLayer } from '../rendering/RenderLayers.js';

export interface BuildMenuEvents {
  /** A building entry was clicked. WorldScene arms the ghost for it. */
  'building-picked': { buildingId: string };
}

const PANEL_WIDTH = 260;
const ENTRY_GAP = 8;
const PADDING = 12;

/**
 * BuildMenuPanel: building chooser for build mode (Phase 3).
 *
 * Right-side, screen-fixed, Ui+5 depth, hidden by default. Lists every
 * catalog building with footprint + live cost affordability (green/red per
 * resource line) — catalog-driven, so new buildings appear with zero UI
 * changes. Number keys 1–3 pick entries (routed by the toolbar in build
 * mode); R rotates the ghost.
 */
export class BuildMenuPanel {
  public readonly events = new TypedEventEmitter<BuildMenuEvents>();

  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private readonly panel: Phaser.GameObjects.Rectangle;
  private readonly entryFrames = new Map<string, Phaser.GameObjects.Rectangle>();
  private readonly costTexts = new Map<string, Phaser.GameObjects.Text[]>();
  private readonly rotationText: Phaser.GameObjects.Text;
  private panelRect = { x: 0, y: 0, width: 0, height: 0 };

  public constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0);
    this.container.setScrollFactor(0);
    this.container.setDepth(RenderLayer.Ui + 5);
    this.container.setVisible(false);

    const defs = getBuildingDefinitions();
    // Title + hint rows + entries (name + footprint + up to 2 cost lines).
    const entryHeight = 76;
    const height =
      PADDING * 2 + 24 + 20 + defs.length * (entryHeight + ENTRY_GAP) - ENTRY_GAP + 24;
    this.panel = scene.add.rectangle(0, 0, PANEL_WIDTH, height, 0x0c140e, 0.92);
    this.panel.setStrokeStyle(2, 0xb06a2a, 1);
    this.container.add(this.panel);

    const title = scene.add
      .text(0, -height / 2 + PADDING + 8, 'BUILD  [4/Esc: exit]', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#ffc98a',
      })
      .setOrigin(0.5);
    this.container.add(title);

    let cursorY = -height / 2 + PADDING + 24 + 20 + entryHeight / 2;
    defs.forEach((def, index) => {
      this.buildEntry(def.id, def.name, def.width, def.height, index, cursorY);
      cursorY += entryHeight + ENTRY_GAP;
    });

    this.rotationText = scene.add
      .text(0, height / 2 - PADDING - 8, 'rotation: 0°  [R]', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#9adc9a',
      })
      .setOrigin(0.5);
    this.container.add(this.rotationText);
  }

  public get visible(): boolean {
    return this.container.visible;
  }

  /** Anchor right-center. */
  public layout(viewportWidth: number, viewportHeight: number): void {
    const cx = viewportWidth - PANEL_WIDTH / 2 - 12;
    const cy = viewportHeight / 2 - 40;
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

  /** Refresh selection highlight, affordability colors, and rotation label. */
  public refresh(
    inventory: Pick<InventorySystem, 'getQuantity'>,
    selectedId: string | null,
    rotation: BuildingRotation,
  ): void {
    for (const [buildingId, frame] of this.entryFrames) {
      frame.setVisible(buildingId === selectedId);
    }
    for (const def of getBuildingDefinitions()) {
      const texts = this.costTexts.get(def.id) ?? [];
      def.cost.forEach((line, i) => {
        const text = texts[i];
        if (!text) {
          return;
        }
        const have = inventory.getQuantity(line.itemId);
        const ok = have >= line.quantity;
        text.setColor(ok ? '#9adc9a' : '#ff7a6a');
        text.setText(`${this.shortItemName(line.itemId)} ${have}/${line.quantity}`);
      });
    }
    this.rotationText.setText(`rotation: ${rotation}°  [R]`);
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

  private shortItemName(itemId: string): string {
    try {
      return requireItemDefinition(itemId).name;
    } catch {
      return itemId;
    }
  }

  private buildEntry(
    buildingId: string,
    name: string,
    width: number,
    height: number,
    index: number,
    y: number,
  ): void {
    const entryWidth = PANEL_WIDTH - PADDING * 2;
    const bg = this.scene.add.rectangle(0, y, entryWidth, 76, 0x1d2b1f, 1);
    bg.setStrokeStyle(1, 0x3f6b3a, 1);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerdown', () => this.events.emit('building-picked', { buildingId }));
    bg.on('pointerover', () => bg.setStrokeStyle(2, 0x9fe0a3, 1));
    bg.on('pointerout', () => bg.setStrokeStyle(1, 0x3f6b3a, 1));

    const frame = this.scene.add.rectangle(0, y, entryWidth + 4, 80);
    frame.setStrokeStyle(3, 0xffe066, 1);
    frame.setFillStyle(0x000000, 0);
    frame.setVisible(false);
    this.entryFrames.set(buildingId, frame);

    const title = this.scene.add
      .text(-entryWidth / 2 + 10, y - 24, `[${index + 1}] ${name.toUpperCase()}`, {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#e8f0e8',
      })
      .setOrigin(0, 0.5);
    const footprint = this.scene.add
      .text(entryWidth / 2 - 10, y - 24, `${width}×${height}`, {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#9adc9a',
      })
      .setOrigin(1, 0.5);
    this.container.add([bg, frame, title, footprint]);

    const def = getBuildingDefinitions().find((d) => d.id === buildingId);
    const texts: Phaser.GameObjects.Text[] = [];
    (def?.cost ?? []).forEach((line, i) => {
      const text = this.scene.add
        .text(-entryWidth / 2 + 10, y - 2 + i * 18, `${this.shortItemName(line.itemId)} …`, {
          fontFamily: 'monospace',
          fontSize: '11px',
          color: '#9adc9a',
        })
        .setOrigin(0, 0.5);
      texts.push(text);
      this.container.add(text);
    });
    this.costTexts.set(buildingId, texts);
  }
}
