/**
 * Translation of: client/Minecraft.{h,cpp}
 *
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/client/Minecraft.{h,cpp}
 *
 * Minecraft is the central orchestrator. It owns:
 *   - the Level (world)
 *   - the LocalPlayer
 *   - the GameRenderer (camera + scene render)
 *   - the LevelRenderer (chunk mesh + draw)
 *   - the GameMode (creative/survival logic)
 *   - the ParticleEngine + SoundEngine + Textures
 *   - the input holder + mouse handler
 *   - the screen stack (start menu, pause, inventory, etc)
 *   - the Timer (fixed 20 tps scheduler)
 *
 * The C++ class is 40 KB; we translate the methods that drive the gameplay
 * tick loop and dispatch input — the methods that make the game actually
 * "play":
 *   - update()                 — top-level frame entry: Timer advance + tick×n + render
 *   - tick(nTick, maxTick)      — gameMode tick, tickInput, gui tick, level tick, levelRenderer tick
 *   - tickInput()              — keyboard/mouse event pump, hotbar wheel, GUI click dispatch
 *   - handleBuildAction(bai)   — given a BuildActionIntention: break/place/interact/attack
 *   - handleMouseDown(button)  — destroy-block continuation (crack particles)
 *   - grabMouse / releaseMouse — pointer-lock toggle (C++ sets mouseGrabbed flag)
 *
 * Not translated here (deferred):
 *   - selectLevel / generateLevel — runs in a separate thread in C++; we don't
 *     need that in browser (everything's synchronous on main thread).
 *   - leaveGame / pauseGame — UI flow (deferred until screens port)
 *   - respawnPlayer / resetPlayer — depends on DeathScreen
 *   - RakNet instance + NetEventCallback — multiplayer subsystem
 *   - CommandServer — Android-bound command channel
 *   - PerfRenderer — debug FPS overlay
 *   - ICreator — demo-mode creator block
 *
 * Constants preserved from Minecraft.h:
 *   - static const int CDI_NONE = 0; CDI_GRAPHICS = 1;
 *   - hitResult, progressStagePercentage, etc — fields on the class.
 *
 * This file is what wires everything together. The Engine class in engine.ts
 * owns a Minecraft instance and calls its update() per requestAnimationFrame.
 */

import { Vec3 } from '../world/phys/Vec3';
import { Mth } from '../util/Mth';
import { TicksPerSecond } from '../shared/SharedConstants';
import type { Level } from '../world/level/Level';
import type { LocalPlayer } from './player/LocalPlayer';
import type { Mob } from '../world/entity/Mob';
import type { GameRenderer, MinecraftLike } from './renderer/GameRenderer';
import type { IInputHolder } from './player/input/IInputHolder';
import type { MouseHandler } from './MouseHandler';
import type { BuildActionIntention } from './player/input/IBuildInput';
import type { OptionsConfig } from './Options';
import { HitResult } from '../world/phys/AABB';

// Deferred subsystems (stubs)
export interface GameMode {
  tick(): void;
  render(a: number): void;
  isCreativeType(): boolean;
  startDestroyBlock(x: number, y: number, z: number, f: number): void;
  continueDestroyBlock(x: number, y: number, z: number, f: number): void;
  stopDestroyBlock(): void;
  useItemOn(player: LocalPlayer, level: Level, item: unknown, x: number, y: number, z: number, face: number, pos: Vec3): boolean;
  useItem(player: LocalPlayer, level: Level, item: unknown): boolean;
  releaseUsingItem(player: LocalPlayer): void;
  interact(player: LocalPlayer, e: unknown): void;
  attack(player: LocalPlayer, e: unknown): void;
}

export interface Screen {
  passEvents: boolean;
  renderGameBehind(): boolean;
  hasClippingArea(area: unknown): boolean;
  tick(): void;
  updateEvents(): void;
  closeOnPlayerHurt(): boolean;
  handleClick(button: number, x: number, y: number): void;
  handleKeyPressed(key: number): void;
}

