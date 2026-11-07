/** Translation of: DoorTile.h + DoorTile.cpp (230 LoC) — verbatim
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/DoorTile.{h,cpp}
 *
 * DoorTile uses a 2-block-tall composite data layout: lower block holds dir+open bit,
 * upper block holds isUpper + right-hinge. getCompositeData merges them.
 *
 * Constants from DoorTile.h:
 *   UPPER_BIT = 8 (data bit 3 in upper block)
 *   C_DIR_MASK = 3, C_OPEN_MASK = 4, C_LOWER_DATA_MASK = 7,
 *   C_IS_UPPER_MASK = 8, C_RIGHT_HINGE_MASK = 16
 */

import { Tile, SHAPE_DOOR, RENDERLAYER_ALPHATEST } from './Tile';
import { Material } from '../material/Material';
import { Item } from '../../item/Item';
import { ItemInstance } from '../../item/ItemInstance';
import { AABB, HitResult } from '../../phys/AABB';
import { Vec3 } from '../../phys/Vec3';

export class DoorTile extends Tile {
  static readonly UPPER_BIT = 8;
  static readonly C_DIR_MASK = 3;
  static readonly C_OPEN_MASK = 4;
  static readonly C_LOWER_DATA_MASK = 7;
  static readonly C_IS_UPPER_MASK = 8;
  static readonly C_RIGHT_HINGE_MASK = 16;

  protected doorMaterial: Material;

  constructor(id: number, material: Material) {
    // C++: super(id, material); tex = 1 + 6 * 16; if (material == Material::metal) tex++;
    //      setShape(0.5 - 0.5, 0, 0.5 - 0.5, 0.5 + 0.5, 1.0, 0.5 + 0.5)
    super(id, material);
    this.doorMaterial = material;
    this.tex = 1 + 6 * 16;
    if (material === Material.metal) this.tex++;
    const r = 0.5, h = 1.0;
    this.setShape(0.5 - r, 0, 0.5 - r, 0.5 + r, h, 0.5 + r);
  }

  // DoorTile.cpp:35 — getTexture(level, x, y, z, face)
  getTexture(level: { getData(x: number, y: number, z: number): number }, x: number, y: number, z: number, face: number): number;
  getTexture(face: number): number;
  getTexture(a: number | { getData: (x: number, y: number, z: number) => number }, b?: number, c?: number, d?: number, e?: number): number {
    if (typeof a === 'number') return this.tex;
    const level = a;
    const x = b as number, y = c as number, z = d as number, face = e as number;
    if (face === 0 || face === 1) return this.tex;
    const compositeData = this.getCompositeData(level, x, y, z);
    let texture = this.tex;
    if ((compositeData & DoorTile.C_IS_UPPER_MASK) !== 0) texture -= 16;
    const dir = compositeData & DoorTile.C_DIR_MASK;
    const isOpen = (compositeData & DoorTile.C_OPEN_MASK) !== 0;
    if (isOpen) {
      if (dir === 0 && face === 2) texture = -texture;
      else if (dir === 1 && face === 5) texture = -texture;
      else if (dir === 2 && face === 3) texture = -texture;
      else if (dir === 3 && face === 4) texture = -texture;
    } else {
      if (dir === 0 && face === 5) texture = -texture;
      else if (dir === 1 && face === 3) texture = -texture;
      else if (dir === 2 && face === 4) texture = -texture;
      else if (dir === 3 && face === 2) texture = -texture;
      if ((compositeData & DoorTile.C_RIGHT_HINGE_MASK) !== 0) texture = -texture;
    }
    return texture;
  }

  blocksLight(): boolean { return false; }
  isSolidRender(): boolean { return false; }
  isCubeShaped(): boolean { return false; }
  getRenderShape(): number { return SHAPE_DOOR; }
  getRenderLayer(): number { return RENDERLAYER_ALPHATEST; }

  // DoorTile.cpp:74 — getTileAABB
  getTileAABB(level: unknown, x: number, y: number, z: number): AABB {
    this.updateShape(level as never, x, y, z);
    return super.getTileAABB(level, x, y, z);
  }
  // DoorTile.cpp:78 — getAABB
  getAABB(level: unknown, x: number, y: number, z: number): AABB {
    this.updateShape(level as never, x, y, z);
    return super.getAABB(level, x, y, z);
  }
  // DoorTile.cpp:82 — updateShape
  updateShape(level: { getData(x: number, y: number, z: number): number }, x: number, y: number, z: number): void {
    this.setShapeFromData(this.getCompositeData(level, x, y, z));
  }

