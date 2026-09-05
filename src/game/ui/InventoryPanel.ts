import Phaser from 'phaser';
import { requireItemDefinition } from '../items/ItemCatalog.js';
import type { InventorySystem } from '../items/InventorySystem.js';
import { RenderLayer } from '../rendering/RenderLayers.js';

const COLUMNS = 6;
const SLOT_PX = 64;
const SLOT_GAP = 8;
const PADDING = 14;

/**
 * InventoryPanel: read-only inventory grid (Phase 3).
 *
 * Centered, screen-fixed, Ui+10 depth, hidden by default. Shows every slot
 * (icon + name + quantity) straight from the InventorySystem — no drag/drop,
 * no use-from-panel (out of scope); seeds are spent by planting, resources
 * by building. I or Esc closes.
 */
export class InventoryPanel {
  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private readonly panel: Phaser.GameObjects.Rectangle;
  private readonly slotIcons: Phaser.GameObjects.Image[] = [];
  private readonly slotCounts: Phaser.GameObjects.Text[] = [];
  private readonly slotNames: Phaser.GameObjects.Text[] = [];
  private readonly title: Phaser.GameObjects.Text;
  private readonly rows: number;
  private panelRect = { x: 0, y: 0, width: 0, height: 0 };

  public constructor(scene: Phaser.Scene, capacity: number) {
    this.scene = scene;
    this.rows = Math.max(1, Math.ceil(capacity / COLUMNS));
    this.container = scene.add.container(0, 0);
    this.container.setScrollFactor(0);
    this.container.setDepth(RenderLayer.Ui + 10);
    this.container.setVisible(false);

    const gridWidth = COLUMNS * SLOT_PX + (COLUMNS - 1) * SLOT_GAP;
    const gridHeight = this.rows * SLOT_PX + (this.rows - 1) * SLOT_GAP;
    const width = gridWidth + PADDING * 2;
    const height = gridHeight + PADDING * 2 + 30 + 22;
    this.panel = scene.add.rectangle(0, 0, width, height, 0x0c140e, 0.94);
    this.panel.setStrokeStyle(2, 0x6a7a9a, 1);
    this.container.add(this.panel);

    this.title = scene.add
      .text(0, -height / 2 + PADDING + 8, `INVENTORY  [I/Esc: close]`, {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#cfd8ea',
      })
      .setOrigin(0.5);
    this.container.add(this.title);

    const startX = -gridWidth / 2 + SLOT_PX / 2;
    const startY = -height / 2 + PADDING + 30 + SLOT_PX / 2;
    for (let i = 0; i < COLUMNS * this.rows; i++) {
      const col = i % COLUMNS;
      const row = Math.floor(i / COLUMNS);
      this.buildSlot(startX + col * (SLOT_PX + SLOT_GAP), startY + row * (SLOT_PX + SLOT_GAP));
    }
  }

  public get visible(): boolean {
    return this.container.visible;
  }

  /** Center on screen. */
  public layout(viewportWidth: number, viewportHeight: number): void {
    const cx = viewportWidth / 2;
    const cy = viewportHeight / 2;
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

  /** Re-render every slot from the live inventory. */
  public refresh(inventory: InventorySystem): void {
    const slots = inventory.getSlots();
    for (let i = 0; i < this.slotIcons.length; i++) {
      const slot = slots[i] ?? null;
      const icon = this.slotIcons[i];
      const count = this.slotCounts[i];
      const name = this.slotNames[i];
      if (!icon || !count || !name) {
        continue;
      }
      if (!slot) {
        icon.setTexture('fx_dot').setAlpha(0.15);
        count.setText('');
        name.setText('—');
        continue;
      }
      let iconKey = 'fx_dot';
      let itemName = slot.itemId;
      try {
        const def = requireItemDefinition(slot.itemId);
        iconKey = def.iconKey;
        itemName = def.name;
      } catch {
        // Unknown item ids render as a dot; catalog throws are logged there.
      }
      icon.setTexture(iconKey).setAlpha(1);
      count.setText(`x${slot.quantity}`);
      name.setText(itemName.length > 10 ? `${itemName.slice(0, 9)}…` : itemName);
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
    this.container.destroy(true);
  }

  private buildSlot(x: number, y: number): void {
    const bg = this.scene.add.rectangle(x, y, SLOT_PX, SLOT_PX, 0x1d2b1f, 1);
    bg.setStrokeStyle(1, 0x3f6b3a, 1);
    const icon = this.scene.add.image(x, y - 8, 'fx_dot');
    icon.setDisplaySize(30, 30);
    icon.setAlpha(0.15);
    const count = this.scene.add
      .text(x + SLOT_PX / 2 - 4, y - SLOT_PX / 2 + 4, '', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#ffe9a3',
      })
      .setOrigin(1, 0);
    const name = this.scene.add
      .text(x, y + SLOT_PX / 2 - 4, '—', {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: '#9adc9a',
      })
      .setOrigin(0.5, 1);
    this.slotIcons.push(icon);
    this.slotCounts.push(count);
    this.slotNames.push(name);
    this.container.add([bg, icon, count, name]);
  }
}
