import Phaser from 'phaser';
import { TypedEventEmitter } from '../../shared/utils/EventEmitter.js';
import {
  CHUNK_OVERLAY_KEY,
  COLLISION_OVERLAY_KEY,
  DEBUG_KEY,
  GRID_KEY,
} from '../../shared/constants/config.js';

/** Normalized keyboard actions (device-independent meanings). */
export interface KeyboardInputEvents {
  'toggle-debug': void;
  'toggle-grid': void;
  'toggle-chunks': void;
  'toggle-collision': void;
}

/**
 * KeyboardInput: WASD/arrows movement vector + debug toggle hotkeys.
 * Game systems consume the normalized vector / events, never key codes.
 */
export class KeyboardInput {
  public readonly events = new TypedEventEmitter<KeyboardInputEvents>();

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private bound = false;

  public bind(scene: Phaser.Scene): void {
    const keyboard = scene.input.keyboard;
    if (!keyboard) {
      throw new Error('INPUT_ERROR: keyboard plugin unavailable');
    }
    // Prevent browser defaults (F3 find-in-page, scrolling via arrows/space).
    keyboard.addCapture([DEBUG_KEY, GRID_KEY, CHUNK_OVERLAY_KEY, COLLISION_OVERLAY_KEY, 'UP,DOWN,LEFT,RIGHT,SPACE'].join(','));

    this.cursors = keyboard.createCursorKeys();
    this.keyW = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyA = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyS = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keyD = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);

    keyboard.on(`keydown-${DEBUG_KEY}`, () => this.events.emit('toggle-debug', undefined));
    keyboard.on(`keydown-${GRID_KEY}`, () => this.events.emit('toggle-grid', undefined));
    keyboard.on(`keydown-${CHUNK_OVERLAY_KEY}`, () => this.events.emit('toggle-chunks', undefined));
    keyboard.on(`keydown-${COLLISION_OVERLAY_KEY}`, () => this.events.emit('toggle-collision', undefined));
    this.bound = true;
  }

  /** Normalized movement vector in SCREEN space (x: right+, y: down+). */
  public getMoveVector(): { x: number; y: number } {
    if (!this.bound) {
      return { x: 0, y: 0 };
    }
    let x = 0;
    let y = 0;
    if (this.cursors.left?.isDown || this.keyA.isDown) {
      x -= 1;
    }
    if (this.cursors.right?.isDown || this.keyD.isDown) {
      x += 1;
    }
    if (this.cursors.up?.isDown || this.keyW.isDown) {
      y -= 1;
    }
    if (this.cursors.down?.isDown || this.keyS.isDown) {
      y += 1;
    }
    if (x !== 0 && y !== 0) {
      const inv = 1 / Math.SQRT2;
      x *= inv;
      y *= inv;
    }
    return { x, y };
  }
}
