import Phaser from 'phaser';
import {
  CAMERA_DEFAULT_ZOOM,
  CAMERA_WHEEL_STEP,
  CHUNK_STREAM_INTERVAL_MS,
  PLAYER_SPAWN_TILE_X,
  PLAYER_SPAWN_TILE_Y,
} from '../../shared/constants/config.js';
import type { TileCoord } from '../../shared/types/coordinates.js';
import { Logger } from '../../shared/utils/Logger.js';
import { CameraController } from '../camera/CameraController.js';
import { CollisionMap } from '../collision/CollisionMap.js';
import { CollisionSystem } from '../collision/CollisionSystem.js';
import { GAME_CONTEXT_REGISTRY_KEY, type GameContext } from '../core/GameContext.js';
import { ChunkOverlay } from '../debug/ChunkOverlay.js';
import { CollisionOverlay } from '../debug/CollisionOverlay.js';
import { CoordinateOverlay } from '../debug/CoordinateOverlay.js';
import type { DebugContext } from '../debug/DebugContext.js';
import { DebugOverlay } from '../debug/DebugOverlay.js';
import { GridOverlay } from '../debug/GridOverlay.js';
import { PerformanceOverlay } from '../debug/PerformanceOverlay.js';
import { PlayerPlaceholder } from '../entities/PlayerPlaceholder.js';
import { InputManager } from '../input/InputManager.js';
import { IsoCamera } from '../isometric/IsoCamera.js';
import { IsoRenderer } from '../isometric/IsoRenderer.js';
import { RenderLayer } from '../rendering/RenderLayers.js';

/**
 * WorldScene: the playable isometric world.
 *
 * ORCHESTRATION ONLY — every subsystem does its own work:
 * - WorldManager   => data + streaming decisions
 * - IsoRenderer    => chunk visuals (subscribes to chunk events)
 * - InputManager   => normalized input actions
 * - CameraController => pan / zoom / bounds
 * - PlayerPlaceholder => test entity movement + collision
 * - Debug overlays => inspection tools
 *
 * This scene wires them together and pumps the update loop. It holds no
 * gameplay state (that lives in GameState / World) and no rendering logic
 * (that lives in the renderers).
 */
export class WorldScene extends Phaser.Scene {
  private context!: GameContext;
  private isoRenderer!: IsoRenderer;
  private cameraController!: CameraController;
  private inputManager!: InputManager;
  private player!: PlayerPlaceholder;

  private hoverHighlight!: Phaser.GameObjects.Image;
  private selectedHighlight!: Phaser.GameObjects.Image;

  private debugOverlay!: DebugOverlay;
  private gridOverlay!: GridOverlay;
  private chunkOverlay!: ChunkOverlay;
  private collisionOverlay!: CollisionOverlay;
  private coordinateOverlay!: CoordinateOverlay;
  private performanceOverlay!: PerformanceOverlay;

  private streamAccumulator = 0;
  private readonly streamInterval = CHUNK_STREAM_INTERVAL_MS / 1000;

  public constructor() {
    super({ key: 'World' });
  }

  public create(): void {
    this.context = this.game.registry.get(GAME_CONTEXT_REGISTRY_KEY) as GameContext;
    if (!this.context?.isInitialized) {
      throw new Error('WORLD_SCENE_ERROR: GameContext missing — BootScene must run first');
    }
    const worldManager = this.context.worlds;
    const world = worldManager.getWorld();

    // -- camera ------------------------------------------------------------------
    const isoCamera = new IsoCamera(this.cameras.main);
    const pixelSize = worldManager.getPixelSize();
    isoCamera.setBounds(0, 0, pixelSize.width, pixelSize.height);
    this.cameraController = new CameraController(isoCamera, { initialZoom: CAMERA_DEFAULT_ZOOM });

    // -- renderer (chunk visuals) --------------------------------------------------
    this.isoRenderer = new IsoRenderer(this, worldManager);
    this.isoRenderer.attach();

    // -- player --------------------------------------------------------------------
    const collision = new CollisionSystem(new CollisionMap(world));
    this.player = new PlayerPlaceholder(
      PLAYER_SPAWN_TILE_X + 0.5,
      PLAYER_SPAWN_TILE_Y + 0.5,
      collision,
      worldManager.coordinates,
      this.isoRenderer.objectRendererInstance,
    );
    this.player.createView();

    // -- input ---------------------------------------------------------------------
    this.inputManager = new InputManager();
    this.inputManager.bind(this, CAMERA_WHEEL_STEP);
    this.wireInput();

    // -- selection highlights (world-space, above objects, below debug) ------------
    this.hoverHighlight = this.add
      .image(0, 0, 'tile_hover')
      .setDepth(RenderLayer.SelectionHighlight)
      .setVisible(false);
    this.selectedHighlight = this.add
      .image(0, 0, 'tile_selected')
      .setDepth(RenderLayer.SelectionHighlight + 1)
      .setVisible(false);

    // -- debug tools ---------------------------------------------------------------
    const debugCtx: DebugContext = {
      scene: this,
      worldManager,
      gameState: this.context.state,
      player: this.player,
      cameraController: this.cameraController,
      isoRenderer: this.isoRenderer,
    };
    this.debugOverlay = new DebugOverlay(debugCtx);
    this.gridOverlay = new GridOverlay(debugCtx);
    this.chunkOverlay = new ChunkOverlay(debugCtx);
    this.collisionOverlay = new CollisionOverlay(debugCtx);
    this.coordinateOverlay = new CoordinateOverlay(debugCtx);
    this.performanceOverlay = new PerformanceOverlay(debugCtx);
    this.layoutOverlays();

    // -- initial camera + streaming --------------------------------------------------
    const spawnScreen = this.player.getScreenPosition();
    this.cameraController.snapTo(spawnScreen.x, spawnScreen.y, CAMERA_DEFAULT_ZOOM);
    this.runStreaming(true);

    // -- resize ----------------------------------------------------------------------
    this.scale.on('resize', this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);

    Logger.info('WorldScene', 'world scene ready');
  }