  // DoorTile.cpp:86 — setShape(int compositeData) — verbatim
  setShapeFromData(compositeData: number): void {
    const r = 3 / 16.0;
    super.setShape(0, 0, 0, 1, 2, 1);
    const dir = compositeData & DoorTile.C_DIR_MASK;
    const open = (compositeData & DoorTile.C_OPEN_MASK) !== 0;
    const hasRightHinge = (compositeData & DoorTile.C_RIGHT_HINGE_MASK) !== 0;
    if (dir === 0) {
      if (open) {
        if (!hasRightHinge) super.setShape(0, 0, 0, 1, 1, r);
        else super.setShape(0, 0, 1 - r, 1, 1, 1);
      } else super.setShape(0, 0, 0, r, 1, 1);
    } else if (dir === 1) {
      if (open) {
        if (!hasRightHinge) super.setShape(1 - r, 0, 0, 1, 1, 1);
        else super.setShape(0, 0, 0, r, 1, 1);
      } else super.setShape(0, 0, 0, 1, 1, r);
    } else if (dir === 2) {
      if (open) {
        if (!hasRightHinge) super.setShape(0, 0, 1 - r, 1, 1, 1);
        else super.setShape(0, 0, 0, 1, 1, r);
      } else super.setShape(1 - r, 0, 0, 1, 1, 1);
    } else if (dir === 3) {
      if (open) {
        if (!hasRightHinge) super.setShape(0, 0, 0, r, 1, 1);
        else super.setShape(1 - r, 0, 0, 1, 1, 1);
      } else super.setShape(0, 0, 1 - r, 1, 1, 1);
    }
  }

  // DoorTile.cpp:138 — attack → use
  attack(level: unknown, x: number, y: number, z: number, player: unknown): void {
    this.use(level, x, y, z, player as never);
  }

  // DoorTile.cpp:142 — use(level, x, y, z, player) — verbatim
  use(level: {
    getData(x: number, y: number, z: number): number;
    setData(x: number, y: number, z: number, data: number): void;
    setTilesDirty(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): void;
    levelEvent(player: unknown, type: number, x: number, y: number, z: number, data: number): void;
  }, x: number, y: number, z: number, player: unknown): boolean {
    if (this.doorMaterial === Material.metal) return true;
    const compositeData = this.getCompositeData(level as never, x, y, z);
    let lowerData = compositeData & DoorTile.C_LOWER_DATA_MASK;
    lowerData ^= 4;
    if ((compositeData & DoorTile.C_IS_UPPER_MASK) === 0) {
      level.setData(x, y, z, lowerData);
      level.setTilesDirty(x, y, z, x, y, z);
    } else {
      level.setData(x, y - 1, z, lowerData);
      level.setTilesDirty(x, y - 1, z, x, y, z);
    }
    level.levelEvent(player, 1003 /* LevelEvent::SOUND_OPEN_DOOR — deferred */, x, y, z, 0);
    return true;
  }

  // DoorTile.cpp:163 — isOpen
  isOpen(level: { getData(x: number, y: number, z: number): number }, x: number, y: number, z: number): boolean {
    return (this.getCompositeData(level, x, y, z) & DoorTile.C_OPEN_MASK) !== 0;
  }

  // DoorTile.cpp:167 — setOpen(level, x, y, z, shouldOpen) — verbatim
  setOpen(level: {
    getData(x: number, y: number, z: number): number;
    setData(x: number, y: number, z: number, data: number): void;
    setTilesDirty(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): void;
    levelEvent(player: unknown, type: number, x: number, y: number, z: number, data: number): void;
  }, x: number, y: number, z: number, shouldOpen: boolean): void {
    const compositeData = this.getCompositeData(level as never, x, y, z);
    const isOpen = (compositeData & DoorTile.C_OPEN_MASK) !== 0;
    if (isOpen === shouldOpen) return;
    let lowerData = compositeData & DoorTile.C_LOWER_DATA_MASK;
    lowerData ^= 4;
    if ((compositeData & DoorTile.C_IS_UPPER_MASK) === 0) {
      level.setData(x, y, z, lowerData);
      level.setTilesDirty(x, y, z, x, y, z);
    } else {
      level.setData(x, y - 1, z, lowerData);
      level.setTilesDirty(x, y - 1, z, x, y, z);
    }
    level.levelEvent(null, 1003, x, y, z, 0);
  }

