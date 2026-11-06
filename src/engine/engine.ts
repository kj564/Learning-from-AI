/**
 * VoxelCraft Engine — Main game loop
 *
 * Wires together: WebGPU/WebGL2 renderer + World + Player + chunk meshing
 * + input. Render loop on requestAnimationFrame; sim on fixed 20 tps
 * (TicksPerSecond from SharedConstants.h).
 *
 * Block palette: the hotbar uses BlockId constants from the Tile registry.
 * Each block placement / break mutates the World and re-meshes the affected
 * chunk + neighbors (so face culling updates correctly across chunk seams).
 */

import { WebGPURenderer } from './render/renderer';
import { WebGL2Renderer } from './render/webgl2-renderer';
import type { IRenderer } from './render/irenderer';
import { World } from './world/level/world';
import { Player } from './player/player';
import { buildChunkMesh } from './render/chunk-mesh';
import {
  TICK_DT, MAX_TICKS_PER_UPDATE, CHUNK_SIZE, BlockId,
  HOTBAR_SLOTS, DEFAULT_HOTBAR, MOUSE_SENSITIVITY,
} from './core/core-types';

// Ensure Tile registry is initialized before the engine boots.
import { initMaterials } from './world/level/material/Material';
import { initTiles } from './world/level/tile/tile-registry';

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
  readonly world: World;
  readonly player: Player;
  readonly cb: EngineCallbacks;

  private running = false;
  private lastFrameTime = 0;
  private tickAcc = 0;
  private chunksToBuild: Array<{ cx: number; cz: number }> = [];
  private keys = new Set<string>();
  private pointerLocked = false;
  private dirtyChunks: Set<string> = new Set();

  private leftMouseDown = false;
  private rightMouseDown = false;
  private breakCooldown = 0;
  private placeCooldown = 0;

  constructor(canvas: HTMLCanvasElement, cb: EngineCallbacks = {}) {
    ensureRegistry();
    this.canvas = canvas;
    this.cb = cb;
    const forceWebGL2 = typeof URLSearchParams !== 'undefined'
      && new URLSearchParams(location.search).get('renderer') === 'webgl2';
    this.renderer = (!forceWebGL2 && typeof navigator !== 'undefined' && !!navigator.gpu)
      ? new WebGPURenderer(canvas)
      : new WebGL2Renderer(canvas);
    this.world = new World(1337, 4);
    this.player = new Player(DEFAULT_HOTBAR);
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
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.pointerLocked) return;
    const sens = (MOUSE_SENSITIVITY * Math.PI) / 180;
    this.player.yaw -= e.movementX * sens;
    this.player.pitch -= e.movementY * sens;
    const lim = Math.PI / 2 - 0.01;
    this.player.pitch = Math.max(-lim, Math.min(lim, this.player.pitch));
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    this.keys.add(e.code);
    if (e.code === 'KeyF') {
      this.player.fly = !this.player.fly;
      this.cb.onFlyChange?.(this.player.fly);
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

  private onKeyUp = (e: KeyboardEvent): void => { this.keys.delete(e.code); };

  private onMouseDown = (e: MouseEvent): void => {
    if (!this.pointerLocked) return;
    if (e.button === 0) { this.leftMouseDown = true; this.breakBlockNow(); }
    if (e.button === 2) { this.rightMouseDown = true; this.placeBlockNow(); }
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

  private resize = (): void => { this.renderer.resize(); };

  private breakBlockNow(): void {
    const hit = this.player.raycast(this.world);
    if (!hit) return;
    this.world.setBlock(hit.x, hit.y, hit.z, BlockId.AIR);
    this.markChunkDirty(hit.x, hit.y, hit.z);
    this.breakCooldown = 0.25;
  }

  private placeBlockNow(): void {
    const hit = this.player.raycast(this.world);
    if (!hit) return;
    const bx = hit.x + hit.nx, by = hit.y + hit.ny, bz = hit.z + hit.nz;
    const px0 = this.player.pos.x - 0.3, px1 = this.player.pos.x + 0.3;
    const py0 = this.player.pos.y,         py1 = this.player.pos.y + 1.8;
    const pz0 = this.player.pos.z - 0.3, pz1 = this.player.pos.z + 0.3;
    if (bx + 1 > px0 && bx < px1 && by + 1 > py0 && by < py1 && bz + 1 > pz0 && bz < pz1) return;
    this.world.setBlock(bx, by, bz, this.player.hotbar[this.player.selectedSlot]);
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

  tick(): void {
    let forward = 0, strafe = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) forward += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) forward -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) strafe += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) strafe -= 1;
    const jump = this.keys.has('Space');
    const up = this.keys.has('Space');
    const down = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    this.player.applyMovement(forward, strafe, jump, up, down && this.player.fly, this.world);

    this.breakCooldown -= TICK_DT / 1000;
    this.placeCooldown -= TICK_DT / 1000;
    if (this.leftMouseDown && this.breakCooldown <= 0) this.breakBlockNow();
    if (this.rightMouseDown && this.placeCooldown <= 0) this.placeBlockNow();
  }

  private updateChunkQueue(): void {
    const pcx = Math.floor(this.player.pos.x / CHUNK_SIZE);
    const pcz = Math.floor(this.player.pos.z / CHUNK_SIZE);
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

    this.buildOneChunk();
    this.buildOneChunk();

    this.renderer.setCamera(this.player.yaw, this.player.pitch, this.player.pos.x, this.player.pos.y + 1.62, this.player.pos.z);
    this.renderer.render();

    requestAnimationFrame(this.frame);
  };
}
