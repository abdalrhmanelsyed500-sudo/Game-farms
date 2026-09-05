/**
 * EquipmentState (Phase 3): what the player currently holds/selected.
 *
 * Pure logic, no Phaser: toolbar, keybindings, and build menu write here;
 * WorldScene bridges changes into the player placeholder + hover preview.
 * Emits 'equipment-changed' on every selection so UI stays in sync.
 */
import { ToolType } from '../../shared/types/farming.js';
import type { EquipmentData } from '../../shared/types/tools.js';
import { TypedEventEmitter } from '../../shared/utils/EventEmitter.js';

export interface EquipmentEvents {
  'equipment-changed': EquipmentData;
}

const EMPTY: EquipmentData = { tool: ToolType.None, seedId: null, buildingId: null };

export class EquipmentState {
  public readonly events = new TypedEventEmitter<EquipmentEvents>();

  private current: EquipmentData = { ...EMPTY };

  /** Current selection snapshot (immutable). */
  public get(): EquipmentData {
    return { ...this.current };
  }

  /** Select a farming tool. Non-seed tools clear the seed choice. */
  public selectTool(tool: ToolType, seedId: string | null = null): void {
    const normalizedSeed = tool === ToolType.Seed ? seedId : null;
    // Re-selecting the seed tool with no crop keeps the previous crop.
    const nextSeed =
      tool === ToolType.Seed && normalizedSeed === null ? this.current.seedId : normalizedSeed;
    this.set({ tool, seedId: nextSeed, buildingId: null });
  }

  /** Select a building for placement (build mode follows via UiMode). */
  public selectBuilding(buildingId: string): void {
    this.set({ tool: ToolType.None, seedId: null, buildingId });
  }

  /** Deselect everything. */
  public clear(): void {
    this.set({ ...EMPTY });
  }

  private set(next: EquipmentData): void {
    this.current = { ...next };
    this.events.emit('equipment-changed', this.get());
  }
}
