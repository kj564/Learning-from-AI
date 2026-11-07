/**
 * VoxelCraft Engine — Main game loop (wired to faithful translations)
 *
 * Iteration 5: the loop now uses Level + LocalPlayer + KeyboardInput +
 * MouseTurnInput + MouseBuildInput + GameRenderer — replacing the old
 * fabricated world.ts + player.ts that were created in iteration 1.
 *
 * The gameplay tick is driven by LocalPlayer.aiStep (which calls Mob::aiStep +
 * Player::aiStep internally — the famous double-call trap). Constants like
 * gravity (0.08), jump (0.42), friction (0.91), water drag (0.80) come straight
 * from the rujukan C++ source via the Entity/Mob/Player translation.
 *
 * Render loop runs on requestAnimationFrame; sim runs on fixed 20 tps
 * (TicksPerSecond from SharedConstants.h).
 *
 * Input wiring:
 *   WASD / Arrows    → KeyboardInput.setKey (KEY_UP/DOWN/LEFT/RIGHT)
 *   Space           → KeyboardInput KEY_JUMP + double-jump toggles flying
 *   LShift          → KeyboardInput KEY_SNEAK
 *   Mouse (locked) → MouseTurnInput.feedDelta → MouseHandler.poll
 *   Left click      → MouseBuildInput BAI_REMOVE | BAI_ATTACK
 *   Right click     → MouseBuildInput BAI_BUILD | BAI_INTERACT
 *   1..9 / Wheel    → hotbar slot select
 *   F               → keyFog (toggle fly in our MVP)
 *   Esc             → exit pointer lock
 *
 * The chunk mesher (chunk-mesh.ts) + renderer (renderer.ts) still drive the
 * actual draw calls — those don't change because they're WebGPU/WebGL2
 * infrastructure, not gameplay logic. Block colors come from TileMVPColor
 * (terrain.png atlas port is iter 6).
 */

import { WebGPURenderer } from './render/renderer';
import { WebGL2Renderer } from './render/webgl2-renderer';
import type { IRenderer } from './render/irenderer';
import { Level } from './world/level/Level';
import { World } from './world/level/world';
import { LocalPlayer } from './client/player/LocalPlayer';
import { KeyboardInput } from './client/player/input/KeyboardInput';
import { MouseTurnInput } from './client/player/input/MouseTurnInput';
import { MouseBuildInput } from './client/player/input/MouseBuildInput';
import { BuildActionIntention } from './client/player/input/IBuildInput';
import { MouseHandler } from './client/MouseHandler';
import { GameRenderer } from './client/renderer/GameRenderer';
import { LevelRenderer } from './client/renderer/LevelRenderer';
import { Minecraft } from './client/Minecraft';
import { CreativeMode } from './client/gamemode/CreativeMode';
import { defaultOptions, KeyMapping, type OptionsConfig } from './client/Options';
import { buildChunkMesh } from './render/chunk-mesh';
import {
  TICK_DT, MAX_TICKS_PER_UPDATE, CHUNK_SIZE, BlockId,
  HOTBAR_SLOTS, DEFAULT_HOTBAR, MOUSE_SENSITIVITY,
} from './core/core-types';
import { initMaterials } from './world/level/material/Material';
import { initTiles } from './world/level/tile/tile-registry';
import { Tiles } from './world/level/tile/Tiles';
import { TicksPerSecond } from './shared/SharedConstants';
import { Mth } from './util/Mth';
import { STEP_X, STEP_Y, STEP_Z } from './shared/Facing';

let registryInit = false;
function ensureRegistry() {
  if (registryInit) return;
  initMaterials();
  initTiles();
  registryInit = true;
}

export interface EngineCallbacks {
  onReady?: (backend: string) => void;
  onSlot?: (slot: number) => void;
  onFlyChange?: (fly: boolean) => void;
}

export class Engine {
  readonly canvas: HTMLCanvasElement;
  renderer: IRenderer;
  world: World;
  level: Level;
  player: LocalPlayer;
  readonly cb: EngineCallbacks;
  options: OptionsConfig;

  private keyboardInput: KeyboardInput;
  private mouseTurnInput: MouseTurnInput;
  private mouseBuildInput: MouseBuildInput;
  private mouseHandler: MouseHandler;
  private gameRenderer: GameRenderer;
  private levelRenderer: LevelRenderer | null = null;
  private minecraft: Minecraft | null = null;
  private gameMode: CreativeMode | null = null;

