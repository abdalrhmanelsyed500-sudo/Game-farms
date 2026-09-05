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
  /** SEEDS slot activated: WorldScene toggles the seed picker popup. */
  'seeds-requested': void;
  /** BUILD slot activated: WorldScene toggles build mode. */
  'build-requested': void;
  /** INV slot activated: WorldScene toggles the inventory panel. */
  'inventory-requested': void;
  /** Esc pressed: WorldScene closes topmost UI, else deselects. */
  'escape-pressed': void;
  /** R pressed: WorldScene rotates the ghost (build mode only). */
  'rotate-requested': void;
  /** Number key in build mode: pick the nth building in menu order. */
  'build-pick-index': { index: number };
}

type SlotKind = 'tool' | 'seeds' | 'build' | 'inventory';

interface SlotDef {
  readonly id: string;
  readonly label: string;
  readonly hint: string;
  readonly kind: SlotKind;
  readonly tool: ToolType;
  readonly tint: number;
}

const SLOTS: readonly SlotDef[] = [
  { id: 'hoe', label: 'HOE', hint: '1', kind: 'tool', tool: ToolType.Hoe, tint: 0x8a5a33 },
  { id: 'seeds', label: 'SEEDS', hint: '2', kind: 'seeds', tool: ToolType.Seed, tint: 0xd8a83f },
  { id: 'water', label: 'WATER', hint: '3', kind: 'tool', tool: ToolType.WateringCan, tint: 0x3d7fc2 },
  { id: 'build', label: 'BUILD', hint: '4', kind: 'build', tool: ToolType.None, tint: 0xb06a2a },
  { id: 'inventory', label: 'INV', hint: 'I', kind: 'inventory', tool: ToolType.None, tint: 0x6a7a9a },
];

const SLOT_GAP = 8;
const BAR_PADDING = 10;

/**
 * Toolbar: Phase 3 tool/mode UI (HOE / SEEDS / WATER / BUILD / INV).
 *
 * - Pure Phaser UI, screen-fixed (scrollFactor 0), Ui depth band.
 * - Owns UI hotkeys (1–4, I, R, H, Esc) — UI-level shortcuts, not actions.
 * - Emits normalized events; WorldScene applies them (tools, picker, panels).
 * - Harvest has no slot: click a mature crop with no tool, or press H.
 * - Exposes screen bounds so world taps on the bar are ignored by the world
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
    sub: Phaser.GameObjects.Text | null;
    def: SlotDef;
  }>();
  private selectedId: string | null = null;
  private buildMode = false;
  private selectedCropId: string | null = null;
  private readonly seedCounts = new Map<string, number>();
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

  /** Reflect external selection state (tool + seed crop). */
  public setSelected(tool: ToolType, seedId: string | null): void {
    this.selectedCropId = tool === ToolType.Seed ? seedId : null;
    if (tool === ToolType.Seed) {
      this.selectedId = 'seeds';
    } else {
      this.selectedId = SLOTS.find((s) => s.kind === 'tool' && s.tool === tool)?.id ?? null;
    }
    this.refreshHighlight();
    this.refreshSeedsLabel();
  }

  /** Highlight the BUILD slot while build mode is active. */
  public setBuildMode(active: boolean): void {
    this.buildMode = active;
    this.refreshHighlight();
  }

  /** Refresh a seed count (crop id → remaining seeds). */
  public setSeedCount(cropId: string, count: number): void {
    this.seedCounts.set(cropId, count);
    this.refreshSeedsLabel();
  }

  public destroy(): void {
    this.events.removeAllListeners();
    this.container.destroy(true);
  }

  // -- internals --------------------------------------------------------------------

  private refreshHighlight(): void {
    for (const [slotId, view] of this.slotViews) {
      const active = slotId === this.selectedId || (this.buildMode && slotId === 'build');
      view.frame.setVisible(active);
      view.bg.setAlpha(active ? 1 : 0.75);
    }
  }

  /** SEEDS sub-label shows the selected crop's remaining seeds. */
  private refreshSeedsLabel(): void {
    const view = this.slotViews.get('seeds');
    if (!view?.sub) {
      return;
    }
    if (this.selectedCropId === null) {
      view.sub.setText('pick ▴');
      return;
    }
    const count = this.seedCounts.get(this.selectedCropId) ?? 0;
    view.sub.setText(`${this.selectedCropId.slice(0, 4)} x${count}`);
    view.bg.setAlpha(count <= 0 ? 0.35 : this.selectedId === 'seeds' ? 1 : 0.75);
  }

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
      .text(x, -10, def.label, { fontFamily: 'monospace', fontSize: '11px', color: '#e8f0e8' })
      .setOrigin(0.5);
    const hint = this.scene.add
      .text(x + TOOLBAR_SLOT_PX / 2 - 6, -24, def.hint, {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#9adc9a',
      })
      .setOrigin(0.5);

    let sub: Phaser.GameObjects.Text | null = null;
    if (def.kind === 'seeds') {
      sub = this.scene.add
        .text(x, 8, 'pick ▴', { fontFamily: 'monospace', fontSize: '10px', color: '#ffe9a3' })
        .setOrigin(0.5);
    }

    this.container.add([bg, frame, chip, label, hint]);
    if (sub) {
      this.container.add(sub);
    }
    this.slotViews.set(def.id, { bg, frame, sub, def });
  }

  private select(def: SlotDef): void {
    switch (def.kind) {
      case 'tool':
        // Clicking the active slot deselects back to None (handy on touch).
        if (this.selectedId === def.id) {
          this.events.emit('tool-selected', { tool: ToolType.None, seedId: null });
        } else {
          this.events.emit('tool-selected', { tool: def.tool, seedId: null });
        }
        return;
      case 'seeds':
        this.events.emit('seeds-requested', undefined);
        return;
      case 'build':
        this.events.emit('build-requested', undefined);
        return;
      case 'inventory':
        this.events.emit('inventory-requested', undefined);
        return;
    }
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
    ];
    codes.forEach((code, index) => {
      keyboard.addKey(code).on('down', () => {
        // In build mode the number keys pick buildings, not tools.
        if (this.buildMode && index < 3) {
          this.events.emit('build-pick-index', { index });
          return;
        }
        const slot = SLOTS[index];
        if (slot) {
          this.select(slot);
        }
      });
    });
    keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.I).on('down', () => {
      this.events.emit('inventory-requested', undefined);
    });
    keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R).on('down', () => {
      this.events.emit('rotate-requested', undefined);
    });
    // Hidden harvest hotkey: the toolbar has no HAND slot by design.
    keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.H).on('down', () => {
      this.events.emit('tool-selected', { tool: ToolType.Hand, seedId: null });
    });
    keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC).on('down', () => {
      this.events.emit('escape-pressed', undefined);
    });
  }
}
