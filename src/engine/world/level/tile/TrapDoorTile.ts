/** Translation of: TrapDoorTile.h + TrapDoorTile.cpp — verbatim
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/TrapDoorTile.{h,cpp}
 */

import { Tile, RENDERLAYER_ALPHATEST } from './Tile';
import { Material } from '../material/Material';
import { Tiles } from './Tiles';
import { Item } from '../../item/Item';
import { ItemInstance } from '../../item/ItemInstance';
import { AABB, HitResult } from '../../phys/AABB';
import { Vec3 } from '../../phys/Vec3';

export class TrapDoorTile extends Tile {
  protected doorMaterial: Material;

  constructor(id: number, material: Material) {
    // C++: super(id, material); tex = 4 + 5 * 16; if (material == Material::metal) tex++;
    //      setShape(0.5 - 0.5, 0, 0.5 - 0.5, 0.5 + 0.5, 1.0, 0.5 + 0.5)
    super(id, material);
    this.doorMaterial = material;
    this.tex = 4 + 5 * 16;
    if (material === Material.metal) this.tex++;
    const r = 0.5, h = 1.0;
    this.setShape(0.5 - r, 0, 0.5 - r, 0.5 + r, h, 0.5 + r);
  }

  blocksLight(): boolean { return false; }
  isSolidRender(): boolean { return false; }
  isCubeShaped(): boolean { return false; }
  getRenderShape(): number { return 0 /* SHAPE_BLOCK */; }
  getRenderLayer(): number { return RENDERLAYER_ALPHATEST; }

  getTileAABB(level: unknown, x: number, y: number, z: number): AABB {
    this.updateShape(level as never, x, y, z);
    return super.getTileAABB(level, x, y, z);
  }
  getAABB(level: unknown, x: number, y: number, z: number): AABB {
    this.updateShape(level as never, x, y, z);
    return super.getAABB(level, x, y, z);
  }
  updateShape(level: { getData(x: number, y: number, z: number): number }, x: number, y: number, z: number): void {
    this.setShapeFromData(level.getData(x, y, z));
  }
  updateDefaultShape(): void {
    const r = 3 / 16.0;
    super.setShape(0, 0.5 - r / 2, 0, 1, 0.5 + r / 2, 1);
  }

  // TrapDoorTile.cpp:54 — setShape(int data) — verbatim
  setShapeFromData(data: number): void {
    const r = 3 / 16.0;
    super.setShape(0, 0, 0, 1, r, 1);
    if (this.isOpen(data)) {
      if ((data & 3) === 0) super.setShape(0, 0, 1 - r, 1, 1, 1);
      if ((data & 3) === 1) super.setShape(0, 0, 0, 1, 1, r);
      if ((data & 3) === 2) super.setShape(1 - r, 0, 0, 1, 1, 1);
      if ((data & 3) === 3) super.setShape(0, 0, 0, r, 1, 1);
    }
  }

  // TrapDoorTile.cpp:68 — attack → use
  attack(level: unknown, x: number, y: number, z: number, player: unknown): void {
    this.use(level, x, y, z, player as never);
  }

  // TrapDoorTile.cpp:72 — use — verbatim
  use(level: { getData(x: number, y: number, z: number): number; setData(x: number, y: number, z: number, data: number): void; levelEvent(player: unknown, type: number, x: number, y: number, z: number, data: number): void }, x: number, y: number, z: number, player: unknown): boolean {
    if (this.doorMaterial === Material.metal) return true;
    const dir = level.getData(x, y, z);
    level.setData(x, y, z, dir ^ 4);
    level.levelEvent(player, 1003 /* SOUND_OPEN_DOOR */, x, y, z, 0);
    return true;
  }

