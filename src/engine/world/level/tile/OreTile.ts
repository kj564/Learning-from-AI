/** Translation of: OreTile.h
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/OreTile.h
 */
import { Tile } from './Tile';
import { Material } from '../material/Material';
import { Tiles } from './Tiles';
import { Item } from '../../item/Item';

export class OreTile extends Tile {
  constructor(id: number, tex: number) {
    super(id, tex, Material.stone);
  }

  // C++: int getResource(int data, Random* random) {
  //   if (id == Tile::coalOre->id) return Item::coal->id;
  //   if (id == Tile::emeraldOre->id) return Item::emerald->id;
  //   if (id == Tile::lapisOre->id) return Item::dye_powder->id;
  //   return id;
  // }
  // Item::coal/emerald/dye_powder deferred until Item port. For MVP return id.
  getResource(_data: number, _random: unknown): number {
    if (this.id === Tiles.coalOre!.id) return Item.coal!.id;
    if (this.id === Tiles.emeraldOre!.id) return Item.emerald!.id;
    if (this.id === Tiles.lapisOre!.id) return Item.dye_powder!.id;
    return this.id;
  }

  // C++: int getResourceCount(Random* random) {
  //   if (id == Tile::lapisOre->id) return 4 + random->nextInt(5);
  //   return 1;
  // }
  getResourceCount(random: { nextInt(n: number): number }): number {
    if (this.id === Tiles.lapisOre!.id) return 4 + random.nextInt(5);
    return 1;
  }

  // C++: int getSpawnResourcesAuxValue(int data) {
  //   if (id == Tile::lapisOre->id) return DyePowderItem::BLUE;
  //   return 0;
  // }
  // DyePowderItem::BLUE not ported yet. Return 0.
  protected getSpawnResourcesAuxValue(_data: number): number {
    if (this.id === Tiles.lapisOre!.id) return 4; // DyePowderItem::BLUE
    return 0;
  }
}
