import './style.css';
import { Game } from './game/core/Game.js';
import { Logger } from './shared/utils/Logger.js';

/**
 * Browser entry point.
 *
 *   main.ts => Game => Phaser boot => BootScene => PreloadScene => WorldScene
 */
function boot(): void {
  const container = document.getElementById('game-container');
  if (!container) {
    throw new Error('BOOT_ERROR: #game-container element missing from index.html');
  }
  const game = new Game(container);
  // Exposed for debugging from the browser console (dev convenience only).
  (window as unknown as { __gameFarms: Game }).__gameFarms = game;
}

try {
  boot();
} catch (error) {
  Logger.error('main', 'BOOT_ERROR: game failed to start', error);
  document.getElementById('boot-fallback')?.classList.remove('hidden');
}