  public update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.1);
    const move = this.inputManager.moveVector;

    this.cameraController.update(dt, move);
    this.player.moveScreenSpace(move.x, move.y, dt);

    this.updateHoverHighlight();

    this.streamAccumulator += dt;
    if (this.streamAccumulator >= this.streamInterval) {
      this.streamAccumulator = 0;
      this.runStreaming(false);
    }

    this.debugOverlay.update(dt);
    this.gridOverlay.update();
    this.chunkOverlay.update();
    this.collisionOverlay.update();
    this.performanceOverlay.update(dt);
  }

  // -- input wiring ---------------------------------------------------------------

  private wireInput(): void {
    const state = this.context.state;
    const events = this.inputManager.events;

    events.on('move-camera', ({ dx, dy }) => this.cameraController.panByScreenDelta(dx, dy));
    events.on('zoom-camera', ({ x, y, factor }) => this.cameraController.zoomAt(x, y, factor));
    events.on('tile-select', (pos) => {
      const tile = this.pickTile(pos.x, pos.y);
      state.setSelectedTile(tile);
      this.updateSelectedHighlight();
    });
    events.on('toggle-debug', () => state.toggleDebug());
    events.on('toggle-grid', () => state.toggleGrid());
    events.on('toggle-chunks', () => state.toggleChunks());
    events.on('toggle-collision', () => state.toggleCollision());

    state.events.on('selection-changed', () => this.updateSelectedHighlight());
  }

  // -- tile picking ------------------------------------------------------------------

  /**
   * Full pointer-pick pipeline: screen => world-pixels => world => tile.
   * Returns null when the pointer is outside world bounds.
   */
  private pickTile(screenX: number, screenY: number): TileCoord | null {
    const worldManager = this.context.worlds;
    const world = worldManager.getWorld();
    const iso = this.cameraController.camera.screenToWorld(screenX, screenY);
    const point = worldManager.coordinates.screenToWorld(iso.x, iso.y);
    const tile = worldManager.coordinates.worldToTile(point.x, point.y);
    if (!world.isInBounds(tile.x, tile.y)) {
      return null;
    }
    return tile;
  }

  /** Hover follows the pointer every frame (also correct while panning). */
  private updateHoverHighlight(): void {
    const pointer = this.inputManager.pointerPosition;
    if (!pointer) {
      return;
    }
    const tile = this.pickTile(pointer.x, pointer.y);
    this.context.state.setHoverTile(tile);
    if (!tile) {
      this.hoverHighlight.setVisible(false);
      this.coordinateOverlay.clear();
      return;
    }
    const center = this.context.worlds.coordinates.tileCenterToScreen(tile.x, tile.y);
    this.hoverHighlight.setPosition(center.x, center.y).setVisible(true);

    const iso = this.cameraController.camera.screenToWorld(pointer.x, pointer.y);
    const point = this.context.worlds.coordinates.screenToWorld(iso.x, iso.y);
    const chunk = this.context.worlds.coordinates.worldToChunk(point.x, point.y);
    this.coordinateOverlay.setHover({
      screenX: pointer.x,
      screenY: pointer.y,
      worldX: point.x,
      worldY: point.y,
      tileX: tile.x,
      tileY: tile.y,
      chunkX: chunk.x,
      chunkY: chunk.y,
    });
  }

  private updateSelectedHighlight(): void {
    const selected = this.context.state.getSelectedTile();
    if (!selected) {
      this.selectedHighlight.setVisible(false);
      return;
    }
    const center = this.context.worlds.coordinates.tileCenterToScreen(selected.x, selected.y);
    this.selectedHighlight.setPosition(center.x, center.y).setVisible(true);
  }

  // -- streaming ----------------------------------------------------------------------

  /** Ensure chunks around the camera view center are loaded. */
  private runStreaming(_initial: boolean): void {
    const worldManager = this.context.worlds;
    const center = this.cameraController.camera.getViewCenter();
    const worldPoint = worldManager.coordinates.screenToWorld(center.x, center.y);
    worldManager.updateStreaming(worldPoint.x, worldPoint.y);
  }

  // -- housekeeping ---------------------------------------------------------------------

  private handleResize(gameSize: Phaser.Structs.Size): void {
    const width = gameSize.width;
    const height = gameSize.height;
    this.cameraController.reapplyBounds();
    this.coordinateOverlay.layout(height);
    this.performanceOverlay.layout(width);
    Logger.debug('WorldScene', `resized to ${width}x${height}`);
  }

  private layoutOverlays(): void {
    this.coordinateOverlay.clear();
    this.coordinateOverlay.layout(this.scale.height);
    this.performanceOverlay.layout(this.scale.width);
  }

  private handleShutdown(): void {
    this.scale.off('resize', this.handleResize, this);
    this.inputManager.unbind();
    this.isoRenderer.detach();
    this.player.destroyView();
    Logger.info('WorldScene', 'shutdown: visuals destroyed, listeners removed');
  }
}
