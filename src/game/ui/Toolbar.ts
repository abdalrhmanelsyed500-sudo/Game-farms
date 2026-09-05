import Phaser from 'phaser';
import { TOOLBAR_HEIGHT_PX, TOOLBAR_SLOT_PX } from '../../shared/constants/config.js';
import { ToolType } from '../../shared/types/farming.js';
import { TypedEventEmitter } from '../../shared/utils/EventEmitter.js';
import { RenderLayer } from '../rendering/RenderLayers.js';

/** Toolbar selection (tool + optional seed crop id). */
export interface ToolbarSelection {
  readonly tool: ToolType;
  readonly seedId: string | null;
}

export interface ToolbarEvents {
  'tool-selected': ToolbarSelection;
}

interface SlotDef {
  readonly id: string;
  readonly label: string;
  readonly hint: string;
  readonly tool: ToolType;
  readonly seedId: string | null;
  readonly tint: number;
}

const SLOTS: readonly SlotDef[] = [
  { id: 'hoe', label: 'HOE', hint: '1', tool: ToolType.Hoe, seedId: null, tint: 0x8a5a33 },
  { id: 'seed:wheat', label: 'WHEAT', hint: '2', tool: ToolType.Seed, seedId: 'wheat', tint: 0xd8a83f },
  { id: 'seed:corn', label: 'CORN', hint: '3', tool: ToolType.Seed, seedId: 'corn', tint: 0x7ab648 },
  { id: 'seed:tomato', label: 'TOMATO', hint: '4', tool: ToolType.Seed, seedId: 'tomato', tint: 0xd63b2f },
  { id: 'water', label: 'WATER', hint: '5', tool: ToolType.WateringCan, seedId: null, tint: 0x3d7fc2 },
  { id: 'hand', label: 'HAND', hint: '6', tool: ToolType.Hand, seedId: null, tint: 0x9a9a92 },
];

const SLOT_GAP = 8;
const BAR_PADDING = 10;

/**
 * Toolbar: minimal Phase 2 tool UI (temporary; the final inventory/tool
 * system replaces it later).
 *
 * - Pure Phaser UI, screen-fixed (scrollFactor 0), Ui depth band.
 * - Owns its hotkeys (1–6, Esc) — UI-level shortcuts, not world actions.
 * - Emits normalized selections; WorldScene applies them to the player.
 * - Exposes screen bounds so world tap-to-select can ignore taps on the bar
 *   (touch and mouse share the same path — no mobile-specific logic).
 */
export class Toolbar {
  public readonly events = new TypedEventEmitter<ToolbarEvents>();

  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private readonly bar: Phaser.GameObjects.Rectangle;
  private readonly slotViews = new Map<string, {
    bg: Phaser.GameObjects.Rectangle;
    frame: Phaser.GameObjects.Rectangle;
    count: Phaser.GameObjects.Text | null;
    def: SlotDef;
  }>();
  private selectedId: string | null = null;
  private barRect = { x: 0, y: 0, width: 0, height: 0 };

