import Phaser from 'phaser';
import { TypedEventEmitter } from '../../shared/utils/EventEmitter.js';
import { KeyboardInput } from './KeyboardInput.js';
import { PointerInput } from './PointerInput.js';

/**
 * High-level input actions consumed by game systems.
 * Systems bind to THESE — they never touch KeyboardInput/PointerInput or
 * Phaser input directly. Future TouchInput/GamepadInput feed the same events.
 */
export interface InputManagerEvents {
  'move-camera': { dx: number; dy: number };
  'zoom-camera': { x: number; y: number; factor: number };
  'tile-hover': { x: number; y: number };
  'tile-select': { x: number; y: number };
  'toggle-debug': void;
  'toggle-grid': void;
  'toggle-chunks': void;
  'toggle-collision': void;
}

/** Wheel deltaY normalization: one notch => one zoom step. */
const WHEEL_NOTCH = 100;

/**
 * InputManager: composes device inputs into normalized game actions.
 * Owns no game state — it translates hardware events into meanings.
 */
export class InputManager {
  public readonly events = new TypedEventEmitter<InputManagerEvents>();

  private readonly keyboard = new KeyboardInput();
  private readonly pointer = new PointerInput();
  private isBound = false;

  /** Movement intent in SCREEN space (x right+, y down+), normalized. */
  public get moveVector(): { x: number; y: number } {
    return this.keyboard.getMoveVector();
  }

  public bind(scene: Phaser.Scene, wheelStep: number): void {
    this.isBound = true;
    this.keyboard.bind(scene);
    this.pointer.bind(scene);

    this.keyboard.events.on('toggle-debug', () => this.events.emit('toggle-debug', undefined));
    this.keyboard.events.on('toggle-grid', () => this.events.emit('toggle-grid', undefined));
    this.keyboard.events.on('toggle-chunks', () => this.events.emit('toggle-chunks', undefined));
    this.keyboard.events.on('toggle-collision', () =>
      this.events.emit('toggle-collision', undefined),
    );

    this.pointer.events.on('hover', (pos) => this.events.emit('tile-hover', pos));
    this.pointer.events.on('tap', (pos) => this.events.emit('tile-select', pos));
    this.pointer.events.on('drag', (delta) => this.events.emit('move-camera', delta));
    this.pointer.events.on('wheel', ({ x, y, deltaY }) => {
      const steps = deltaY / WHEEL_NOTCH;
      const factor = Math.pow(wheelStep, -steps);
      this.events.emit('zoom-camera', { x, y, factor });
    });
    this.pointer.events.on('pinch', ({ x, y, scale }) => {
      this.events.emit('zoom-camera', { x, y, factor: scale });
    });
  }

  public unbind(): void {
    this.pointer.unbind();
    this.events.removeAllListeners();
    this.isBound = false;
  }

  public get bound(): boolean {
    return this.isBound;
  }

  public get pointerPosition(): { x: number; y: number } | null {
    return this.pointer.activePointerPosition;
  }
}
