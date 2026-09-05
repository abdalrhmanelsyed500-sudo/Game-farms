import Phaser from 'phaser';
import { Logger } from '../../shared/utils/Logger.js';
import { GAME_CONTEXT_REGISTRY_KEY, gameContext } from '../core/GameContext.js';

/**
 * BootScene: first scene in the deterministic startup flow.
 *
 * Responsibilities: initialize shared services (GameContext: state + world
 * data) exactly once, then hand off to PreloadScene. No assets, no visuals —
 * world DATA generation happens here so every later scene sees a ready world.
 */
export class BootScene extends Phaser.Scene {
  public constructor() {
    super({ key: 'Boot' });
  }

  public create(): void {
    try {
      gameContext.initialize();
      this.game.registry.set(GAME_CONTEXT_REGISTRY_KEY, gameContext);
      Logger.info('Boot', 'context ready, starting Preload');
      this.scene.start('Preload');
    } catch (error) {
      Logger.error('Boot', 'BOOT_ERROR: failed to initialize game context', error);
      throw error;
    }
  }
}
