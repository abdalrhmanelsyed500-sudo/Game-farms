import Phaser from 'phaser';
import {
  CAMERA_DEFAULT_ZOOM,
  CAMERA_WHEEL_STEP,
  CHUNK_STREAM_INTERVAL_MS,
  PLAYER_SPAWN_TILE_X,
  PLAYER_SPAWN_TILE_Y,
} from '../../shared/constants/config.js';
import type { TileCoord } from '../../shared/types/coordinates.js';
import { FarmAction, ToolType } from '../../shared/types/farming.js';
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
import { CropRenderer } from '../farming/CropRenderer.js';
import { CROP_IDS, getCropDefinition } from '../farming/CropDefinitions.js';
import { SystemClock } from '../farming/Clock.js';
import { FarmEffects } from '../farming/FarmEffects.js';
import { FarmingSystem, describeRejectReason } from '../farming/FarmingSystem.js';
import { LocalFarmState } from '../farming/LocalFarmState.js';
import { SeedPouch, type ISeedInventory } from '../farming/SeedPouch.js';
import { SoilRenderer } from '../farming/SoilRenderer.js';
import { InputManager } from '../input/InputManager.js';
import { IsoCamera } from '../isometric/IsoCamera.js';
import { IsoRenderer } from '../isometric/IsoRenderer.js';
import { RenderLayer } from '../rendering/RenderLayers.js';
import { Toolbar } from '../ui/Toolbar.js';

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

  // -- Phase 2: farming layer (new systems on top of Phase 1) ----------------
  private farming!: FarmingSystem;
  private seeds!: ISeedInventory;
  private cropRenderer!: CropRenderer;
  private soilRenderer!: SoilRenderer;
  private farmEffects!: FarmEffects;
  private toolbar!: Toolbar;

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

    // -- farming (Phase 2 layer; Phase 1 systems untouched) --------------------------
    const seedItemIds = CROP_IDS.map((id) => getCropDefinition(id)?.seedItemId ?? `${id}_seed`);
    this.seeds = SeedPouch.withStarterSeeds(seedItemIds);
    this.farming = new FarmingSystem(world, new LocalFarmState(), this.seeds, new SystemClock());
    this.cropRenderer = new CropRenderer(
      world.chunks,
      this.isoRenderer.objectRendererInstance,
      this.farming,
    );
    this.cropRenderer.attach();
    this.soilRenderer = new SoilRenderer(
      this,
      worldManager.coordinates,
      world.chunks,
      this.farming,
    );
    this.soilRenderer.attach();
    this.farmEffects = new FarmEffects(this, worldManager.coordinates);
    // Single-tile refresh proof (§4): soil changes re-resolve ONLY that tile.
    this.farming.events.on('soil-changed', ({ x, y }) => this.isoRenderer.refreshTile(x, y));

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

    // -- toolbar (Phase 2 temporary tool UI) -------------------------------------------
    this.toolbar = new Toolbar(this);
    this.toolbar.layout(this.scale.width, this.scale.height);
    this.toolbar.setSelected(ToolType.None, null);
    this.refreshSeedCounts();
    this.toolbar.events.on('tool-selected', ({ tool, seedId }) => {
      if (tool === ToolType.Seed) {
        this.player.setSeedId(seedId);
      } else {
        this.player.setTool(tool);
      }
      this.toolbar.setSelected(this.player.getTool(), this.player.getSeedId());
      Logger.debug('WorldScene', `tool selected: ${tool}${seedId ? ` (${seedId})` : ''}`);
    });

    // -- debug tools ---------------------------------------------------------------
    const debugCtx: DebugContext = {
      scene: this,
      worldManager,
      gameState: this.context.state,
      player: this.player,
      cameraController: this.cameraController,
      isoRenderer: this.isoRenderer,
      getFarmingDebugLines: () => this.buildFarmingDebugLines(),
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
    this.farming.update();

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
      // Taps on the toolbar belong to the UI, never to the world.
      if (this.toolbar.containsScreenPoint(pos.x, pos.y)) {
        return;
      }
      const tile = this.pickTile(pos.x, pos.y);
      state.setSelectedTile(tile);
      this.updateSelectedHighlight();
      if (tile) {
        this.executeFarmAction(tile);
      }
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
    // Phase 2: the hover diamond previews action validity (white/green/red).
    this.hoverHighlight.setTexture(this.hoverTextureFor(tile));

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

  // -- farming interactions (Phase 2) ----------------------------------------------------

  /** Map the player's tool to a farm action and run it with feedback. */
  private executeFarmAction(tile: TileCoord): void {
    const tool = this.player.getTool();
    let action: FarmAction | null = null;
    let seedId: string | undefined;
    switch (tool) {
      case ToolType.Hoe:
        action = FarmAction.Till;
        break;
      case ToolType.Seed:
        action = FarmAction.Plant;
        seedId = this.player.getSeedId() ?? undefined;
        break;
      case ToolType.WateringCan:
        action = FarmAction.Water;
        break;
      case ToolType.Hand:
        action = FarmAction.Harvest;
        break;
      case ToolType.None:
      default:
        return; // inspect-only: selection highlight is the feedback
    }
    if (action === null) {
      return;
    }
    const result = this.farming.execute(action, tile.x, tile.y, seedId);
    if (result.ok) {
      this.playFarmSuccess(action, tile, result.harvest?.quantity, result.harvest?.cropName);
      this.refreshSeedCounts();
    } else if (result.reason) {
      this.farmEffects.rejectHint(tile.x, tile.y, describeRejectReason(result.reason));
    }
  }

  private playFarmSuccess(
    action: FarmAction,
    tile: TileCoord,
    quantity?: number,
    cropName?: string,
  ): void {
    switch (action) {
      case FarmAction.Till:
        this.farmEffects.tillBurst(tile.x, tile.y);
        break;
      case FarmAction.Plant:
        this.farmEffects.plantPuff(tile.x, tile.y);
        break;
      case FarmAction.Water:
        this.farmEffects.waterDrops(tile.x, tile.y);
        break;
      case FarmAction.Harvest:
        this.farmEffects.harvestBurst(tile.x, tile.y);
        if (quantity !== undefined && cropName !== undefined) {
          this.farmEffects.floatingText(tile.x, tile.y, `+${quantity} ${cropName}`);
        }
        break;
      case FarmAction.Build:
      case FarmAction.Interact:
        break;
    }
  }

  /** Hover diamond texture for the current tool: neutral/valid/invalid. */
  private hoverTextureFor(tile: TileCoord): string {
    const tool = this.player.getTool();
    if (tool === ToolType.None) {
      return 'tile_hover';
    }
    let valid = false;
    switch (tool) {
      case ToolType.Hoe:
        valid = this.farming.canTill(tile.x, tile.y).ok;
        break;
      case ToolType.Seed: {
        const seedId = this.player.getSeedId();
        valid = seedId !== null && this.farming.canPlant(tile.x, tile.y, seedId).ok;
        break;
      }
      case ToolType.WateringCan:
        valid = this.farming.canWater(tile.x, tile.y).ok;
        break;
      case ToolType.Hand:
        valid = this.farming.canHarvest(tile.x, tile.y).ok;
        break;
      default:
        break;
    }
    return valid ? 'tile_valid' : 'tile_invalid';
  }

  private refreshSeedCounts(): void {
    for (const cropId of CROP_IDS) {
      const def = getCropDefinition(cropId);
      if (def) {
        this.toolbar.setSeedCount(cropId, this.seeds.getCount(def.seedItemId));
      }
    }
  }

  private buildFarmingDebugLines(): readonly string[] {
    const tool = this.player.getTool();
    const seedId = this.player.getSeedId();
    const toolText = tool === ToolType.Seed && seedId ? `seed:${seedId}` : tool;
    const counts = CROP_IDS.map((id) => {
      const def = getCropDefinition(id);
      return `${id.slice(0, 1).toUpperCase()}:${def ? this.seeds.getCount(def.seedItemId) : '?'}`;
    }).join(' ');
    const tile = this.context.state.getSelectedTile() ?? this.context.state.getHoverTile();
    if (!tile) {
      return [`farm    tool=${toolText} | seeds ${counts}`, `farm    tile=—`];
    }
    const soil = this.farming.getSoilAt(tile.x, tile.y);
    const crop = this.farming.getCropAt(tile.x, tile.y);
    if (!crop) {
      return [`farm    tool=${toolText} | seeds ${counts}`, `farm    (${tile.x}, ${tile.y}) soil=${soil} crop=—`];
    }
    const def = getCropDefinition(crop.cropId);
    const stages = def ? def.growthStages : '?';
    const ageSec = Math.floor(this.farming.getCropAgeMs(crop) / 1000);
    const stage = this.farming.getCropStage(crop);
    return [
      `farm    tool=${toolText} | seeds ${counts}`,
      `farm    (${tile.x}, ${tile.y}) soil=${soil} water=${crop.watered ? 'yes' : 'no'} crop=${crop.cropId} stage=${stage + 1}/${stages} age=${ageSec}s`,
    ];
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
    this.toolbar.layout(width, height);
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
    this.cropRenderer.detach();
    this.soilRenderer.detach();
    this.toolbar.destroy();
    this.player.destroyView();
    Logger.info('WorldScene', 'shutdown: visuals destroyed, listeners removed');
  }
}
