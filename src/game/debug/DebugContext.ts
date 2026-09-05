import type Phaser from 'phaser';
import type { CameraController } from '../camera/CameraController.js';
import type { GameState } from '../core/GameState.js';
import type { PlayerPlaceholder } from '../entities/PlayerPlaceholder.js';
import type { IsoRenderer } from '../isometric/IsoRenderer.js';
import type { WorldManager } from '../world/WorldManager.js';

/**
 * DebugContext: everything debug overlays may inspect. Passed down from
 * WorldScene so overlays never reach into scene internals or globals.
 */
export interface DebugContext {
  readonly scene: Phaser.Scene;
  readonly worldManager: WorldManager;
  readonly gameState: GameState;
  readonly player: PlayerPlaceholder;
  readonly cameraController: CameraController;
  readonly isoRenderer: IsoRenderer;
  /** Optional Phase 2 farming lines (tool, soil, crop). Absent when no farm exists. */
  readonly getFarmingDebugLines?: () => readonly string[];
}
