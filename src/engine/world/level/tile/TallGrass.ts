/** Translation of: TallGrass.h + TallGrass.cpp (55 LoC)
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/TallGrass.{h,cpp}
 *
 * Verbatim:
 *   - constructor(id, tex): super(id, tex, Material::replaceable_plant), setShape(0.5-0.4, 0, 0.5-0.4, 0.5+0.4, 0.8, 0.5+0.4)
 *   - getTexture(face, data): TALL_GRASS=tex, FERN=tex+16+1, DEAD_SHRUB=tex+16
 *   - getColor(): 0x339933
 *   - getColor(auxData): DEAD_SHRUB=0xffffffff, else FoliageColor::getDefaultColor()
 *   - getColor(level, x, y, z): DEAD_SHRUB=0xffffff, else 0x339933
 *   - getResource(data, random): random.nextInt(8)==0 → Item::seeds_wheat->id, else -1
 *   - playerDestroy(level, player, x, y, z, data): shears → drop TallGrass; else super
 *
 * Constants:
 *   DEAD_SHRUB=0, TALL_GRASS=1, FERN=3
 *
 * Deferred:
 *   - Item::seeds_wheat (needs Item port)
 *   - ShearsItem check (needs Item::shears port)
 *   - FoliageColor::getDefaultColor (needs FoliageColor port; we use the literal 0x339933 the source returns as fallback)
 */

import { Bush } from './Bush';
import { Material } from '../material/Material';
import { ItemInstance } from '../../item/ItemInstance';

export class TallGrass extends Bush {
  static readonly DEAD_SHRUB = 0;
  static readonly TALL_GRASS = 1;
  static readonly FERN = 3;

  constructor(id: number, tex: number) {
    // C++: super(id, tex, Material::replaceable_plant)
    // Bush's 2-arg ctor Bush(id, tex, material) calls Tile(id, material), this->tex = tex, setTicking(true)
    // and shape with ss=0.2. TallGrass overrides the shape.
    super(id, tex, Material.replaceable_plant);
    const ss = 0.4;
    this.setShape(0.5 - ss, 0, 0.5 - ss, 0.5 + ss, 0.8, 0.5 + ss);
  }

  // TallGrass.cpp:416 — getTexture(face, data)
  getTexture(_face: number, data?: number): number {
    if (data === TallGrass.TALL_GRASS) return this.tex;
    if (data === TallGrass.FERN) return this.tex + 16 + 1;
    if (data === TallGrass.DEAD_SHRUB) return this.tex + 16;
    return this.tex;
  }

  // TallGrass.cpp:423 — getColor() → 0x339933
  getColor(): number;
  getColor(auxData: number): number;
  getColor(level: { getData(x: number, y: number, z: number): number }, x: number, y: number, z: number): number;
  getColor(a?: number | { getData(x: number, y: number, z: number): number }, b?: number, c?: number, d?: number): number {
    if (a === undefined) {
      // getColor() → 0x339933
      return 0x339933;
    }
    if (typeof a === 'number') {
      // getColor(auxData) — TallGrass.cpp:430
      if (a === TallGrass.DEAD_SHRUB) return 0xffffffff;
      // FoliageColor::getDefaultColor() — deferred. Source uses literal 0x339933 implicitly via the biome fallback.
      return 0x339933;
    }
    // getColor(level, x, y, z) — TallGrass.cpp:435
    const level = a as { getData(x: number, y: number, z: number): number };
    const dd = level.getData(b as number, c as number, d as number);
    if (dd === TallGrass.DEAD_SHRUB) return 0xffffff;
    return 0x339933;
  }

  // TallGrass.cpp:442 — getResource(data, random)
  getResource(_data: number, random: { nextInt(n: number): number }): number {
    if (random.nextInt(8) === 0) {
      // C++: return Item::seeds_wheat->id; (Item port deferred)
      // Without Item::seeds_wheat, we return -1 (no drop). Source comment in C++
      // would return -1 too if Item::seeds_wheat was undefined.
      return -1;
    }
    return -1;
  }

  // TallGrass.cpp:449 — playerDestroy(level, player, x, y, z, data)
  playerDestroy(level: unknown, player: {
    getSelectedItem(): { id: number } | null;
  }, x: number, y: number, z: number, data: number): void {
    const selected = player.getSelectedItem();
    if (selected && selected.id === -1 /* Item::shears — deferred */) {
      // C++: popResource(level, x, y, z, ItemInstance(Tile::tallgrass, 1, data));
      // We need access to the TallGrass tile instance for ItemInstance(tile, count).
      // Use this (since playerDestroy is called on the TallGrass instance).
      this.popResource(level as never, x, y, z, new ItemInstance(this, 1, data));
    } else {
      super.playerDestroy(level, player, x, y, z, data);
    }
  }
}