  private running = false;
  private lastFrameTime = 0;
  private tickAcc = 0;
  private chunksToBuild: Array<{ cx: number; cz: number }> = [];
  private keys = new Set<string>();
  private pointerLocked = false;
  private dirtyChunks: Set<string> = new Set();
  private _lastPartialTick = 0;

  // Block interaction
  private leftMouseDown = false;
  private rightMouseDown = false;
  private breakCooldown = 0;
  private placeCooldown = 0;

  // The current build intention (reused per tick to avoid alloc)
  private bai = new BuildActionIntention();

  constructor(canvas: HTMLCanvasElement, cb: EngineCallbacks = {}) {
    ensureRegistry();
    this.canvas = canvas;
    this.cb = cb;
    this.options = defaultOptions();

    // Renderer pick
    const forceWebGL2 = typeof URLSearchParams !== 'undefined'
      && new URLSearchParams(location.search).get('renderer') === 'webgl2';
    this.renderer = (!forceWebGL2 && typeof navigator !== 'undefined' && !!navigator.gpu)
      ? new WebGPURenderer(canvas)
      : new WebGL2Renderer(canvas);

    // World (storage) + Level (gameplay logic, wraps storage)
    this.world = new World(1337, 4);
    this.level = new Level(this.world, 1337);

    // Input holders
    this.keyboardInput = new KeyboardInput({
      keyUp: keyCode(KeyMapping.keyUp),
      keyDown: keyCode(KeyMapping.keyDown),
      keyLeft: keyCode(KeyMapping.keyLeft),
      keyRight: keyCode(KeyMapping.keyRight),
      keyJump: keyCode(KeyMapping.keyJump),
      keySneak: keyCode(KeyMapping.keySneak),
      keyCraft: keyCode(KeyMapping.keyCraft),
    });
    this.mouseTurnInput = new MouseTurnInput(MouseTurnInput.MODE_DELTA, canvas.width / 2, canvas.height / 2);
    this.mouseBuildInput = new MouseBuildInput();
    this.mouseHandler = new MouseHandler(this.mouseTurnInput);

    // Player (LocalPlayer) — owns the IMoveInput
    this.player = new LocalPlayer(
      { screen: null, options: { isFlying: false }, isOnline: () => false },
      this.level,
      true, // creative
    );
    this.player.input = this.keyboardInput;
    this.player.setLevel(this.level);
    this.level.addEntity(this.player);
    this.level.players.push(this.player);

    // GameRenderer with a Minecraft-like adapter
    this.gameRenderer = new GameRenderer({
      player: this.player,
      cameraTargetPlayer: this.player,
      width: canvas.clientWidth || 1280,
      height: canvas.clientHeight || 720,
      options: {
        sensitivity: this.options.sensitivity,
        viewDistance: this.options.viewDistance,
        bobView: this.options.bobView,
        thirdPersonView: this.options.thirdPersonView,
        fixedCamera: this.options.fixedCamera,
        anaglyph3d: this.options.anaglyph3d,
        invertYMouse: this.options.invertYMouse,
        hideGui: this.options.hideGui,
      },
      mouseGrabbed: false,
      mouseHandler: this.mouseHandler,
      useTouchscreen: () => false,
      isLevelGenerated: () => true,
      screen: null,
      gui: { render: () => {} },
      level: this.level,
    });

    // Position player above terrain — same as MCPE default spawn behavior
    this.player.setPos(8, 80, 8);
    this.player.setRot(0, 0);

    // === Wire up Minecraft orchestrator + LevelRenderer + CreativeMode ===
    // (The Minecraft class dispatches tick + tickInput + handleBuildAction;
    //  LevelRenderer tracks the dirty-chunk queue; CreativeMode owns block
    //  break/place policy.)
    this.gameMode = new CreativeMode({
      level: this.level,
      player: this.player,
      cameraTargetPlayer: this.player,
      gameRenderer: this.gameRenderer,
      inputHolder: { getMoveInput: () => this.keyboardInput, getTurnInput: () => this.mouseTurnInput, getBuildInput: () => this.mouseBuildInput },
      mouseHandler: this.mouseHandler,
      options: this.options,
      gui: {
        tick: () => {},
        isInside: () => false,
        handleClick: () => {},
        handleKeyPressed: () => {},
        getNumSlots: () => HOTBAR_SLOTS + 1,
        render: () => {},
      },
    } as never);

    this.minecraft = new Minecraft({
      level: this.level,
      player: this.player,
      cameraTargetPlayer: this.player,
      gameRenderer: this.gameRenderer,
      inputHolder: { getMoveInput: () => this.keyboardInput, getTurnInput: () => this.mouseTurnInput, getBuildInput: () => this.mouseBuildInput },
      mouseHandler: this.mouseHandler,
      options: this.options,
      gui: {
        tick: () => {},
        isInside: () => false,
        handleClick: () => {},
        handleKeyPressed: () => {},
        getNumSlots: () => HOTBAR_SLOTS + 1,
        render: () => {},
      },
      gameMode: this.gameMode,
    });

    this.levelRenderer = new LevelRenderer({ options: this.options, cameraTargetPlayer: this.player });
    this.levelRenderer.setLevel(this.level, this.world, this.renderer);
  }

