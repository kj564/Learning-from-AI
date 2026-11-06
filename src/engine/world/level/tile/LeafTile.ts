/** Translation of: LeafTile.h
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/LeafTile.h
 *
 * LeafTile extends TransparentTile (which we'd need to translate too). For
 * now we inline the few TransparentTile properties (allowSame, getRenderLayer,
 * isSolidRender) directly here to avoid another subclass file. We translate
 * the full LeafTile body — including the BFS leaf-decay check in tick().
 */

import { Tile, RENDERLAYER_OPAQUE, RENDERLAYER_ALPHATEST } from './Tile';
import { Material } from '../material/Material';
import { Tiles } from './Tiles';

// We translate TransparentTile.h's relevant fields (allowSame + getRenderLayer)
// inline rather than creating a separate file, since TransparentTile is just a
// thin base for LeafTile + GlassTile. We still need the file for GlassTile:
export class TransparentTile extends Tile {
  protected allowSame = false;

  constructor(id: number, tex: number, material: Material, allowSame: boolean) {
    super(id, tex, material);
    this.allowSame = allowSame;
  }

  // From TransparentTile.cpp: shouldRenderFace calls super::shouldRenderFace
  // and allows render if neighbor is this same tile when allowSame. Deferred.
  isSolidRender(): boolean {
    return !this.allowSame;
  }
}

export class LeafTile extends TransparentTile {
  static readonly LEAF_TYPE_MASK = 3;
  static readonly REQUIRED_WOOD_RANGE = 4;
  // @attn: PERSISTENT_LEAF_BIT and UPDATE_LEAF_BIT are REVERSED vs desktop
  static readonly PERSISTENT_LEAF_BIT = 8; // player-placed
  static readonly UPDATE_LEAF_BIT = 4;
  static readonly NORMAL_LEAF = 0;
  static readonly EVERGREEN_LEAF = 1;
  static readonly BIRCH_LEAF = 2;

  private oTex: number;
  private checkBuffer: Int32Array | null = null;

  constructor(id: number, tex: number) {
    super(id, tex, Material.leaves, false);
    this.oTex = tex;
    this.setTicking(true);
  }

  getRenderLayer(): number {
    return this.isSolidRender() ? RENDERLAYER_OPAQUE : RENDERLAYER_ALPHATEST;
  }

  // C++: int getColor(LevelSource* level, int x, int y, int z) — uses
  // FoliageColor::getEvergreenColor/getBirchColor/getDefaultColor. Deferred.
  getColor(_level: unknown, _x: number, _y: number, _z: number): number {
    return 0x4a8a3b; // approximate default MCPE leaf color
  }

  // C++ onRemove — sets UPDATE_LEAF_BIT on neighbors. Body deferred.

  // C++: int getResource(int data, Random* random) { return Tile::sapling->id; }
  getResource(_data: number, _random: unknown): number {
    return Tiles.sapling!.id;
  }

  // C++: int getResourceCount(Random* random) { return random->nextInt(20) == 0 ? 1 : 0; }
  getResourceCount(random: { nextInt(n: number): number }): number {
    return random.nextInt(20) === 0 ? 1 : 0;
  }

  isSolidRender(): boolean {
    return !this.allowSame;
  }

  // C++: int getTexture(int face, int data)
  getTexture(face: number, data: number): number;
  getTexture(face: number): number;
  getTexture(face: number, data?: number): number {
    if (data !== undefined && (data & LeafTile.LEAF_TYPE_MASK) === LeafTile.EVERGREEN_LEAF) {
      return (this === Tiles.leaves) ? this.tex + 5 * 16 : this.tex - 16;
    }
    return this.tex;
  }

  // C++: void setFancy(bool fancyGraphics) — body faithful:
  setFancy(fancyGraphics: boolean): void {
    this.allowSame = fancyGraphics;
    this.tex = this.oTex + (fancyGraphics ? 0 : 1);
  }

  protected getSpawnResourcesAuxValue(data: number): number {
    return data & LeafTile.LEAF_TYPE_MASK;
  }

