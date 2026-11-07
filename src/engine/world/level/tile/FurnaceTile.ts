/** Translation of: FurnaceTile.h + FurnaceTile.cpp (175 LoC) — verbatim
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/FurnaceTile.{h,cpp}
 */

import { Tile } from './Tile';
import { Material } from '../material/Material';
import { Mth } from '../../../util/Mth';
import { Facing } from '../../../shared/Facing';
import { Tiles } from './Tiles';
import { solid as Tile_solid } from './Tile';
import { ItemEntity } from '../../entity/item/ItemEntity';
import { ItemInstance } from '../../item/ItemInstance';

export class FurnaceTile extends Tile {
  static noDrop = false;
  protected lit: boolean;

  constructor(id: number, lit: boolean) {
    // C++: super(id, Material::stone); lit(lit); tex = 13 + 16 * 2;
    super(id, Material.stone);
    this.lit = lit;
    this.tex = 13 + 16 * 2;
  }

  // FurnaceTile.cpp:21 — getResource
  getResource(_data: number, _random: unknown): number {
    return Tiles.furnace!.id;
  }

  // FurnaceTile.cpp:27 — onPlace
  onPlace(level: unknown, x: number, y: number, z: number): void {
    super.onPlace(level, x, y, z);
    this.recalcLockDir(level as never, x, y, z);
  }

  // FurnaceTile.cpp:32 — getTexture(level, x, y, z, face) — verbatim
  getTexture(level: { getData(x: number, y: number, z: number): number }, x: number, y: number, z: number, face: number): number;
  getTexture(face: number): number;
  getTexture(a: number | { getData(x: number, y: number, z: number): number }, b?: number, c?: number, d?: number, e?: number): number {
    if (typeof a === 'number') {
      // FurnaceTile.cpp:57 — getTexture(face) — verbatim
      const face = a;
      if (face === 1) return this.tex + 17;
      if (face === 0) return this.tex + 17;
      if (face === 3) return this.tex - 1;
      return this.tex;
    }
    const level = a;
    const x = b as number, y = c as number, z = d as number, face = e as number;
    if (face === 1) return this.tex + 17;
    if (face === 0) return this.tex + 17;
    const lockDir = level.getData(x, y, z);
    if (face !== lockDir) return this.tex;
    if (this.lit) return this.tex + 16;
    return this.tex - 1;
  }

  // FurnaceTile.cpp:67 — animateTick — verbatim
  animateTick(level: {
    getData(x: number, y: number, z: number): number;
    addParticle(id: string, x: number, y: number, z: number, xd: number, yd: number, zd: number): void;
  }, xt: number, yt: number, zt: number, random: { nextFloat(): number }): void {
    if (!this.lit) return;
    const dir = level.getData(xt, yt, zt);
    const x = xt + 0.5;
    const y = yt + 0.0 + random.nextFloat() * 6 / 16.0;
    const z = zt + 0.5;
    const r = 0.52;
    const ss = random.nextFloat() * 0.6 - 0.3;
    if (dir === 4) {
      level.addParticle('smoke', x - r, y, z + ss, 0, 0, 0);
      level.addParticle('flame', x - r, y, z + ss, 0, 0, 0);
    } else if (dir === 5) {
      level.addParticle('smoke', x + r, y, z + ss, 0, 0, 0);
      level.addParticle('flame', x + r, y, z + ss, 0, 0, 0);
    } else if (dir === 2) {
      level.addParticle('smoke', x + ss, y, z - r, 0, 0, 0);
      level.addParticle('flame', x + ss, y, z - r, 0, 0, 0);
    } else if (dir === 3) {
      level.addParticle('smoke', x + ss, y, z + r, 0, 0, 0);
      level.addParticle('flame', x + ss, y, z + r, 0, 0, 0);
    }
  }

  // FurnaceTile.cpp:94 — use — verbatim (mod FurnaceTileEntity access)
  use(level: { isClientSide: boolean; getTileEntity(x: number, y: number, z: number): unknown }, x: number, y: number, z: number, player: { openFurnace(e: unknown): void }): boolean {
    if (level.isClientSide) return true;
    const furnace = level.getTileEntity(x, y, z);
    if (furnace !== null && furnace !== undefined) player.openFurnace(furnace);
    return true;
  }