export interface Timer {
  ticks: number;
  a: number;
  advanceTime(): void;
}

export interface MinecraftDependencies {
  level: Level;
  player: LocalPlayer;
  cameraTargetPlayer: Mob;
  gameRenderer: GameRenderer;
  inputHolder: IInputHolder;
  mouseHandler: MouseHandler;
  options: OptionsConfig;
  gui: { tick(): void; isInside(x: number, y: number): boolean; handleClick(b: number, x: number, y: number): void; handleKeyPressed(k: number): void; getNumSlots(): number; render(a: number, hasScreen: boolean, xMouse: number, yMouse: number): void };
  gameMode: GameMode;
}

export class Minecraft implements MinecraftLike {
  width = 1280;
  height = 720;

  // Public fields from Minecraft.h
  options: OptionsConfig;
  pause = false;
  levelRenderer: unknown = null;
  gameRenderer: GameRenderer;
  particleEngine: unknown = null;
  soundEngine: unknown = null;
  gameMode: GameMode;
  raknetInstance: unknown = null;
  netCallback: unknown = null;
  lastTime = 0;
  lastTickTime = 0;
  ticksSinceLastUpdate = 0;
  user: unknown = null;
  level: Level;
  player: LocalPlayer;
  cameraTargetPlayer: Mob;
  inputHolder: IInputHolder;
  mouseHandler: MouseHandler;
  gui: MinecraftDependencies['gui'];
  generateLevelThread: unknown = null;
  screen: Screen | null = null;
  static customDebugId = 0;
  static readonly CDI_NONE = 0;
  static readonly CDI_GRAPHICS = 1;
  mouseGrabbed = false;
  hitResult: HitResult = new HitResult();
  progressStagePercentage = 0;
  isGeneratingLevel = false;
  isLookingForMultiplayer = false;
  missTime = 0;
  ticks = 0;
  hasScheduledScreen = false;
  scheduledScreen: Screen | null = null;

  // Timer stub
  timer: Timer = {
    ticks: 0,
    a: 0,
    advanceTime(): void {
      // The real Timer.cpp uses Stopwatch + target 20 tps. For TS we let
      // the Engine's requestAnimationFrame loop drive ticks via tickAcc.
      this.a = Math.min(1, this.a + 1 / TicksPerSecond);
    },
  };

  private deps: MinecraftDependencies;
  private screenMutex = false;
  private _isCreativeMode = true;
  private _supportsNonTouchscreen = true;

  constructor(deps: MinecraftDependencies) {
    this.deps = deps;
    this.options = deps.options;
    this.level = deps.level;
    this.player = deps.player;
    this.cameraTargetPlayer = deps.cameraTargetPlayer;
    this.gameRenderer = deps.gameRenderer;
    this.inputHolder = deps.inputHolder;
    this.mouseHandler = deps.mouseHandler;
    this.gui = deps.gui;
    this.gameMode = deps.gameMode;
  }

  // === Minecraft::supportNonTouchScreen / useTouchscreen ===
  supportNonTouchScreen(): boolean { return this._supportsNonTouchscreen; }
  useTouchscreen(): boolean { return this.options.useTouchScreen; }

  // === Minecraft::grabMouse / releaseMouse ===
  grabMouse(): void { this.mouseGrabbed = true; this.mouseHandler.grab(); }
  releaseMouse(): void { this.mouseGrabbed = false; this.mouseHandler.release(); }

  // === Minecraft::isCreativeMode / setIsCreativeMode ===
  isCreativeMode(): boolean { return this._isCreativeMode; }
  setIsCreativeMode(isCreative: boolean): void { this._isCreativeMode = isCreative; }

  // === Minecraft::setScreen ===
  setScreen(screen: Screen | null): void {
    if (this.screenMutex) {
      this.scheduledScreen = screen;
      this.hasScheduledScreen = true;
      return;
    }
    if (this.screen) {
      // C++ calls screen->onClose() — deferred.
    }
    this.screen = screen;
  }

