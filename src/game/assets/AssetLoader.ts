import Phaser from 'phaser';
import { Logger } from '../../shared/utils/Logger.js';
import { ASSET_KEYS, getAssetDefinition } from './AssetManifest.js';
import { PlaceholderTextureFactory } from './PlaceholderTextureFactory.js';

/**
 * AssetLoader: centralized asset registration.
 *
 * Gameplay scenes must NEVER call `this.load.image(...)` directly. All
 * loading goes through here, driven by the AssetManifest:
 * - entries with `path`  => queued on the Phaser loader (future file art)
 * - entries with `generated` => built by PlaceholderTextureFactory
 */
export class AssetLoader {
  /**
   * Queue file-based manifest entries on the scene loader. Call from
   * preload(). Phase 1 has no file entries yet — the path exists for art
   * drop-in without code changes.
   */
  public static queueLoads(scene: Phaser.Scene): void {
    for (const key of ASSET_KEYS) {
      const def = getAssetDefinition(key);
      if (def.path !== undefined && !def.generated) {
        scene.load.image(def.key, def.path);
      }
    }
  }

  /** Build all generated textures. Call from create(), after load completes. */
  public static generateTextures(scene: Phaser.Scene): void {
    PlaceholderTextureFactory.createAll(scene);
    Logger.info('Assets', `${ASSET_KEYS.length} placeholder textures ready`);
  }

  /** Fail loudly if any manifest texture is missing (never silently). */
  public static assertComplete(scene: Phaser.Scene): void {
    const missing = ASSET_KEYS.filter((key) => !scene.textures.exists(key));
    if (missing.length > 0) {
      throw new Error(`ASSET_LOAD_ERROR: missing textures: ${missing.join(', ')}`);
    }
  }
}
