/**
 * Translation of: world/item/ItemInstance.{h,cpp} (subset — constructor + fields)
 *
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/item/ItemInstance.{h,cpp}
 *
 * ItemInstance is the runtime "stack of items" struct: id + count + auxValue
 * (data/damage). Full port needs all 60+ Item subclass methods (useOn, hurt,
 * mineBlock, etc.) — those are deferred until the Item port.
 *
 * Constants & fields preserved 1:1:
 *   - ItemInstance::init(id, count, damage) — sets this.id, this.count, this.auxValue
 *   - ItemInstance(int id, int count, int damage) — calls init
 *   - ItemInstance() — empty (id=0, count=0, auxValue=0 — null item)
 *   - ItemInstance(Tile* tile) — id = tile.id + 256 (Item::items offset)
 *   - ItemInstance(Tile* tile, int count) — same + count
 *   - ItemInstance(Tile* tile, int count, int auxValue) — same + count + aux
 *
 *   The Item-portion of the constructors (Item*) need Item.h port; deferred.
 *
 * Translation of:
 *   - isNull(), setNull()
 *   - getAuxValue(), setAuxValue(int)
 *   - copy() (returns new ItemInstance)
 *   - isStackable() — max stack size > 1
 */

import type { Tile } from '../level/tile/Tile';

export class ItemInstance {
  id = 0;
  count = 0;
  auxValue = 0;

  constructor();
  constructor(tile: Tile);
  constructor(tile: Tile, count: number);
  constructor(tile: Tile, count: number, auxValue: number);
  constructor(id: number, count: number, auxValue: number);
  constructor(a?: Tile | number, b?: number, c?: number) {
    if (a === undefined) {
      // ItemInstance() — null item
      this.init(0, 0, 0);
    } else if (typeof a === 'number') {
      // ItemInstance(int id, int count, int damage)
      this.init(a, b ?? 0, c ?? 0);
    } else {
      // ItemInstance(Tile*) — id = tile.id + 256 (Item::items offset)
      // The +256 offset matches Item.cpp where TileItems are registered at id - 256.
      // (Tile.cpp initTiles line ~258: Item::items[cloth->id] = new ClothTileItem(cloth->id - 256))
      this.init(a.id + 256, b ?? 1, c ?? 0);
    }
  }

  init(id: number, count: number, damage: number): void {
    this.id = id;
    this.count = count;
    this.auxValue = damage;
  }

  isNull(): boolean { return this.id === 0; }
  setNull(): void { this.init(0, 0, 0); }

  getAuxValue(): number { return this.auxValue; }
  setAuxValue(value: number): void { this.auxValue = value; }

  copy(): ItemInstance {
    const out = new ItemInstance();
    out.id = this.id;
    out.count = this.count;
    out.auxValue = this.auxValue;
    return out;
  }

  // Operator == / matches — from ItemInstance.cpp:
  //   bool operator==(const ItemInstance& rhs) { return id == rhs.id && auxValue == rhs.auxValue && count == rhs.count; }
  equals(rhs: ItemInstance): boolean {
    return this.id === rhs.id && this.auxValue === rhs.auxValue && this.count === rhs.count;
  }

  // ItemInstance.cpp isStackable — depends on Item.getMaxStackSize().
  // Default behavior (deferred Item port): stackable up to 64.
  isStackable(): boolean { return this.getMaxStackSize() > 1; }
  getMaxStackSize(): number { return 64; }

  // ItemInstance remove(int count) — returns a new stack with `count` items
  // removed from this one (i.e. this.count -= count, and return new ItemInstance
  // with that count). The C++ version mutates then returns the removed portion.
  remove(count: number): ItemInstance {
    this.count -= count;
    const out = new ItemInstance();
    out.id = this.id;
    out.count = count;
    out.auxValue = this.auxValue;
    return out;
  }
}