  public constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0);
    this.container.setScrollFactor(0);
    this.container.setDepth(RenderLayer.Ui);

    const barWidth = SLOTS.length * TOOLBAR_SLOT_PX + (SLOTS.length - 1) * SLOT_GAP + BAR_PADDING * 2;
    this.bar = scene.add.rectangle(0, 0, barWidth, TOOLBAR_HEIGHT_PX, 0x0c140e, 0.85);
    this.bar.setStrokeStyle(2, 0x3f6b3a, 1);
    this.container.add(this.bar);

    let cursorX = -barWidth / 2 + BAR_PADDING + TOOLBAR_SLOT_PX / 2;
    for (const def of SLOTS) {
      this.buildSlot(def, cursorX);
      cursorX += TOOLBAR_SLOT_PX + SLOT_GAP;
    }

    this.bindHotkeys();
  }

  /** Reposition on create/resize (anchored bottom-center). */
  public layout(viewportWidth: number, viewportHeight: number): void {
    const cx = viewportWidth / 2;
    const cy = viewportHeight - TOOLBAR_HEIGHT_PX / 2 - 12;
    this.container.setPosition(cx, cy);
    this.barRect = {
      x: cx - this.bar.width / 2,
      y: cy - this.bar.height / 2,
      width: this.bar.width,
      height: this.bar.height,
    };
  }

  /** Current bar bounds in screen px (layout/tests/debug). */
  public getBarRect(): { x: number; y: number; width: number; height: number } {
    return { ...this.barRect };
  }

  /** True when a screen point lands on the bar (caller should ignore the tap). */
  public containsScreenPoint(screenX: number, screenY: number): boolean {
    const r = this.barRect;
    return screenX >= r.x && screenX <= r.x + r.width && screenY >= r.y && screenY <= r.y + r.height;
  }

  /** Reflect external selection state (e.g. initial none). */
  public setSelected(tool: ToolType, seedId: string | null): void {
    const id = SLOTS.find((s) => s.tool === tool && s.seedId === seedId)?.id ?? null;
    this.selectedId = id;
    for (const [slotId, view] of this.slotViews) {
      const active = slotId === id;
      view.frame.setVisible(active);
      view.bg.setAlpha(active ? 1 : 0.75);
    }
  }

  /** Refresh a seed count label (crop id → remaining seeds). */
  public setSeedCount(cropId: string, count: number): void {
    for (const view of this.slotViews.values()) {
      if (view.def.seedId === cropId && view.count) {
        view.count.setText(`x${count}`);
        view.bg.setAlpha(count <= 0 ? 0.35 : view.def.id === this.selectedId ? 1 : 0.75);
      }
    }
  }

  public destroy(): void {
    this.events.removeAllListeners();
    this.container.destroy(true);
  }

  // -- construction --------------------------------------------------------------------

  private buildSlot(def: SlotDef, x: number): void {
    const bg = this.scene.add.rectangle(x, -4, TOOLBAR_SLOT_PX, TOOLBAR_SLOT_PX - 12, 0x1d2b1f, 1);
    bg.setStrokeStyle(1, 0x3f6b3a, 1);
    bg.setAlpha(0.75);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerdown', () => this.select(def));
    bg.on('pointerover', () => bg.setStrokeStyle(2, 0x9fe0a3, 1));
    bg.on('pointerout', () => bg.setStrokeStyle(1, 0x3f6b3a, 1));

    const frame = this.scene.add.rectangle(x, -4, TOOLBAR_SLOT_PX + 4, TOOLBAR_SLOT_PX - 8);
    frame.setStrokeStyle(3, 0xffe066, 1);
    frame.setFillStyle(0x000000, 0);
    frame.setVisible(false);

    const chip = this.scene.add.rectangle(x, -26, 18, 8, def.tint, 1);
    const label = this.scene.add
      .text(x, -8, def.label, { fontFamily: 'monospace', fontSize: '11px', color: '#e8f0e8' })
      .setOrigin(0.5);
    const hint = this.scene.add
      .text(x + TOOLBAR_SLOT_PX / 2 - 6, -22, def.hint, {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#9adc9a',
      })
      .setOrigin(0.5);

    let count: Phaser.GameObjects.Text | null = null;
    if (def.seedId !== null) {
      count = this.scene.add
        .text(x, 8, 'x–', { fontFamily: 'monospace', fontSize: '10px', color: '#ffe9a3' })
        .setOrigin(0.5);
    }

    this.container.add([bg, frame, chip, label, hint]);
    if (count) {
      this.container.add(count);
    }
    this.slotViews.set(def.id, { bg, frame, count, def });
  }

  private select(def: SlotDef): void {
    // Clicking the active slot deselects back to None (handy on touch).
    if (this.selectedId === def.id) {
      this.events.emit('tool-selected', { tool: ToolType.None, seedId: null });
      return;
    }
    this.events.emit('tool-selected', { tool: def.tool, seedId: def.seedId });
  }

  private bindHotkeys(): void {
    const keyboard = this.scene.input.keyboard;
    if (!keyboard) {
      return;
    }
    const codes = [
      Phaser.Input.Keyboard.KeyCodes.ONE,
      Phaser.Input.Keyboard.KeyCodes.TWO,
      Phaser.Input.Keyboard.KeyCodes.THREE,
      Phaser.Input.Keyboard.KeyCodes.FOUR,
      Phaser.Input.Keyboard.KeyCodes.FIVE,
      Phaser.Input.Keyboard.KeyCodes.SIX,
    ];
    codes.forEach((code, index) => {
      const slot = SLOTS[index];
      if (!slot) {
        return;
      }
      keyboard.addKey(code).on('down', () => this.select(slot));
    });
    keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC).on('down', () => {
      this.events.emit('tool-selected', { tool: ToolType.None, seedId: null });
    });
  }
}