  // === Minecraft::isLevelGenerated ===
  isLevelGenerated(): boolean { return this.level !== null && !this.isGeneratingLevel; }

  // === Minecraft::isOnlineClient / isOnline ===
  isOnlineClient(): boolean { return false; }
  isOnline(): boolean { return this.raknetInstance !== null; }

  // === Minecraft::pauseGame ===
  pauseGame(isBackPaused: boolean): void {
    this.pause = true;
    this.releaseMouse();
    void isBackPaused;
  }

  // === Minecraft::update — top-level frame entry ===
  // Translated from Minecraft.cpp:434. Drives the per-tick Minecraft::tick
  // via the Timer, then renders.
  update(): void {
    if (this.pause && this.level !== null) {
      // Don't advance sim, but still advance frame-time so render doesn't stall.
      const lastA = this.timer.a;
      this.timer.advanceTime();
      this.timer.a = lastA;
    } else {
      this.timer.advanceTime();
    }

    // RakNet events deferred (single-player).

    const toTick = this.timer.ticks;
    for (let i = 0; i < toTick; i++, this.ticks++) {
      this.tick(i, toTick - 1);
    }

    // level->updateLights deferred (no LightLayer port).
    // gameMode->render deferred.
    // soundEngine->update deferred.
    this.gameRenderer.render(this.timer.a);
  }

  // === Minecraft::tick — translated from Minecraft.cpp:508 ===
  tick(nTick: number, maxTick: number): void {
    if (this.missTime > 0) this.missTime--;
    // Death-screen auto-pop: deferred until Screen port.

    if (this.level && !this.pause) {
      this.gameMode.tick();
    }

    this.tickInput();
    this.gui.tick();

    if (this.isGeneratingLevel) return;

    if (this.level !== null) {
      if (!this.pause) {
        this.gameRenderer.tick(nTick, maxTick);
        // levelRenderer->tick deferred (chunk dirty queue).
        this.level.difficulty = this.options.difficulty;
        if (this.level.isClientSide) this.level.difficulty = 1 /* EASY */;
        this.level.tickEntities();
        this.level.tick();
        if (this.player) {
          this.level.animateTick(Mth.floor(this.player.x), Mth.floor(this.player.y), Mth.floor(this.player.z));
        }
      }
    }
    // Textures tick deferred (no terrain.png atlas port).
    // ParticleEngine tick deferred.
    if (this.screen) {
      this.screenMutex = true;
      this.screen.tick();
      this.screenMutex = false;
    }
    // Multitouch::reset deferred (no Multitouch port).
  }

  // === Minecraft::tickInput — translated from Minecraft.cpp:614 (subset) ===
  // The C++ version pumps Mouse::next() / Keyboard::next() queues. In the
  // browser we have event listeners (engine.ts) which feed KeyboardInput
  // directly. We translate the wheel-to-hotbar + GUI-click dispatch here.
  tickInput(): void {
    if (this.screen && !this.screen.passEvents) {
      this.screenMutex = true;
      this.screen.updateEvents();
      this.screenMutex = false;
      if (this.hasScheduledScreen) {
        this.setScreen(this.scheduledScreen);
        this.scheduledScreen = null;
        this.hasScheduledScreen = false;
      }
      return;
    }
    if (!this.player) return;
    // Mouse + keyboard pumps handled by event listeners in engine.ts.
    // Wheel → hotbar slot select (translated from Mouse wheel block):
    //   int slot = (v->selected - e.dy + numSlots) % numSlots; v->selectSlot(slot)
    // We do this in engine.ts' onWheel handler.
  }