  // TrapDoorTile.cpp:84 — setOpen — verbatim
  setOpen(level: { getData(x: number, y: number, z: number): number; setData(x: number, y: number, z: number, data: number): void; levelEvent(player: unknown, type: number, x: number, y: number, z: number, data: number): void }, x: number, y: number, z: number, shouldOpen: boolean): void {
    const dir = level.getData(x, y, z);
    const wasOpen = (dir & 4) > 0;
    if (wasOpen === shouldOpen) return;
    level.setData(x, y, z, dir ^ 4);
    level.levelEvent(null, 1003, x, y, z, 0);
  }

  // TrapDoorTile.cpp:97 — neighborChanged — verbatim
  neighborChanged(level: {
    isClientSide: boolean;
    getData(x: number, y: number, z: number): number;
    getTile(x: number, y: number, z: number): number;
    setTile(x: number, y: number, z: number, id: number): boolean;
    popResource(level: unknown, x: number, y: number, z: number, itemInstance: unknown): void;
    hasNeighborSignal(x: number, y: number, z: number): boolean;
  }, x: number, y: number, z: number, type: number): void {
    if (level.isClientSide) return;
    const data = level.getData(x, y, z);
    let xt = x, zt = z;
    if ((data & 3) === 0) zt++;
    if ((data & 3) === 1) zt--;
    if ((data & 3) === 2) xt++;
    if ((data & 3) === 3) xt--;
    if (!this.attachesTo(level.getTile(xt, y, zt))) {
      level.setTile(x, y, z, 0);
      this.popResource(level as never, x, y, z, new ItemInstance({ id: this.id + 256, count: 1, auxValue: 0 } as never));
    }
    const signal = level.hasNeighborSignal(x, y, z);
    if (signal || type === 0) {
      this.setOpen(level as never, x, y, z, signal);
    }
  }

  clip(level: { getData(x: number, y: number, z: number): number }, xt: number, yt: number, zt: number, a: Vec3, b: Vec3): HitResult {
    this.updateShape(level, xt, yt, zt);
    return super.clip(level as never, xt, yt, zt, a, b);
  }

  // TrapDoorTile.cpp:124 — getDir(int dir) — verbatim
  getDir(dir: number): number {
    if ((dir & 4) === 0) return ((dir - 1) & 3);
    return (dir & 3);
  }

  // TrapDoorTile.cpp:131 — getPlacedOnFaceDataValue — verbatim
  getPlacedOnFaceDataValue(_level: unknown, _x: number, _y: number, _z: number, face: number, _clickX: number, _clickY: number, _clickZ: number, _itemValue: number): number {
    let dir = 0;
    if (face === 2) dir = 0;
    if (face === 3) dir = 1;
    if (face === 4) dir = 2;
    if (face === 5) dir = 3;
    return dir;
  }

  // TrapDoorTile.cpp:142 — mayPlace — verbatim
  mayPlace(level: { getTile(x: number, y: number, z: number): number }, x: number, y: number, z: number, face: number): boolean {
    if (face === 0) return false;
    if (face === 1) return false;
    if (face === 2) z++;
    if (face === 3) z--;
    if (face === 4) x++;
    if (face === 5) x--;
    return this.attachesTo(level.getTile(x, y, z));
  }

  // TrapDoorTile.cpp:155 — isOpen(int data)
  isOpen(data: number): boolean {
    return (data & 4) !== 0;
  }

  // TrapDoorTile.cpp:159 — attachesTo — verbatim (mod Tile registry walk)
  private attachesTo(id: number): boolean {
    if (id <= 0) return false;
    let tile: Tile | null = null;
    for (const key of Object.keys((globalThis as { __tileRefs?: Record<string, Tile | null> }).__tileRefs ?? {})) {
      const t = (globalThis as { __tileRefs?: Record<string, Tile | null> }).__tileRefs?.[key];
      if (t && t.id === id) { tile = t; break; }
    }
    if (!tile) return false;
    const isStair = tile.getRenderShape() === 10 /* SHAPE_STAIRS */;
    return (tile.material.isSolidBlocking() && tile.isCubeShaped())
      || tile === Tiles.lightGem
      || tile === Tiles.stoneSlabHalf
      || isStair;
  }
}