  // DoorTile.cpp:187 — neighborChanged — verbatim
  neighborChanged(level: {
    getData(x: number, y: number, z: number): number;
    getTile(x: number, y: number, z: number): number;
    setTile(x: number, y: number, z: number, id: number): boolean;
    isSolidBlockingTile(x: number, y: number, z: number): boolean;
    isClientSide: boolean;
    spawnResources(level: unknown, x: number, y: number, z: number, data: number, odds: number): void;
    hasNeighborSignal(x: number, y: number, z: number): boolean;
  }, x: number, y: number, z: number, type: number): void {
    const data = level.getData(x, y, z);
    if ((data & DoorTile.UPPER_BIT) === 0) {
      let spawn = false;
      if (level.getTile(x, y + 1, z) !== this.id) {
        level.setTile(x, y, z, 0);
        spawn = true;
      }
      if (!level.isSolidBlockingTile(x, y - 1, z)) {
        level.setTile(x, y, z, 0);
        spawn = true;
        if (level.getTile(x, y + 1, z) === this.id) level.setTile(x, y + 1, z, 0);
      }
      if (spawn) {
        if (!level.isClientSide) {
          this.spawnResources(level as never, x, y, z, data, 0);
        }
      } else {
        const signal = level.hasNeighborSignal(x, y, z) || level.hasNeighborSignal(x, y + 1, z);
        // Tile::tiles[type]->isSignalSource() — type 0 means no neighbor.
        // We approximate: any non-zero, non-self type triggers if it's a signal source.
        // Without the Tile registry signal-source lookup, we just use the signal flag.
        if (signal || type === 0) {
          if (type !== this.id) this.setOpen(level as never, x, y, z, signal);
        }
      }
    } else {
      if (level.getTile(x, y - 1, z) !== this.id) {
        level.setTile(x, y, z, 0);
        if (this.doorMaterial === Material.metal) {
          this.popResource(level as never, x, y, z, new ItemInstance(Item.door_iron!, 1, 0));
        } else {
          this.popResource(level as never, x, y, z, new ItemInstance(Item.door_wood!, 1, 0));
        }
      }
      if (type > 0 && type !== this.id) {
        this.neighborChanged(level, x, y - 1, z, type);
      }
    }
  }

  // DoorTile.cpp:224 — getResource
  getResource(data: number, _random: unknown): number {
    if ((data & 8) !== 0) return 0;
    if (this.doorMaterial === Material.metal) return Item.door_iron!.id;
    return Item.door_wood!.id;
  }

  // DoorTile.cpp:229 — clip
  clip(level: { getData(x: number, y: number, z: number): number }, xt: number, yt: number, zt: number, a: Vec3, b: Vec3): HitResult {
    this.updateShape(level, xt, yt, zt);
    return super.clip(level as never, xt, yt, zt, a, b);
  }

  // DoorTile.cpp:236 — getDir
  getDir(level: { getData(x: number, y: number, z: number): number }, x: number, y: number, z: number): number {
    return this.getCompositeData(level, x, y, z) & DoorTile.C_DIR_MASK;
  }

  // DoorTile.cpp:240 — mayPlace(level, x, y, z, face)
  mayPlace(level: {
    isSolidBlockingTile(x: number, y: number, z: number): boolean;
    getTile(x: number, y: number, z: number): number;
  }, x: number, y: number, z: number, _face: number): boolean {
    const DEPTH = 128;
    if (y >= DEPTH - 1) return false;
    return (level.isSolidBlockingTile(x, y - 1, z)
      && this.mayPlaceAt(level, x, y, z)
      && this.mayPlaceAt(level, x, y + 1, z));
  }

  // DoorTile.cpp:248 — getCompositeData(level, x, y, z) — verbatim
  getCompositeData(level: { getData(x: number, y: number, z: number): number }, x: number, y: number, z: number): number {
    const data = level.getData(x, y, z);
    const isUpper = (data & DoorTile.UPPER_BIT) !== 0;
    let lowerData: number, upperData: number;
    if (isUpper) {
      lowerData = level.getData(x, y - 1, z);
      upperData = data;
    } else {
      lowerData = data;
      upperData = level.getData(x, y + 1, z);
    }
    const isRightHinge = (upperData & 1) !== 0;
    return (lowerData & DoorTile.C_LOWER_DATA_MASK) | (isUpper ? 8 : 0) | (isRightHinge ? 16 : 0);
  }
}
