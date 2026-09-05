import Phaser from 'phaser';
import { Logger } from '../../shared/utils/Logger.js';
import { createPhaserConfig } from '../GameConfig.js';

/**
 * Game: owns the Phaser.Game instance and top-level lifecycle.
 * Thin by design — boot flow lives in the scenes (Boot => Preload => World).
 */
export class Game {
  private readonly phaserGame: Phaser.Game;

  public constructor(parent: string | HTMLElement) {
    this.phaserGame = new Phaser.Game(createPhaserConfig(parent));
    this.phaserGame.events.once(Phaser.Core.Events.READY, () => {
      const renderer = this.phaserGame.config.renderType;
      Logger.info('Game', `Phaser ready (renderer=${renderer}, ${window.innerWidth}x${window.innerHeight})`);
    });
  }

  public get phaser(): Phaser.Game {
    return this.phaserGame;
  }

  public destroy(): void {
    this.phaserGame.destroy(true);
  }
}
