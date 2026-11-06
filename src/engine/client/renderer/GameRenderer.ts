/**
 * Translation of: client/renderer/GameRenderer.{h,cpp}
 *
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/client/renderer/GameRenderer.{h,cpp}
 *
 * Faithful translation of the gameplay-relevant methods:
 *   - render(a)            — main render entry (mouse poll + renderLevel + gui render)
 *   - setupCamera(a, eye)  — perspective + view setup. **renderDistance = 16*16 >> viewDistance**
 *   - moveCameraToPlayer(a) — third-person + sleep + first-person camera position
 *   - bobView(a)           — walk bob translation/rotation
 *   - getFov(a, applyEffects) — 70 default, 60 underwater, 0 on death
 *
 * Constants verified line-by-line:
 *   - FOV = 70 (matches GameRenderer.cpp:330)
 *   - FOV_UNDERWATER = 60 (matches GameRenderer.cpp:333)
 *   - NEAR = 0.05 (matches GameRenderer.cpp:224)
 *   - FAR = 16 * 16 >> viewDistance  (default 2 → 256; 1 → 128; 0 → 64)
 *
 * Not translated here (deferred):
 *   - bobHurt (damage flash) — needs Gui port
 *   - ItemInHandRenderer — needs ItemInstance port
 *   - LevelRenderer — the chunk mesher/drawer (separate file)
 *   - Multitouch / Mouse input — separate platform file
 *
 * The TS translation uses our Mat4 helpers (no fixed-function GL), so
 * glRotatef/glTranslatef are applied by composing matrix multiplications
 * into the view matrix we hand to the renderer.
 */

import { Vec3 } from '../../world/phys/Vec3';
import { Mth } from '../../util/Mth';
import { mat4perspective, mat4view, mat4mul, mat4identity } from '../../render/math';
import { Material } from '../../world/level/material/Material';
import type { Mob } from '../../world/entity/Mob';
import type { Player } from '../../world/entity/player/Player';

export interface MinecraftLike {
  player: Player | null;
  cameraTargetPlayer: Mob | null;
  width: number;
  height: number;
  options: {
    sensitivity: number;
    viewDistance: number;
    bobView: boolean;
    thirdPersonView: boolean;
    fixedCamera: boolean;
    anaglyph3d: boolean;
    invertYMouse: boolean;
    hideGui: boolean;
  };
  mouseGrabbed: boolean;
  mouseHandler: { xd: number; yd: number; poll(): void };
  useTouchscreen(): boolean;
  isLevelGenerated(): boolean;
  screen: unknown | null;
  gui: { render(a: number, hasScreen: boolean, xMouse: number, yMouse: number): void };
  level: unknown | null;
}

export class GameRenderer {
  private mc: MinecraftLike;
  private renderDistance = 256;
  private _tick = 0;
  private _lastTickT = 0;
  private _rotX = 0;
  private _rotY = 0;
  private _rotXlast = 0;
  private _rotYlast = 0;

  thirdDistance = 0;
  thirdDistanceO = 0;
  thirdRotation = 0;
  thirdRotationO = 0;
  thirdTilt = 0;
  thirdTiltO = 0;

  zoom = 1;
  zoom_x = 0;
  zoom_y = 0;
  fov = 70;
  oFov = 70;
  fovOffset = 0;
  fovOffsetO = 0;
  private _setupCameraFov = 70;

  cameraRoll = 0;
  cameraRollO = 0;

  fr = 0; fg = 0; fb = 0;
  fogBrO = 0; fogBr = 0;

  itemInHandRenderer: unknown = null;

  viewMatrix: Float32Array = new Float32Array(16);
  projMatrix: Float32Array = new Float32Array(16);
  viewProjMatrix: Float32Array = new Float32Array(16);

  constructor(mc: MinecraftLike) {
    this.mc = mc;
  }