  // FurnaceTile.cpp:105 — setLit (static in C++)
  static setLit(lit: boolean, level: {
    getData(x: number, y: number, z: number): number;
    setData(x: number, y: number, z: number, data: number): void;
    setTile(x: number, y: number, z: number, id: number): boolean;
    setTileEntity(x: number, y: number, z: number, te: unknown): void;
    getTileEntity(x: number, y: number, z: number): unknown;
  }, x: number, y: number, z: number): void {
    const data = level.getData(x, y, z);
    const te = level.getTileEntity(x, y, z);
    FurnaceTile.noDrop = true;
    if (lit) level.setTile(x, y, z, Tiles.furnace_lit!.id);
    else level.setTile(x, y, z, Tiles.furnace!.id);
    FurnaceTile.noDrop = false;
    level.setData(x, y, z, data);
    if (te !== null && te !== undefined) {
      level.setTileEntity(x, y, z, te);
    }
  }

  // FurnaceTile.cpp:131 — setPlacedBy — verbatim
  setPlacedBy(level: { setData(x: number, y: number, z: number, data: number): void }, x: number, y: number, z: number, by: { yRot: number }): void {
    const dir = (Mth.floor(by.yRot * 4 / 360 + 0.5)) & 3;
    if (dir === 0) level.setData(x, y, z, Facing.NORTH);
    if (dir === 1) level.setData(x, y, z, Facing.EAST);
    if (dir === 2) level.setData(x, y, z, Facing.SOUTH);
    if (dir === 3) level.setData(x, y, z, Facing.WEST);
  }

  // FurnaceTile.cpp:141 — onRemove — verbatim (mod FurnaceTileEntity container access)
  onRemove(level: {
    isClientSide: boolean;
    getTileEntity(x: number, y: number, z: number): { getContainerSize(): number; getItem(i: number): { count: number; id: number; getAuxValue(): number } | null } | null;
    random: { nextFloat(): number; nextInt(n: number): number; nextGaussian(): number };
    addEntity(e: unknown): void;
  }, x: number, y: number, z: number): void {
    if (!FurnaceTile.noDrop && !level.isClientSide) {
      const container = level.getTileEntity(x, y, z);
      if (container) {
        for (let i = 0; i < container.getContainerSize(); i++) {
          const item = container.getItem(i);
          if (item) {
            const xo = level.random.nextFloat() * 0.8 + 0.1;
            const yo = level.random.nextFloat() * 0.8 + 0.1;
            const zo = level.random.nextFloat() * 0.8 + 0.1;
            while (item.count > 0) {
              let count = level.random.nextInt(21) + 10;
              if (count > item.count) count = item.count;
              item.count -= count;
              const itemEntity = new ItemEntity(level as never, x + xo, y + yo, z + zo, new ItemInstance(item.id, count, item.getAuxValue()));
              const pow = 0.05;
              itemEntity.xd = level.random.nextGaussian() * pow;
              itemEntity.yd = level.random.nextGaussian() * pow + 0.2;
              itemEntity.zd = level.random.nextGaussian() * pow;
              level.addEntity(itemEntity);
            }
          }
        }
      }
    }
    super.onRemove(level as never, x, y, z);
  }

  // FurnaceTile.cpp:172 — recalcLockDir — verbatim
  private recalcLockDir(level: {
    isClientSide: boolean;
    getTile(x: number, y: number, z: number): number;
    setData(x: number, y: number, z: number, data: number): void;
  }, x: number, y: number, z: number): void {
    if (level.isClientSide) return;
    const n = level.getTile(x, y, z - 1);
    const s = level.getTile(x, y, z + 1);
    const w = level.getTile(x - 1, y, z);
    const e = level.getTile(x + 1, y, z);
    let lockDir = 3;
    if (Tile_solid[e] && !Tile_solid[w]) lockDir = 4;
    else if (Tile_solid[w] && !Tile_solid[e]) lockDir = 5;
    else if (Tile_solid[s] && !Tile_solid[n]) lockDir = 2;
    else if (Tile_solid[n] && !Tile_solid[s]) lockDir = 3;
    level.setData(x, y, z, lockDir);
  }
}
