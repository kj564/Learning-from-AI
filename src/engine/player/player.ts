/**
 * VoxelCraft Engine — Player + Camera + raycast
 *
 * MVP player state: position (Vec3), yaw/pitch, fly/ground flag.
 * Movement: WASD + space (fly toggle), pointer lock for mouse look.
 *
 * Physics constants here are LITERAL from rujukan source (Mob.cpp::travel,
 * Entity.cpp::jump, Player.cpp). See MODLOG Entry 27 for the full citation:
 *   - GRAVITY = 0.08 (Mob::travel: yd -= 0.08f)
 *   - AIR_DRAG = 0.98 (Mob::travel: yd *= 0.98f in air)
 *   - JUMP_VELOCITY = 0.42 (~1.25 blocks, Entity::jump)
 *   - PLAYER_WALK_SPEED = 0.1 (Player::walkingSpeed)
 *   - PLAYER_FLY_SPEED = 0.3 (Player::flyingSpeed)
 *
 * Iter 4 will replace the per-axis collision here with the literal
 * Entity::move + AABB::clipXCollide/clipYCollide/clipZCollide from the
 * source (already translated in AABB.ts).
 */

import { vec3, type Vec3 } from '../render/math';
import {
  PLAYER_EYE_HEIGHT, PLAYER_HEIGHT, PLAYER_WIDTH, PLAYER_REACH,
  PLAYER_FLY_SPEED, PLAYER_WALK_SPEED, GRAVITY, JUMP_VELOCITY, BlockId, isSolidBlock,
} from '../core/core-types';
import type { World } from '../world/level/world';

export interface RaycastHit {
  x: number; y: number; z: number;
  nx: number; ny: number; nz: number;
  blockId: number;
}

export class Player {
  pos: Vec3 = vec3(8, 80, 8);
  yaw = 0;
  pitch = 0;
  vy = 0;
  onGround = false;
  fly = true;
  selectedSlot = 0;
  hotbar: number[];

  constructor(hotbar: number[]) { this.hotbar = [...hotbar]; }

  // Per-axis sweep with AABB collision against world blocks.
  private moveAxis(dx: number, dy: number, dz: number, world: World): void {
    const halfW = PLAYER_WIDTH / 2;
    if (dx !== 0) {
      const np = { ...this.pos, x: this.pos.x + dx };
      const aabb = { x0: np.x - halfW, x1: np.x + halfW, y0: np.y, y1: np.y + PLAYER_HEIGHT, z0: np.z - halfW, z1: np.z + halfW };
      if (!this.collides(aabb, world)) this.pos.x = np.x;
    }
    if (dz !== 0) {
      const np = { ...this.pos, z: this.pos.z + dz };
      const aabb = { x0: this.pos.x - halfW, x1: this.pos.x + halfW, y0: this.pos.y, y1: this.pos.y + PLAYER_HEIGHT, z0: np.z - halfW, z1: np.z + halfW };
      if (!this.collides(aabb, world)) this.pos.z = np.z;
    }
    if (dy !== 0) {
      const np = { ...this.pos, y: this.pos.y + dy };
      const aabb = { x0: this.pos.x - halfW, x1: this.pos.x + halfW, y0: np.y, y1: np.y + PLAYER_HEIGHT, z0: this.pos.z - halfW, z1: this.pos.z + halfW };
      if (!this.collides(aabb, world)) {
        this.pos.y = np.y;
        if (dy < 0) this.onGround = false;
      } else {
        if (dy < 0) this.onGround = true;
        this.vy = 0;
      }
    }
  }

  private collides(aabb: { x0: number; y0: number; z0: number; x1: number; y1: number; z1: number }, world: World): boolean {
    const x0 = Math.floor(aabb.x0), x1 = Math.floor(aabb.x1);
    const y0 = Math.floor(aabb.y0), y1 = Math.floor(aabb.y1);
    const z0 = Math.floor(aabb.z0), z1 = Math.floor(aabb.z1);
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        for (let z = z0; z <= z1; z++) {
          if (isSolidBlock(world.getBlock(x, y, z))) return true;
        }
      }
    }
    return false;
  }

  applyMovement(forward: number, strafe: number, _jump: boolean, up: boolean, down: boolean, world: World): void {
    const sinY = Math.sin(this.yaw), cosY = Math.cos(this.yaw);
    const dx = -sinY * forward + cosY * strafe;
    const dz = -cosY * forward - sinY * strafe;

    if (this.fly) {
      let dy = 0;
      if (up) dy += 1;
      if (down) dy -= 1;
      this.moveAxis(dx * PLAYER_FLY_SPEED, dy * PLAYER_FLY_SPEED, dz * PLAYER_FLY_SPEED, world);
    } else {
      this.vy -= GRAVITY;
      if (_jump && this.onGround) {
        this.vy = JUMP_VELOCITY;
        this.onGround = false;
      }
      this.moveAxis(dx * PLAYER_WALK_SPEED, this.vy, dz * PLAYER_WALK_SPEED, world);
    }
  }

  raycast(world: World): RaycastHit | null {
    const eye = { x: this.pos.x, y: this.pos.y + PLAYER_EYE_HEIGHT, z: this.pos.z };
    const dir = this.forwardVector();
    let x = Math.floor(eye.x), y = Math.floor(eye.y), z = Math.floor(eye.z);
    const stepX = Math.sign(dir.x), stepY = Math.sign(dir.y), stepZ = Math.sign(dir.z);
    const tDeltaX = stepX !== 0 ? Math.abs(1 / dir.x) : Infinity;
    const tDeltaY = stepY !== 0 ? Math.abs(1 / dir.y) : Infinity;
    const tDeltaZ = stepZ !== 0 ? Math.abs(1 / dir.z) : Infinity;
    let tMaxX = stepX > 0 ? (x + 1 - eye.x) * tDeltaX : (eye.x - x) * tDeltaX;
    let tMaxY = stepY > 0 ? (y + 1 - eye.y) * tDeltaY : (eye.y - y) * tDeltaY;
    let tMaxZ = stepZ > 0 ? (z + 1 - eye.z) * tDeltaZ : (eye.z - z) * tDeltaZ;
    let nx = 0, ny = 0, nz = 0;
    let t = 0;
    while (t <= PLAYER_REACH) {
      const id = world.getBlock(x, y, z);
      if (isSolidBlock(id)) {
        return { x, y, z, nx, ny, nz, blockId: id };
      }
      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        x += stepX; t = tMaxX; tMaxX += tDeltaX; nx = -stepX; ny = 0; nz = 0;
      } else if (tMaxY < tMaxZ) {
        y += stepY; t = tMaxY; tMaxY += tDeltaY; nx = 0; ny = -stepY; nz = 0;
      } else {
        z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; nx = 0; ny = 0; nz = -stepZ;
      }
    }
    return null;
  }

  forwardVector(): Vec3 {
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    return { x: -sy * cp, y: sp, z: -cy * cp };
  }
}