  // The full BFS tick() body — translated verbatim.
  tick(level: {
    isClientSide: boolean;
    getData(x: number, y: number, z: number): number;
    setDataNoUpdate(x: number, y: number, z: number, data: number): void;
    hasChunksAt(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): boolean;
    getTile(x: number, y: number, z: number): number;
    setTile(x: number, y: number, z: number, id: number): void;
  }, x: number, y: number, z: number, _random: unknown): void {
    if (level.isClientSide) return;
    const currentData = level.getData(x, y, z);
    if ((currentData & LeafTile.UPDATE_LEAF_BIT) !== 0 && (currentData & LeafTile.PERSISTENT_LEAF_BIT) === 0) {
      const r = LeafTile.REQUIRED_WOOD_RANGE;
      const r2 = r + 1;
      const W = 32;
      const WW = W * W;
      const WO = W / 2;
      if (!this.checkBuffer) {
        this.checkBuffer = new Int32Array(W * W * W);
      }
      if (level.hasChunksAt(x - r2, y - r2, z - r2, x + r2, y + r2, z + r2)) {
        for (let xo = -r; xo <= r; xo++)
          for (let yo = -r; yo <= r; yo++)
            for (let zo = -r; zo <= r; zo++) {
              const t = level.getTile(x + xo, y + yo, z + zo);
              if (t === Tiles.treeTrunk!.id) {
                this.checkBuffer[(xo + WO) * WW + (yo + WO) * W + (zo + WO)] = 0;
              } else if (t === Tiles.leaves!.id) {
                this.checkBuffer[(xo + WO) * WW + (yo + WO) * W + (zo + WO)] = -2;
              } else {
                this.checkBuffer[(xo + WO) * WW + (yo + WO) * W + (zo + WO)] = -1;
              }
            }
        for (let i = 1; i <= LeafTile.REQUIRED_WOOD_RANGE; i++) {
          for (let xo = -r; xo <= r; xo++)
            for (let yo = -r; yo <= r; yo++)
              for (let zo = -r; zo <= r; zo++) {
                const idx = (xo + WO) * WW + (yo + WO) * W + (zo + WO);
                if (this.checkBuffer[idx] === i - 1) {
                  const left = (xo + WO - 1) * WW + (yo + WO) * W + (zo + WO);
                  if (this.checkBuffer[left] === -2) this.checkBuffer[left] = i;
                  const right = (xo + WO + 1) * WW + (yo + WO) * W + (zo + WO);
                  if (this.checkBuffer[right] === -2) this.checkBuffer[right] = i;
                  const down = (xo + WO) * WW + (yo + WO - 1) * W + (zo + WO);
                  if (this.checkBuffer[down] === -2) this.checkBuffer[down] = i;
                  const up = (xo + WO) * WW + (yo + WO + 1) * W + (zo + WO);
                  if (this.checkBuffer[up] === -2) this.checkBuffer[up] = i;
                  const north = (xo + WO) * WW + (yo + WO) * W + (zo + WO - 1);
                  if (this.checkBuffer[north] === -2) this.checkBuffer[north] = i;
                  const south = (xo + WO) * WW + (yo + WO) * W + (zo + WO + 1);
                  if (this.checkBuffer[south] === -2) this.checkBuffer[south] = i;
                }
              }
        }
      }
      const mid = this.checkBuffer[WO * WW + WO * W + WO];
      if (mid >= 0) {
        level.setDataNoUpdate(x, y, z, currentData & ~LeafTile.UPDATE_LEAF_BIT);
      } else {
        this.die(level, x, y, z);
      }
    }
  }

  private die(level: {
    getData(x: number, y: number, z: number): number;
    setTile(x: number, y: number, z: number, id: number): void;
  }, x: number, y: number, z: number): void {
    this.spawnResources(level as never, x, y, z, level.getData(x, y, z) & LeafTile.LEAF_TYPE_MASK, 0);
    level.setTile(x, y, z, 0);
  }
}
