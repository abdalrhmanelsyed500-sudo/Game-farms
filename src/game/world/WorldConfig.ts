import {
  CHUNK_LOAD_RADIUS,
  CHUNK_SIZE,
  WORLD_HEIGHT,
  WORLD_SEED,
  WORLD_WIDTH,
} from '../../shared/constants/config.js';

/** Static configuration describing one world instance. */
export interface WorldConfig {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly chunkSize: number;
  readonly chunkLoadRadius: number;
  readonly seed: number;
}

/** Phase 1 default world configuration. */
export const DEFAULT_WORLD_CONFIG: WorldConfig = {
  name: 'phase1-demo-farm',
  width: WORLD_WIDTH,
  height: WORLD_HEIGHT,
  chunkSize: CHUNK_SIZE,
  chunkLoadRadius: CHUNK_LOAD_RADIUS,
  seed: WORLD_SEED,
};

export function validateWorldConfig(config: WorldConfig): void {
  if (config.width <= 0 || config.height <= 0) {
    throw new Error(`WORLD_CONFIG_ERROR: invalid world size ${config.width}x${config.height}`);
  }
  if (config.chunkSize <= 0 || config.width % config.chunkSize !== 0 || config.height % config.chunkSize !== 0) {
    throw new Error(
      `WORLD_CONFIG_ERROR: world ${config.width}x${config.height} must be divisible by chunk size ${config.chunkSize}`,
    );
  }
  if (config.chunkLoadRadius < 0) {
    throw new Error(`WORLD_CONFIG_ERROR: negative chunk load radius ${config.chunkLoadRadius}`);
  }
}