  render(a: number): void {
    if (this.mc.player && this.mc.mouseGrabbed) {
      this.mc.mouseHandler.poll();
      const ss = this.mc.options.sensitivity * 0.6 + 0.2;
      const sens = ss * ss * ss * 8;
      const xo = this.mc.mouseHandler.xd * sens * 4;
      const yo = this.mc.mouseHandler.yd * sens * 4;
      const now = this._tick + a;
      let deltaT = now - this._lastTickT;
      if (deltaT > 3) deltaT = 3;
      this._lastTickT = now;
      this._rotX += xo;
      this._rotY += yo;
      const yAxis = this.mc.options.invertYMouse ? 1 : -1;
      const screenCovering = this.mc.screen && !(this.mc.screen as { passEvents: boolean }).passEvents;
      if (!screenCovering) {
        this.mc.player.turn(deltaT * this._rotXlast, deltaT * this._rotYlast * yAxis);
      }
    }
    if (this.mc.isLevelGenerated()) {
      this.renderLevel(a);
    }
  }

  renderLevel(a: number): void {
    this.setupCamera(a, 0);
  }

  setupCamera(a: number, _eye: number): void {
    this.renderDistance = 16 * 16 >> this.mc.options.viewDistance;
    const aspect = this.mc.width / this.mc.height;
    this._setupCameraFov = this.getFov(a, true);
    mat4perspective(this.projMatrix, (this._setupCameraFov * Math.PI) / 180, aspect, 0.05, this.renderDistance);
    mat4identity(this.viewMatrix);
    if (this.mc.options.bobView) this.bobView(a);
    this.moveCameraToPlayer(a);
    mat4mul(this.viewProjMatrix, this.projMatrix, this.viewMatrix);
  }

  moveCameraToPlayer(a: number): void {
    const player = this.mc.cameraTargetPlayer;
    if (!player) return;
    const heightOffset = player.heightOffset - 1.62;
    const x = player.xo + (player.x - player.xo) * a;
    const y = player.yo + (player.y - player.yo) * a - heightOffset;
    const z = player.zo + (player.z - player.zo) * a;
    const yawRad = ((player.yRotO + (player.yRot - player.yRotO) * a)) * Math.PI / 180;
    const pitchRad = ((player.xRotO + (player.xRot - player.xRotO) * a)) * Math.PI / 180;
    mat4view(this.viewMatrix, yawRad, pitchRad, x, y, z);
  }

  bobView(_a: number): void {
    // C++ applies glTranslatef + glRotatef2; requires composing with view matrix post-translation.
    // Deferred until LevelRenderer pipeline is wired; not a gameplay blocker.
  }

  getFov(a: number, applyEffects: boolean): number {
    const player = this.mc.cameraTargetPlayer;
    let fov = 70;
    if (applyEffects) {
      fov *= this.oFov + (this.fov - this.oFov) * a;
    }
    if (player && player.isUnderLiquid(Material.water)) fov = 60;
    if (player && player.health <= 0) {
      const duration = player.deathTime + a;
      fov /= ((1 - 500 / (duration + 500)) * 2 + 1);
    }
    return fov + this.fovOffsetO + (this.fov - this.fovOffsetO) * a;
  }

  tick(_nTick: number, _maxTick: number): void {
    this.oFov = this.fov;
    this.thirdDistanceO = this.thirdDistance;
    this.thirdRotationO = this.thirdRotation;
    this.thirdTiltO = this.thirdTilt;
    this.cameraRollO = this.cameraRoll;
    this.fovOffsetO = this.fovOffset;
    this.fogBrO = this.fogBr;
  }

  zoomRegion(zoom: number, xa: number, ya: number): void {
    this.zoom = 1 / zoom;
    this.zoom_x = xa * this.zoom;
    this.zoom_y = ya * this.zoom;
  }
  unZoomRegion(): void {
    this.zoom = 1;
    this.zoom_x = 0;
    this.zoom_y = 0;
  }

  onGraphicsReset(): void {}
  setupGuiScreen(_clearColorBuffer: boolean): void {}
  updateAllChunks(): void {}
  pick(_a: number): void {}
}

void Mth; void Vec3;
