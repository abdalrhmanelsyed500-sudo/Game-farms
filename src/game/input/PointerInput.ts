import Phaser from 'phaser';
import { DRAG_THRESHOLD_PX } from '../../shared/constants/config.js';
import { TypedEventEmitter } from '../../shared/utils/EventEmitter.js';

/** Normalized pointer actions shared by mouse and touch. */
export interface PointerInputEvents {
  /** Press that ended without dragging (click / tap). Screen coords. */
  'tap': { x: number; y: number };
  /** Pointer moved without buttons pressed (hover). Screen coords. */
  'hover': { x: number; y: number };
  /** Drag delta in screen pixels (camera pan). */
  'drag': { dx: number; dy: number };
  /** Wheel zoom. deltaY > 0 => zoom out. */
  'wheel': { x: number; y: number; deltaY: number };
  /** Pinch zoom gesture (touch). scale > 1 => zoom in. */
  'pinch': { x: number; y: number; scale: number };
}

/**
 * PointerInput: unifies mouse + touch into normalized actions.
 * Distinguishes tap (select) from drag (pan) via a movement threshold.
 * Two-pointer pinch is tracked for mobile zoom.
 */
export class PointerInput {
  public readonly events = new TypedEventEmitter<PointerInputEvents>();

  private downAt: { x: number; y: number; pointerId: number } | null = null;
  private dragging = false;
  private lastDragAt: { x: number; y: number } | null = null;
  private pinchDistance: number | null = null;
  private boundScene: Phaser.Scene | null = null;

  public bind(scene: Phaser.Scene): void {
    this.boundScene = scene;
    scene.input.on('pointerdown', this.handlePointerDown, this);
    scene.input.on('pointermove', this.handlePointerMove, this);
    scene.input.on('pointerup', this.handlePointerUp, this);
    scene.input.on('wheel', this.handleWheel, this);
    // Second touch pointer must be explicitly enabled for pinch tracking.
    scene.input.addPointer(1);
  }

  public unbind(): void {
    const scene = this.boundScene;
    if (!scene) {
      return;
    }
    scene.input.off('pointerdown', this.handlePointerDown, this);
    scene.input.off('pointermove', this.handlePointerMove, this);
    scene.input.off('pointerup', this.handlePointerUp, this);
    scene.input.off('wheel', this.handleWheel, this);
    this.boundScene = null;
  }

  /** Current pointer position in screen coords (for hover polling). */
  public get activePointerPosition(): { x: number; y: number } | null {
    const pointer = this.boundScene?.input.activePointer;
    if (!pointer) {
      return null;
    }
    return { x: pointer.x, y: pointer.y };
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (pointer.isDown && this.downAt === null) {
      this.downAt = { x: pointer.x, y: pointer.y, pointerId: pointer.id };
      this.dragging = false;
      this.lastDragAt = { x: pointer.x, y: pointer.y };
    }
    this.pinchDistance = this.currentPinchDistance();
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    // Pinch takes precedence when two pointers are down.
    if (this.twoPointersDown()) {
      this.updatePinch(pointer);
      return;
    }
    if (!pointer.isDown || this.downAt === null || pointer.id !== this.downAt.pointerId) {
      if (!pointer.isDown) {
        this.events.emit('hover', { x: pointer.x, y: pointer.y });
      }
      return;
    }
    const travelX = pointer.x - this.downAt.x;
    const travelY = pointer.y - this.downAt.y;
    if (!this.dragging && Math.hypot(travelX, travelY) >= DRAG_THRESHOLD_PX) {
      this.dragging = true;
    }
    if (this.dragging && this.lastDragAt) {
      this.events.emit('drag', {
        dx: pointer.x - this.lastDragAt.x,
        dy: pointer.y - this.lastDragAt.y,
      });
      this.lastDragAt = { x: pointer.x, y: pointer.y };
    }
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    if (this.downAt !== null && pointer.id === this.downAt.pointerId) {
      if (!this.dragging) {
        this.events.emit('tap', { x: pointer.upX, y: pointer.upY });
      }
      this.downAt = null;
      this.dragging = false;
      this.lastDragAt = null;
    }
    this.pinchDistance = this.twoPointersDown() ? this.currentPinchDistance() : null;
  }

  private handleWheel(
    pointer: Phaser.Input.Pointer,
    _currentlyOver: unknown[],
    _dx: number,
    dy: number,
  ): void {
    this.events.emit('wheel', { x: pointer.x, y: pointer.y, deltaY: dy });
  }

  private twoPointersDown(): boolean {
    const scene = this.boundScene;
    if (!scene) {
      return false;
    }
    return scene.input.pointer1.isDown && scene.input.pointer2.isDown;
  }

  private currentPinchDistance(): number | null {
    const scene = this.boundScene;
    if (!scene || !this.twoPointersDown()) {
      return null;
    }
    const p1 = scene.input.pointer1;
    const p2 = scene.input.pointer2;
    return Math.hypot(p1.x - p2.x, p1.y - p2.y);
  }

  private updatePinch(pointer: Phaser.Input.Pointer): void {
    const distance = this.currentPinchDistance();
    if (distance === null || distance <= 0) {
      return;
    }
    if (this.pinchDistance !== null && this.pinchDistance > 0) {
      this.events.emit('pinch', {
        x: pointer.x,
        y: pointer.y,
        scale: distance / this.pinchDistance,
      });
    }
    this.pinchDistance = distance;
  }
}
