import { describe, expect, it } from 'vitest';
import { ToolType } from '../src/shared/types/farming.js';
import { UiMode } from '../src/shared/types/ui.js';
import { EquipmentState } from '../src/game/tools/EquipmentState.js';
import {
  getToolDefinition,
  getToolDefinitionForType,
  getToolDefinitions,
  requireToolDefinition,
} from '../src/game/tools/ToolCatalog.js';

describe('ToolCatalog', () => {
  it('defines hoe, seed, watering can, and hand with stable ids', () => {
    const byId = new Map(getToolDefinitions().map((d) => [d.id, d]));
    expect(byId.get('tool:hoe')?.tool).toBe(ToolType.Hoe);
    expect(byId.get('tool:seed')?.tool).toBe(ToolType.Seed);
    expect(byId.get('tool:watering_can')?.tool).toBe(ToolType.WateringCan);
    expect(byId.get('tool:hand')?.tool).toBe(ToolType.Hand);
  });

  it('binds toolbar keys 1/2/3 to hoe/seeds/water', () => {
    expect(requireToolDefinition('tool:hoe').keyBinding).toBe('1');
    expect(requireToolDefinition('tool:seed').keyBinding).toBe('2');
    expect(requireToolDefinition('tool:watering_can').keyBinding).toBe('3');
  });

  it('looks up by id and by ToolType, throws on require of unknown ids', () => {
    expect(getToolDefinition('tool:hoe')?.name).toBe('Hoe');
    expect(getToolDefinition('tool:nope')).toBeNull();
    expect(() => requireToolDefinition('tool:nope')).toThrow();
    expect(getToolDefinitionForType(ToolType.Hand)?.id).toBe('tool:hand');
    expect(getToolDefinitionForType(ToolType.None)).toBeNull();
  });
});

describe('EquipmentState', () => {
  it('starts empty', () => {
    const equipment = new EquipmentState();
    expect(equipment.get()).toEqual({ tool: ToolType.None, seedId: null, buildingId: null });
  });

  it('selects tools and clears the seed choice for non-seed tools', () => {
    const equipment = new EquipmentState();
    equipment.selectTool(ToolType.Seed, 'wheat');
    expect(equipment.get()).toEqual({ tool: ToolType.Seed, seedId: 'wheat', buildingId: null });
    equipment.selectTool(ToolType.Hoe);
    expect(equipment.get()).toEqual({ tool: ToolType.Hoe, seedId: null, buildingId: null });
  });

  it('keeps the previous crop when re-selecting seeds without a crop', () => {
    const equipment = new EquipmentState();
    equipment.selectTool(ToolType.Seed, 'corn');
    equipment.selectTool(ToolType.Seed);
    expect(equipment.get().seedId).toBe('corn');
  });

  it('selects buildings and clears tools', () => {
    const equipment = new EquipmentState();
    equipment.selectTool(ToolType.Hoe);
    equipment.selectBuilding('building:barn');
    expect(equipment.get()).toEqual({
      tool: ToolType.None,
      seedId: null,
      buildingId: 'building:barn',
    });
  });

  it('clear deselects everything', () => {
    const equipment = new EquipmentState();
    equipment.selectTool(ToolType.Seed, 'tomato');
    equipment.clear();
    expect(equipment.get()).toEqual({ tool: ToolType.None, seedId: null, buildingId: null });
  });

  it('emits equipment-changed with an immutable snapshot on every change', () => {
    const equipment = new EquipmentState();
    const seen: ToolType[] = [];
    equipment.events.on('equipment-changed', (data) => seen.push(data.tool));
    equipment.selectTool(ToolType.Hoe);
    equipment.selectBuilding('building:small_house');
    equipment.clear();
    expect(seen).toEqual([ToolType.Hoe, ToolType.None, ToolType.None]);
    const snapshot = equipment.get();
    expect(snapshot).toEqual({ tool: ToolType.None, seedId: null, buildingId: null });
  });
});

describe('UiMode', () => {
  it('defines play and build modes', () => {
    expect(UiMode.Play).toBe('play');
    expect(UiMode.Build).toBe('build');
  });
});
