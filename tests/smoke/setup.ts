/**
 * Vitest setup file: install the headless canvas stub before any test
 * module (and therefore before Phaser) is imported. No-op outside jsdom.
 */
import { installSmokeCanvasStub } from './setupCanvasStub.js';

if (typeof window !== 'undefined' && window.HTMLCanvasElement) {
  installSmokeCanvasStub();
}
