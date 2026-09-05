import Phaser from 'phaser';
import { Logger } from '../../shared/utils/Logger.js';
import { AssetLoader } from '../assets/AssetLoader.js';

/**
 * PreloadScene: asset loading with a progress bar.
 *
 * Flow: preload() queues manifest loads => Phaser loads => create()
 * generates procedural textures => verifies completeness => starts World.
 * Any missing/failed asset fails loudly (ASSET_LOAD_ERROR), never silently.
 */
export class PreloadScene extends Phaser.Scene {
  private progressBar: Phaser.GameObjects.Graphics | null = null;
  private progressBox: Phaser.GameObjects.Graphics | null = null;
  private loadingText: Phaser.GameObjects.Text | null = null;

  public constructor() {
    super({ key: 'Preload' });
  }

  public preload(): void {
    this.createProgressBar();
    AssetLoader.queueLoads(this);

    this.load.on('progress', (value: number) => this.drawProgress(value));
    this.load.on('loaderror', (file: { key?: string }) => {
      Logger.error('Preload', `ASSET_LOAD_ERROR: failed to load "${file?.key ?? 'unknown'}"`);
    });
    this.load.on('complete', () => {
      Logger.info('Preload', 'file loading complete');
    });
  }

  public create(): void {
    try {
      AssetLoader.generateTextures(this);
      AssetLoader.assertComplete(this);
      this.destroyProgressBar();
      Logger.info('Preload', 'assets ready, starting World');
      this.scene.start('World');
    } catch (error) {
      Logger.error('Preload', 'PRELOAD_ERROR: asset pipeline failed', error);
      throw error;
    }
  }

  private createProgressBar(): void {
    const { width, height } = this.scale;
    this.progressBox = this.add.graphics();
    this.progressBox.fillStyle(0x222222, 0.9);
    this.progressBox.fillRect(width / 2 - 160, height / 2 - 25, 320, 50);
    this.progressBar = this.add.graphics();
    this.loadingText = this.add
      .text(width / 2, height / 2 - 50, 'Loading world…', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#e8f0e8',
      })
      .setOrigin(0.5);
  }

  private drawProgress(value: number): void {
    const { width, height } = this.scale;
    this.progressBar?.clear();
    this.progressBar?.fillStyle(0x63ad52, 1);
    this.progressBar?.fillRect(width / 2 - 150, height / 2 - 15, 300 * value, 30);
  }

  private destroyProgressBar(): void {
    this.progressBar?.destroy();
    this.progressBox?.destroy();
    this.loadingText?.destroy();
    this.progressBar = null;
    this.progressBox = null;
    this.loadingText = null;
  }
}
