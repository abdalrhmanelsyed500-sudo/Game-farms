import { DEBUG_DEFAULT_VISIBLE } from '../../shared/constants/config.js';
import type { TileCoord } from '../../shared/types/coordinates.js';
import { TypedEventEmitter } from '../../shared/utils/EventEmitter.js';

/**
 * Minimal Phase 1 game state: selection + debug visibility flags.
 *
 * Deliberately small — inventory, farming, economy, etc. arrive in later
 * phases as their own state modules. Emits change events so HUD/debug code
 * stays decoupled from producers.
 */
export interface GameStateEvents {
  'selection-changed': { tile: TileCoord | null };
  'debug-changed': GameStateSnapshot;
}

export interface GameStateSnapshot {
  readonly debugVisible: boolean;
  readonly gridVisible: boolean;
  readonly chunksVisible: boolean;
  readonly collisionVisible: boolean;
  readonly hoverTile: TileCoord | null;
  readonly selectedTile: TileCoord | null;
}

export class GameState {
  public readonly events = new TypedEventEmitter<GameStateEvents>();

  private hoverTile: TileCoord | null = null;
  private selectedTile: TileCoord | null = null;
  private debugVisible = DEBUG_DEFAULT_VISIBLE;
  private gridVisible = false;
  private chunksVisible = false;
  private collisionVisible = false;

  public snapshot(): GameStateSnapshot {
    return {
      debugVisible: this.debugVisible,
      gridVisible: this.gridVisible,
      chunksVisible: this.chunksVisible,
      collisionVisible: this.collisionVisible,
      hoverTile: this.hoverTile,
      selectedTile: this.selectedTile,
    };
  }

  public getHoverTile(): TileCoord | null {
    return this.hoverTile;
  }

  public getSelectedTile(): TileCoord | null {
    return this.selectedTile;
  }

  public setHoverTile(tile: TileCoord | null): void {
    if (this.sameTile(this.hoverTile, tile)) {
      return;
    }
    this.hoverTile = tile;
  }

  public setSelectedTile(tile: TileCoord | null): void {
    if (this.sameTile(this.selectedTile, tile)) {
      return;
    }
    this.selectedTile = tile;
    this.events.emit('selection-changed', { tile });
  }

  public isDebugVisible(): boolean {
    return this.debugVisible;
  }

  public isGridVisible(): boolean {
    return this.gridVisible;
  }

  public isChunksVisible(): boolean {
    return this.chunksVisible;
  }

  public isCollisionVisible(): boolean {
    return this.collisionVisible;
  }

  public toggleDebug(): void {
    this.debugVisible = !this.debugVisible;
    this.events.emit('debug-changed', this.snapshot());
  }

  public toggleGrid(): void {
    this.gridVisible = !this.gridVisible;
    this.events.emit('debug-changed', this.snapshot());
  }

  public toggleChunks(): void {
    this.chunksVisible = !this.chunksVisible;
    this.events.emit('debug-changed', this.snapshot());
  }

  public toggleCollision(): void {
    this.collisionVisible = !this.collisionVisible;
    this.events.emit('debug-changed', this.snapshot());
  }

  private sameTile(a: TileCoord | null, b: TileCoord | null): boolean {
    if (a === null || b === null) {
      return a === b;
    }
    return a.x === b.x && a.y === b.y;
  }
}
