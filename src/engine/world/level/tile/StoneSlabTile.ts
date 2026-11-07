/** Translation of: StoneSlabTile.h + StoneSlabTile.cpp (155 LoC)
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/StoneSlabTile.{h,cpp}
 *
 * Verbatim translation of every method:
 *   - SLAB_NAMES[] = {"stone", "sand", "wood", "cobble", "brick", "smoothStoneBrick"}
 *   - constructor(id, fullSize): Tile(id, 6, Material::stone), setShape(0,0,0,1,0.5,1) if !fullSize, setLightBlock(255)
 *   - updateShape(level, x, y, z): fullSize → (0,0,0,1,1,1); else upper → (0,0.5,0,1,1,1), lower → (0,0,0,1,0.5,1)
 *   - updateDefaultShape: same minus getData check
 *   - getTexture(face, data): slab-type-dependent texture lookup (harfiah table)
 *   - isSolidRender(): return fullSize
 *   - getPlacedOnFaceDataValue: TOP_SLOT_BIT logic
 *   - getResource: Tile::stoneSlabHalf->id
 *   - getResourceCount: fullSize=2, half=1
 *   - isCubeShaped: return fullSize
 *   - addAABBs: updateShape + super
 *   - shouldRenderFace: slab-top/bottom + adjacent-slab-aware culling
 *   - getSpawnResourcesAuxValue: data & TYPE_MASK
 */

import { Tile } from './Tile';
import { Material } from '../material/Material';
import { Tiles } from './Tiles';
import { Facing, STEP_X, STEP_Y, STEP_Z, OPPOSITE_FACING } from '../../../shared/Facing';
import type { AABB } from '../../phys/AABB';

export class StoneSlabTile extends Tile {
  static readonly SLAB_NAMES = ['stone', 'sand', 'wood', 'cobble', 'brick', 'smoothStoneBrick'];
  static readonly SLAB_NAMES_COUNT = StoneSlabTile.SLAB_NAMES.length;

  static readonly STONE_SLAB = 0;
  static readonly SAND_SLAB = 1;
  static readonly WOOD_SLAB = 2;
  static readonly COBBLESTONE_SLAB = 3;
  static readonly BRICK_SLAB = 4;
  static readonly SMOOTHBRICK_SLAB = 5;

  static readonly TYPE_MASK = 7;
  static readonly TOP_SLOT_BIT = 8;

  protected fullSize: boolean;

  constructor(id: number, fullSize: boolean) {
    // C++: Tile(id, 6, Material::stone); this->fullSize = fullSize;
    //      if (!fullSize) setShape(0, 0, 0, 1, 0.5, 1);
    //      setLightBlock(255);
    super(id, 6, Material.stone);
    this.fullSize = fullSize;
    if (!fullSize) this.setShape(0, 0, 0, 1, 0.5, 1);
    this.setLightBlock(255);
  }

  // StoneSlabTile.cpp:484 — updateShape(level, x, y, z)
  updateShape(level: { getData(x: number, y: number, z: number): number }, x: number, y: number, z: number): void {
    if (this.fullSize) {
      this.setShape(0, 0, 0, 1, 1, 1);
    } else {
      const upper = (level.getData(x, y, z) & StoneSlabTile.TOP_SLOT_BIT) !== 0;
      if (upper) {
        this.setShape(0, 0.5, 0, 1, 1, 1);
      } else {
        this.setShape(0, 0, 0, 1, 0.5, 1);
      }
    }
  }

  // StoneSlabTile.cpp:498 — updateDefaultShape
  updateDefaultShape(): void {
    if (this.fullSize) {
      this.setShape(0, 0, 0, 1, 1, 1);
    } else {
      this.setShape(0, 0, 0, 1, 0.5, 1);
    }
  }

