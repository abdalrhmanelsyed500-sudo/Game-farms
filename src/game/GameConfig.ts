import Phaser from 'phaser';
import { BACKGROUND_COLOR } from '../shared/constants/config.js';
import { BootScene } from './scenes/BootScene.js';
import { PreloadScene } from './scenes/PreloadScene.js';
import { WorldScene } from './scenes/WorldScene.js';

/**
 * Central Phaser configuration.
 *
 * - WebGL first (AUTO falls back to Canvas only when WebGL is unavailable).
 * - RESIZE scale mode: the canvas always matches the browser viewport and
 *   the isometric camera adapts — tile dimensions NEVER change with window
 *   size (resolution independence).
 */
export function createPhaserConfig(parent: string | HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    backgroundColor: BACKGROUND_COLOR,
    banner: true,
    disableContextMenu: true,
    fps: {
      target: 60,
      smoothStep: true,
    },
    input: {
      keyboard: true,
      mouse: true,
      touch: true,
    },
    render: {
      antialias: true,
      pixelArt: false,
      roundPixels: false,
      powerPreference: 'high-performance',
    },
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: window.innerWidth,
      height: window.innerHeight,
    },
    scene: [BootScene, PreloadScene, WorldScene],
  };
}