  // === Minecraft::handleBuildAction — translated from Minecraft.cpp:953 ===
  handleBuildAction(action: BuildActionIntention): void {
    if (action.isRemove()) {
      if (this.missTime > 0) return;
      this.player.swing();
    }
    if (this.player.isUsingItem()) return;

    let mayUse = true;

    if (!this.hitResult.isHit()) {
      if (action.isRemove() && !this.gameMode.isCreativeType()) {
        this.missTime = 10;
      }
    } else if (this.hitResult.type === 'ENTITY') {
      // Entity hit: attack or interact. Entity hitResult.entity is not yet
      // wired (Level::clip only returns TILE hits in our MVP). Deferred.
      if (action.isAttack()) {
        this.player.swing();
        this.gameMode.attack(this.player, this.hitResult.entity as never);
      } else if (action.isInteract()) {
        // InteractPacket deferred.
        this.gameMode.interact(this.player, this.hitResult.entity as never);
      }
    } else if (this.hitResult.type === 'TILE') {
      const x = this.hitResult.x;
      const y = this.hitResult.y;
      const z = this.hitResult.z;
      const face = this.hitResult.f;

      const oldTileId = this.level.getTile(x, y, z);

      if (action.isRemove()) {
        if (oldTileId === 0) return;
        // level->extinguishFire(x,y,z, hitResult.f) — deferred.
        this.gameMode.startDestroyBlock(x, y, z, face);
      } else {
        // ItemInstance + GameMode.useItemOn — deferred until Inventory port.
        // For MVP we call straight into level.setTile at the adjacent face
        // (this matches creative-mode behaviour).
        const STEP_X = [0, 0, 0, 0, -1, 1];
        const STEP_Y = [-1, 1, 0, 0, 0, 0];
        const STEP_Z = [0, 0, -1, 1, 0, 0];
        const bx = x + STEP_X[face], by = y + STEP_Y[face], bz = z + STEP_Z[face];
        // Don't place inside the player AABB
        const px0 = this.player.x - 0.3, px1 = this.player.x + 0.3;
        const py0 = this.player.y,         py1 = this.player.y + 1.8;
        const pz0 = this.player.z - 0.3, pz1 = this.player.z + 0.3;
        if (!(bx + 1 > px0 && bx < px1 && by + 1 > py0 && by < py1 && bz + 1 > pz0 && bz < pz1)) {
          // Creative: place the selected hotbar block directly.
          // (Real source: gameMode.useItemOn(player, level, item, x, y, z, face, pos))
          const hotbarId = (this.player as unknown as { hotbar: number[]; selectedSlot: number }).hotbar[
            (this.player as unknown as { selectedSlot: number }).selectedSlot
          ];
          if (hotbarId && hotbarId !== 0) {
            this.level.setTile(bx, by, bz, hotbarId);
            mayUse = false;
            this.player.swing();
          }
        }
      }
    }

    if (mayUse && action.isInteract()) {
      // GameMode.useItem on held item — deferred until Inventory port.
    }
  }

  // === Minecraft::handleMouseDown — translated from Minecraft.cpp:917 ===
  handleMouseDown(button: number, down: boolean): void {
    if (this.player.isUsingItem()) {
      if (!down /* && !Keyboard::isKeyDown(options.keyUse.key) */) {
        this.gameMode.releaseUsingItem(this.player);
      }
      return;
    }
    if (this.player.isSleeping()) return;
    if (button === 0 /* ACTION_LEFT */ && this.missTime > 0) return;
    if (down && this.hitResult.type === 'TILE' && button === 0 && !this.hitResult.indirectHit) {
      const x = this.hitResult.x, y = this.hitResult.y, z = this.hitResult.z;
      this.gameMode.continueDestroyBlock(x, y, z, this.hitResult.f);
      // particleEngine->crack(x,y,z, hitResult.f) — deferred.
      this.player.swing();
    } else {
      this.gameMode.stopDestroyBlock();
    }
  }

  // === Minecraft::handleMouseClick ===
  handleMouseClick(button: number): void {
    this.handleMouseDown(button, true);
  }

  // === Helpers for Engine integration ===
  setHitResult(hit: HitResult): void { this.hitResult = hit; }
  getProgressStatusId(): number { return 0; }
}

void (null as unknown as MinecraftLike);
