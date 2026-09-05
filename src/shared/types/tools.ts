/**
 * Tool data contracts (Phase 3).
 *
 * Pure types — no logic, no Phaser. The ToolCatalog owns the CONTENT
 * (which tools exist); these types fix the shape. Farming ToolType is reused
 * so Phase 2 systems (player, hover, actions) keep working unchanged.
 */
import type { ToolType } from './farming.js';

/** Data-driven tool definition. Seed tool is parameterized by crop id. */
export interface ToolDefinition {
  /** Stable id, e.g. 'tool:hoe'. */
  readonly id: string;
  readonly name: string;
  readonly tool: ToolType;
  /** Keyboard shortcut label, e.g. '1'. Empty when unbound. */
  readonly keyBinding: string;
  readonly description: string;
}

/** Player's current equipment: one tool + optional seed crop + build choice. */
export interface EquipmentData {
  readonly tool: ToolType;
  /** Active seed crop id when tool is Seed, else null. */
  readonly seedId: string | null;
  /** Building definition id being placed in build mode, else null. */
  readonly buildingId: string | null;
}
