import { Logger } from '../../shared/utils/Logger.js';
import { WorldManager } from '../world/WorldManager.js';
import { GameState } from './GameState.js';

/**
 * GameContext: service locator for cross-scene shared services.
 *
 * BootScene initializes it exactly once; later scenes read from it. Services
 * are created in dependency order (state -> world) so startup stays
 * deterministic. Stored in the Phaser registry AND exposed as a singleton
 * for non-scene consumers.
 */
export class GameContext {
  private gameState: GameState | null = null;
  private worldManager: WorldManager | null = null;
  private initialized = false;

  public initialize(): void {
    if (this.initialized) {
      return;
    }
    this.gameState = new GameState();
    this.worldManager = new WorldManager();
    this.worldManager.initialize();
    this.initialized = true;
    Logger.info('GameContext', 'shared services initialized');
  }

  public get state(): GameState {
    if (!this.gameState) {
      throw new Error('CONTEXT_ERROR: GameContext not initialized (missing GameState)');
    }
    return this.gameState;
  }

  public get worlds(): WorldManager {
    if (!this.worldManager) {
      throw new Error('CONTEXT_ERROR: GameContext not initialized (missing WorldManager)');
    }
    return this.worldManager;
  }

  public get isInitialized(): boolean {
    return this.initialized;
  }
}

/** Process-wide shared context (one game instance per page). */
export const gameContext = new GameContext();

export const GAME_CONTEXT_REGISTRY_KEY = 'game-context';