  async start(): Promise<boolean> {
    let ok = await this.renderer.init();
    let backend = this.renderer.adapterBackend;
    if (ok && this.renderer instanceof WebGPURenderer) {
      await new Promise((r) => setTimeout(r, 1000));
      if ((this.renderer as WebGPURenderer).deviceLost) {
        console.warn('[VoxelCraft] WebGPU device lost — falling back to WebGL2.');
        ok = false;
      }
    }
    if (!ok && this.renderer instanceof WebGPURenderer) {
      this.renderer.destroy?.();
      const fallback = new WebGL2Renderer(this.canvas);
      ok = await fallback.init();
      if (ok) {
        this.renderer = fallback;
        backend = 'webgl2 (fallback)';
      }
    }
    if (!ok) return false;
    this.cb.onReady?.(backend);
    this.bindEvents();
    this.resize();
    this.lastFrameTime = performance.now();
    this.running = true;
    requestAnimationFrame(this.frame);
    return true;
  }

  stop(): void {
    this.running = false;
    this.unbindEvents();
    this.renderer.destroy();
  }

  private bindEvents(): void {
    this.canvas.addEventListener('click', this.onClick);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    document.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.canvas.addEventListener('mousedown', this.onMouseDown);
    this.canvas.addEventListener('mouseup', this.onMouseUp);
    this.canvas.addEventListener('contextmenu', this.onContextMenu);
    this.canvas.addEventListener('wheel', this.onWheel, { passive: true });
    window.addEventListener('resize', this.resize);
  }

  private unbindEvents(): void {
    this.canvas.removeEventListener('click', this.onClick);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    document.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    this.canvas.removeEventListener('mouseup', this.onMouseUp);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
    this.canvas.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('resize', this.resize);
  }

  private onClick = (): void => {
    if (!this.pointerLocked) this.canvas.requestPointerLock();
  };

