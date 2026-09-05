import { SoilState, type CropDefinition } from '../../shared/types/farming.js';

/**
 * Crop content registry (Phase 2).
 *
 * DATA, not code: FarmingSystem never branches per crop — every crop flows
 * through the same validate/plant/grow/harvest path using its definition.
 * Growth durations are dev-tuned (30–60s at FARM_TIME_SCALE 1); production
 * pacing is a config change, not a code change.
 */
export const CROP_WHEAT: CropDefinition = {
  id: 'wheat',
  name: 'Wheat',
  growthDurationSec: 40,
  growthStages: 4,
  yieldItemId: 'wheat',
  yieldAmount: 3,
  seedItemId: 'wheat_seed',
  waterRequired: true,
};

export const CROP_CORN: CropDefinition = {
  id: 'corn',
  name: 'Corn',
  growthDurationSec: 55,
  growthStages: 4,
  yieldItemId: 'corn',
  yieldAmount: 2,
  seedItemId: 'corn_seed',
  waterRequired: true,
};

export const CROP_TOMATO: CropDefinition = {
  id: 'tomato',
  name: 'Tomato',
  growthDurationSec: 48,
  growthStages: 4,
  yieldItemId: 'tomato',
  yieldAmount: 4,
  seedItemId: 'tomato_seed',
  waterRequired: true,
};

const REGISTRY: Readonly<Record<string, CropDefinition>> = {
  [CROP_WHEAT.id]: CROP_WHEAT,
  [CROP_CORN.id]: CROP_CORN,
  [CROP_TOMATO.id]: CROP_TOMATO,
};

/** All crop ids in toolbar order. */
export const CROP_IDS: readonly string[] = [CROP_WHEAT.id, CROP_CORN.id, CROP_TOMATO.id];

export function getCropDefinition(cropId: string): CropDefinition | null {
  return REGISTRY[cropId] ?? null;
}

export function requireCropDefinition(cropId: string): CropDefinition {
  const def = getCropDefinition(cropId);
  if (!def) {
    throw new Error(`CROP_DEF_ERROR: unknown crop id "${cropId}"`);
  }
  return def;
}

/** Texture-key convention: crop_<id>_stage_<NN> (stage is 0-based). */
export function cropTextureKey(cropId: string, stage: number): string {
  return `crop_${cropId}_stage_${String(stage + 1).padStart(2, '0')}`;
}

/** Soil overlay texture keys (null = no overlay for Normal soil). */
export function soilTextureKey(soil: SoilState): string | null {
  switch (soil) {
    case SoilState.Tilled:
      return 'soil_tilled';
    case SoilState.Watered:
      return 'soil_watered';
    case SoilState.Normal:
    default:
      return null;
  }
}
