/**
 * ToolCatalog (Phase 3): single source of truth for which tools exist.
 *
 * Data-driven like CropDefinitions/ItemCatalog: UI, keybindings, and tooltips
 * read from here instead of hard-coding tool lists. The generic SEED tool is
 * parameterized by crop id at selection time (EquipmentState.seedId).
 */
import { ToolType } from '../../shared/types/farming.js';
import type { ToolDefinition } from '../../shared/types/tools.js';

const TOOL_DEFINITIONS: readonly ToolDefinition[] = [
  {
    id: 'tool:hoe',
    name: 'Hoe',
    tool: ToolType.Hoe,
    keyBinding: '1',
    description: 'Till soil so seeds can be planted.',
  },
  {
    id: 'tool:seed',
    name: 'Seeds',
    tool: ToolType.Seed,
    keyBinding: '2',
    description: 'Plant the selected crop in tilled soil.',
  },
  {
    id: 'tool:watering_can',
    name: 'Watering Can',
    tool: ToolType.WateringCan,
    keyBinding: '3',
    description: 'Water crops so they grow.',
  },
  {
    id: 'tool:hand',
    name: 'Hand',
    tool: ToolType.Hand,
    keyBinding: '',
    description: 'Harvest mature crops.',
  },
];

const BY_ID = new Map<string, ToolDefinition>(TOOL_DEFINITIONS.map((d) => [d.id, d]));

/** All tool definitions in toolbar order. */
export function getToolDefinitions(): readonly ToolDefinition[] {
  return TOOL_DEFINITIONS;
}

/** Look up a tool by stable id, or null when unknown. */
export function getToolDefinition(id: string): ToolDefinition | null {
  return BY_ID.get(id) ?? null;
}

/** Look up a tool by stable id; throws on unknown ids (fail loudly). */
export function requireToolDefinition(id: string): ToolDefinition {
  const def = BY_ID.get(id);
  if (!def) {
    throw new Error(`[ToolCatalog] unknown tool id "${id}"`);
  }
  return def;
}

/** Resolve a ToolType to its catalog definition (None has no entry). */
export function getToolDefinitionForType(tool: ToolType): ToolDefinition | null {
  return TOOL_DEFINITIONS.find((d) => d.tool === tool) ?? null;
}