  private onPointerLockChange = (): void => {
    this.pointerLocked = document.pointerLockElement === this.canvas;
    if (this.pointerLocked) this.mouseHandler.grab();
    else this.mouseHandler.release();
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.pointerLocked) return;
    this.mouseHandler.feed(e.movementX, e.movementY);
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    this.keys.add(e.code);
    // Forward to KeyboardInput so IMoveInput.tick() can read key flags
    this.keyboardInput.setKey(keyCode(e.code), true);
    if (e.code === 'KeyF') {
      this.options.isFlying = !this.options.isFlying;
      this.player.abilities.flying = this.options.isFlying;
      this.cb.onFlyChange?.(this.player.abilities.flying);
    }
    if (e.code.startsWith('Digit')) {
      const n = parseInt(e.code.slice(5), 10);
      if (n >= 1 && n <= HOTBAR_SLOTS) {
        this.player.selectedSlot = n - 1;
        this.cb.onSlot?.(this.player.selectedSlot);
      }
    }
    if (e.code === 'Escape' && this.pointerLocked) document.exitPointerLock();
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
    this.keyboardInput.setKey(keyCode(e.code), false);
  };

  private onMouseDown = (e: MouseEvent): void => {
    if (!this.pointerLocked) return;
    if (e.button === 0) this.leftMouseDown = true;
    if (e.button === 2) this.rightMouseDown = true;
  };

  private onMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) this.leftMouseDown = false;
    if (e.button === 2) this.rightMouseDown = false;
  };

  private onContextMenu = (e: Event): void => e.preventDefault();

  private onWheel = (e: WheelEvent): void => {
    if (!this.pointerLocked) return;
    const dir = Math.sign(e.deltaY);
    this.player.selectedSlot = (this.player.selectedSlot + dir + HOTBAR_SLOTS) % HOTBAR_SLOTS;
    this.cb.onSlot?.(this.player.selectedSlot);
  };

  private resize = (): void => {
    this.renderer.resize();
    // Sync canvas size into GameRenderer's Minecraft-like adapter so
    // setupCamera's perspective aspect ratio updates on viewport changes.
    const mc = this.gameRenderer as unknown as { mc: { width: number; height: number } };
    if (mc.mc) {
      mc.mc.width = this.canvas.clientWidth;
      mc.mc.height = this.canvas.clientHeight;
    }
  };

  // === Block interaction — uses Mob::pick (the faithful raycast) ===
  private breakBlockNow(): void {
    // Mob::pick(range=5, partialTick=1)
    const hit = this.player.pick(5, 1);
    if (!hit.isHit()) return;
    this.world.setBlock(hit.x, hit.y, hit.z, BlockId.AIR);
    this.markChunkDirty(hit.x, hit.y, hit.z);
    this.breakCooldown = 0.25;
  }

  private placeBlockNow(): void {
    const hit = this.player.pick(5, 1);
    if (!hit.isHit()) return;
    // Place adjacent to hit, on the side of the hit face. The face normal
    // is (STEP_X[hit.f], STEP_Y[hit.f], STEP_Z[hit.f]) from Facing.h.
    const nx = STEP_X[hit.f];
    const ny = STEP_Y[hit.f];
    const nz = STEP_Z[hit.f];
    const bx = hit.x + nx, by = hit.y + ny, bz = hit.z + nz;
    // Don't place inside the player AABB
    const px0 = this.player.x - 0.3, px1 = this.player.x + 0.3;
    const py0 = this.player.y,         py1 = this.player.y + 1.8;
    const pz0 = this.player.z - 0.3, pz1 = this.player.z + 0.3;
    if (bx + 1 > px0 && bx < px1 && by + 1 > py0 && by < py1 && bz + 1 > pz0 && bz < pz1) return;
    this.world.setBlock(bx, by, bz, DEFAULT_HOTBAR[this.player.selectedSlot]);
    this.markChunkDirty(bx, by, bz);
    this.placeCooldown = 0.25;
  }

  private markChunkDirty(wx: number, wy: number, wz: number): void {
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    this.dirtyChunks.add(`${cx},${cz}`);
    const lx = wx - cx * CHUNK_SIZE;
    const lz = wz - cz * CHUNK_SIZE;
    if (lx === 0) this.dirtyChunks.add(`${cx - 1},${cz}`);
    if (lx === CHUNK_SIZE - 1) this.dirtyChunks.add(`${cx + 1},${cz}`);
    if (lz === 0) this.dirtyChunks.add(`${cx},${cz - 1}`);
    if (lz === CHUNK_SIZE - 1) this.dirtyChunks.add(`${cx},${cz + 1}`);
  }

  // === Fixed-timestep tick (20 tps) — delegates to Minecraft::tick + LocalPlayer.tick ===
  tick(): void {
    if (this.minecraft) {
      // Sync mouse grabbed state into Minecraft
      this.minecraft.mouseGrabbed = this.pointerLocked;
    }
    this.mouseBuildInput.setButtonStates(this.leftMouseDown, this.rightMouseDown);

    // Update hitResult via Mob::pick(5, 1) every tick the player is interacting.
    if (this.leftMouseDown || this.rightMouseDown) {
      const hit = this.player.pick(5, 1);
      if (this.minecraft) this.minecraft.setHitResult(hit);
    }

    // Build-action dispatch via Minecraft.handleBuildAction (drives the
    // creative-mode destroy-block path that's translated from CreativeMode.cpp).
    if (this.minecraft && (this.leftMouseDown || this.rightMouseDown)) {
      const has = this.mouseBuildInput.tickBuild(this.player, this.bai);
      if (has) this.minecraft.handleBuildAction(this.bai);
    }

    // Player tick — drives LocalPlayer.tick → Mob::tick → aiStep → travel
    this.player.tick();

    // Apply mouse-turn input → player.turn (in degrees; Mob::turn multiplies by 0.15).
    if (this.pointerLocked) {
      const td = this.mouseTurnInput.getTurnDelta();
      if (td.x !== 0 || td.y !== 0) {
        const ss = this.options.sensitivity * 0.6 + 0.2;
        const sens = ss * ss * ss * 8;
        const xo = td.x * sens * 4;
        const yo = td.y * sens * 4;
        this.player.turn(xo, yo);
      }
    }

    // Level tick (drives time-of-day + sky darken + entity ticks)
    this.level.tick();

    // LevelRenderer.tick (frame counter) + rebuild dirty chunks via updateDirtyChunks.
    if (this.levelRenderer) {
      this.levelRenderer.tick();
      if (this.levelRenderer.isDirty()) {
        this.levelRenderer.updateDirtyChunks(this.player, false);
      }
    }
    void TicksPerSecond; void Mth;
  }

  // === Chunk streaming + meshing ===
  private updateChunkQueue(): void {
    const pcx = Math.floor(this.player.x / CHUNK_SIZE);
    const pcz = Math.floor(this.player.z / CHUNK_SIZE);
    const rd = this.world.renderDistance;
    const wanted: Array<{ cx: number; cz: number; d: number }> = [];
    for (let dx = -rd; dx <= rd; dx++) {
      for (let dz = -rd; dz <= rd; dz++) {
        const cx = pcx + dx, cz = pcz + dz;
        if (!this.renderer.chunkBufferHas(cx, cz)) {
          wanted.push({ cx, cz, d: dx * dx + dz * dz });
        }
      }
    }
    wanted.sort((a, b) => a.d - b.d);
    this.chunksToBuild = wanted.map(w => ({ cx: w.cx, cz: w.cz }));
  }

  private buildOneChunk(): void {
    if (this.dirtyChunks.size > 0) {
      const key = this.dirtyChunks.values().next().value as string;
      this.dirtyChunks.delete(key);
      const [cx, cz] = key.split(',').map(Number);
      this.remeshChunk(cx, cz);
      return;
    }
    if (this.chunksToBuild.length === 0) this.updateChunkQueue();
    if (this.chunksToBuild.length === 0) return;
    const { cx, cz } = this.chunksToBuild.shift()!;
    this.remeshChunk(cx, cz);
  }

  private remeshChunk(cx: number, cz: number): void {
    const chunk = this.world.getChunk(cx, cz);
    const baseX = cx * CHUNK_SIZE, baseZ = cz * CHUNK_SIZE;
    const mesh = buildChunkMesh(chunk, baseX, baseZ, (wx, wy, wz) => this.world.getBlock(wx, wy, wz));
    this.renderer.uploadChunkMesh(cx, cz, mesh);
  }

  // === Main frame ===
  private frame = (now: number): void => {
    if (!this.running) return;
    const dt = now - this.lastFrameTime;
    this.lastFrameTime = now;
    this.tickAcc += dt;
    let ticksThisFrame = 0;
    while (this.tickAcc >= TICK_DT && ticksThisFrame < MAX_TICKS_PER_UPDATE) {
      this.tick();
      this.tickAcc -= TICK_DT;
      ticksThisFrame++;
    }
    if (this.tickAcc > TICK_DT * MAX_TICKS_PER_UPDATE) this.tickAcc = 0;
    this._lastPartialTick = this.tickAcc / TICK_DT;

    this.buildOneChunk();
    this.buildOneChunk();

    // Use GameRenderer's setupCamera (which calls getFov + moveCameraToPlayer +
    // bobView) to produce viewProjMatrix, then hand to the renderer.
    this.gameRenderer.render(this._lastPartialTick);
    this.renderer.setCamera(
      this.player.yRot * Math.PI / 180,
      this.player.xRot * Math.PI / 180,
      this.player.x,
      this.player.y + 1.62,
      this.player.z,
    );
    this.renderer.render();

    requestAnimationFrame(this.frame);
  };
}

// Helper: convert KeyboardEvent.code (e.g. "KeyW") into a numeric key id
// matching KeyboardInput.setKey's lookup (we just store the code as number).
function keyCode(code: string): number {
  // Use a simple hash of the code string so distinct keys map to distinct ids.
  // This is sufficient because KeyboardInput.setKey compares against Options
  // keys (also passed through this same function).
  let h = 0;
  for (let i = 0; i < code.length; i++) h = ((h << 5) - h + code.charCodeAt(i)) | 0;
  return h;
}

void MOUSE_SENSITIVITY; void Tiles;