  // StoneSlabTile.cpp:507 — getTexture(face, data)
  getTexture(face: number, data?: number): number {
    const d = (data ?? 0) & StoneSlabTile.TYPE_MASK;
    if (d === StoneSlabTile.STONE_SLAB) {
      if (face <= 1) return 6;
      return 5;
    }
    if (d === StoneSlabTile.SAND_SLAB) {
      if (face === Facing.DOWN) return 13 * 16;
      if (face === Facing.UP) return 11 * 16;
      return 12 * 16;
    }
    if (d === StoneSlabTile.WOOD_SLAB) return 4;
    if (d === StoneSlabTile.COBBLESTONE_SLAB) return 16;
    if (d === StoneSlabTile.BRICK_SLAB) return Tiles.redBrick!.tex;
    if (d === StoneSlabTile.SMOOTHBRICK_SLAB) return Tiles.stoneBrickSmooth!.tex;
    return 6;
  }

  // StoneSlabTile.cpp:532 — isSolidRender
  isSolidRender(): boolean { return this.fullSize; }

  // StoneSlabTile.cpp:536 — getPlacedOnFaceDataValue(level, x, y, z, face, clickX, clickY, clickZ, itemValue)
  getPlacedOnFaceDataValue(_level: unknown, _x: number, _y: number, _z: number, face: number, _clickX: number, clickY: number, _clickZ: number, itemValue: number): number {
    if (this.fullSize) return itemValue;
    if (face === Facing.DOWN || (face !== Facing.UP && clickY > 0.5)) {
      return itemValue | StoneSlabTile.TOP_SLOT_BIT;
    }
    return itemValue;
  }

  // StoneSlabTile.cpp:565 — getResource(data, random)
  getResource(_data: number, _random: unknown): number {
    return Tiles.stoneSlabHalf!.id;
  }

  // StoneSlabTile.cpp:569 — getResourceCount(random)
  getResourceCount(_random: unknown): number {
    return this.fullSize ? 2 : 1;
  }

  // StoneSlabTile.cpp:576 — isCubeShaped
  isCubeShaped(): boolean { return this.fullSize; }

  // StoneSlabTile.cpp:580 — addAABBs(level, x, y, z, box, boxes)
  addAABBs(level: { getData(x: number, y: number, z: number): number }, x: number, y: number, z: number, box: AABB | null, boxes: AABB[]): void {
    this.updateShape(level, x, y, z);
    super.addAABBs(level as never, x, y, z, box, boxes);
  }

  // StoneSlabTile.cpp:585 — isHalfSlab(tileId) helper (file-static in C++)
  private isHalfSlab(tileId: number): boolean {
    return Tiles.stoneSlabHalf !== null && tileId === Tiles.stoneSlabHalf.id;
  }

  // StoneSlabTile.cpp:589 — shouldRenderFace(level, x, y, z, face) — verbatim
  shouldRenderFace(level: {
    getData(x: number, y: number, z: number): number;
    getTile(x: number, y: number, z: number): number;
  }, x: number, y: number, z: number, face: number): boolean {
    if (this.fullSize) return super.shouldRenderFace(level as never, x, y, z, face);
    if (face !== Facing.UP && face !== Facing.DOWN && !super.shouldRenderFace(level as never, x, y, z, face)) {
      return false;
    }
    let ox = x, oy = y, oz = z;
    ox += STEP_X[OPPOSITE_FACING[face]];
    oy += STEP_Y[OPPOSITE_FACING[face]];
    oz += STEP_Z[OPPOSITE_FACING[face]];
    const isUpper = (level.getData(ox, oy, oz) & StoneSlabTile.TOP_SLOT_BIT) !== 0;
    if (isUpper) {
      if (face === Facing.DOWN) return true;
      if (face === Facing.UP && super.shouldRenderFace(level as never, x, y, z, face)) return true;
      return !(this.isHalfSlab(level.getTile(x, y, z)) && (level.getData(x, y, z) & StoneSlabTile.TOP_SLOT_BIT) !== 0);
    } else {
      if (face === Facing.UP) return true;
      if (face === Facing.DOWN && super.shouldRenderFace(level as never, x, y, z, face)) return true;
      return !(this.isHalfSlab(level.getTile(x, y, z)) && (level.getData(x, y, z) & StoneSlabTile.TOP_SLOT_BIT) === 0);
    }
  }

  // StoneSlabTile.cpp:614 — getSpawnResourcesAuxValue(data)
  protected getSpawnResourcesAuxValue(data: number): number {
    return data & StoneSlabTile.TYPE_MASK;
  }
}
