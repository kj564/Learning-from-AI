/**
 * Translation of: world/item/Item.h + Item.cpp (Tier constants + initItems)
 *
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/item/Item.{h,cpp}
 *
 * This is the Item registry — 100+ item types registered in initItems().
 * Item ids are 256+ (Tile ids are 0-255, Item ids are 256+; they share a
 * single id space via the static items[] array indexed up to MAX_ITEMS=512).
 *
 * Constants from Item.cpp:
 *   MAX_STACK_SIZE = 64
 *   MAX_ITEMS = 512
 *   ICON_COLUMNS = 16
 *   ICON_DESCRIPTION_PREFIX = "item."
 *
 * Tier constants (Item.cpp:11-15) — verbatim:
 *   WOOD  = (level=0, uses=59, speed=2, damage=0)
 *   STONE = (1, 131, 4, 1)
 *   IRON  = (2, 250, 6, 2)
 *   EMERALD = (3, 1561, 8, 3)
 *   GOLD  = (0, 32, 12, 0)
 *
 * initItems() body — verbatim translation of every line.
 *   - Many subclass Items need their own constructor (FoodItem, WeaponItem, etc.)
 *     which are deferred until each subclass file is translated. For MVP we
 *     register the base Item for everything and let subclass files override.
 */

export class ItemTier {
  constructor(
    public readonly level: number,
    public readonly uses: number,
    public readonly speed: number,
    public readonly damage: number,
  ) {}

  getUses(): number { return this.uses; }
  getSpeed(): number { return this.speed; }
  getAttackDamageBonus(): number { return this.damage; }
  getLevel(): number { return this.level; }
}

// From Item.cpp:11-15 — verbatim
export const Tier = {
  WOOD: new ItemTier(0, 59, 2, 0),
  STONE: new ItemTier(1, 131, 4, 1),
  IRON: new ItemTier(2, 250, 6, 2),
  EMERALD: new ItemTier(3, 1561, 8, 3),
  GOLD: new ItemTier(0, 32, 12, 0),
} as const;

export class Item {
  static readonly MAX_STACK_SIZE = 64;
  static readonly MAX_ITEMS = 512;
  static readonly ICON_COLUMNS = 16;
  static readonly ICON_DESCRIPTION_PREFIX = 'item.';

  static items: (Item | null)[] = new Array(Item.MAX_ITEMS).fill(null);

  // Static refs — populated by initItems()
  static shovel_iron: Item | null = null;
  static pickAxe_iron: Item | null = null;
  static hatchet_iron: Item | null = null;
  static flintAndSteel: Item | null = null;
  static apple: Item | null = null;
  static bow: Item | null = null;
  static arrow: Item | null = null;
  static coal: Item | null = null;
  static emerald: Item | null = null;
  static ironIngot: Item | null = null;
  static goldIngot: Item | null = null;
  static sword_iron: Item | null = null;
  static sword_wood: Item | null = null;
  static shovel_wood: Item | null = null;
  static pickAxe_wood: Item | null = null;
  static hatchet_wood: Item | null = null;
  static sword_stone: Item | null = null;
  static shovel_stone: Item | null = null;
  static pickAxe_stone: Item | null = null;
  static hatchet_stone: Item | null = null;
  static sword_emerald: Item | null = null;
  static shovel_emerald: Item | null = null;
  static pickAxe_emerald: Item | null = null;
  static hatchet_emerald: Item | null = null;
  static stick: Item | null = null;
  static bowl: Item | null = null;
  static mushroomStew: Item | null = null;
  static sword_gold: Item | null = null;
  static shovel_gold: Item | null = null;
  static pickAxe_gold: Item | null = null;
  static hatchet_gold: Item | null = null;
  static string: Item | null = null;
  static feather: Item | null = null;
  static sulphur: Item | null = null;
  static hoe_wood: Item | null = null;
  static hoe_stone: Item | null = null;
  static hoe_iron: Item | null = null;
  static hoe_emerald: Item | null = null;
  static hoe_gold: Item | null = null;
  static seeds_wheat: Item | null = null;
  static wheat: Item | null = null;
  static bread: Item | null = null;
  static helmet_cloth: Item | null = null;
  static chestplate_cloth: Item | null = null;
  static leggings_cloth: Item | null = null;
  static boots_cloth: Item | null = null;
  static helmet_chain: Item | null = null;
  static chestplate_chain: Item | null = null;
  static leggings_chain: Item | null = null;
  static boots_chain: Item | null = null;
  static helmet_iron: Item | null = null;
  static chestplate_iron: Item | null = null;
  static leggings_iron: Item | null = null;
  static boots_iron: Item | null = null;
  static helmet_diamond: Item | null = null;
  static chestplate_diamond: Item | null = null;
  static leggings_diamond: Item | null = null;
  static boots_diamond: Item | null = null;
  static helmet_gold: Item | null = null;
  static chestplate_gold: Item | null = null;
  static leggings_gold: Item | null = null;
  static boots_gold: Item | null = null;
  static flint: Item | null = null;
  static porkChop_raw: Item | null = null;
  static porkChop_cooked: Item | null = null;
  static painting: Item | null = null;
  static sign: Item | null = null;
  static door_wood: Item | null = null;
  static door_iron: Item | null = null;
  static snowBall: Item | null = null;
  static leather: Item | null = null;
  static brick: Item | null = null;
  static clay: Item | null = null;
  static reeds: Item | null = null;
  static paper: Item | null = null;
  static book: Item | null = null;
  static slimeBall: Item | null = null;
  static egg: Item | null = null;
  static compass: Item | null = null;
  static clock: Item | null = null;
  static yellowDust: Item | null = null;
  static dye_powder: Item | null = null;
  static bone: Item | null = null;
  static sugar: Item | null = null;
  static bed: Item | null = null;
  static shears: Item | null = null;
  static melon: Item | null = null;
  static seeds_melon: Item | null = null;
  static beef_raw: Item | null = null;
  static beef_cooked: Item | null = null;
  static chicken_raw: Item | null = null;
  static chicken_cooked: Item | null = null;
  static netherbrick: Item | null = null;
  static netherQuartz: Item | null = null;
  static camera: Item | null = null;

  readonly id: number;
  maxDamage: number;
  icon = 0;
  category = -1;
  protected maxStackSize = Item.MAX_STACK_SIZE;
  protected _handEquipped = false;
  protected _isStackedByData = false;
  protected craftingRemainingItem: Item | null = null;
  protected descriptionId = '';

  constructor(id: number) {
    // C++: id(256 + id) — Item ids are offset by 256 from the constructor arg
    this.id = 256 + id;
    this.maxDamage = 32;
    if (Item.items[this.id] !== null) {
      console.warn(`Item conflict id @ ${this.id}! Id already used`);
    }
    Item.items[this.id] = this;
  }

  setIcon(icon: number): this;
  setIcon(column: number, row: number): this;
  setIcon(a: number, b?: number): this {
    if (b === undefined) {
      this.icon = a;
    } else {
      this.icon = a + b * Item.ICON_COLUMNS;
    }
    return this;
  }

  setMaxStackSize(max: number): this { this.maxStackSize = max; return this; }
  canBeDepleted(): boolean { return this.maxDamage > 0 && !this._isStackedByData; }
  getIcon(_auxValue?: number): number { return this.icon; }

  useOn(_itemInstance: unknown, _level: unknown, _x: number, _y: number, _z: number, _face: number): boolean { return false; }
  useOnFull(_itemInstance: unknown, _player: unknown, _level: unknown, _x: number, _y: number, _z: number, _face: number, _clickX: number, _clickY: number, _clickZ: number): boolean { return false; }

  getUseDuration(_itemInstance: unknown): number { return 0; }
  useTimeDepleted(itemInstance: unknown, _level: unknown, _player: unknown): unknown { return itemInstance; }
  getDestroySpeed(_itemInstance: unknown, _tile: unknown): number { return 1; }
  use(itemInstance: unknown, _level: unknown, _player: unknown): unknown { return itemInstance; }
  getMaxStackSize(): number { return this.maxStackSize; }
  getLevelDataForAuxValue(_auxValue: number): number { return 0; }
  isStackedByData(): boolean { return this._isStackedByData; }
  setCategory(category: number): this { this.category = category; return this; }
  getMaxDamage(): number { return this.maxDamage; }
  hurtEnemy(_itemInstance: unknown, _mob: unknown): void {}
  mineBlock(_itemInstance: unknown, _tile: number, _x: number, _y: number, _z: number): boolean { return false; }
  getAttackDamage(_entity: unknown): number { return 1; }
  canDestroySpecial(_tile: unknown): boolean { return false; }
  interactEnemy(_itemInstance: unknown, _mob: unknown): void {}
  handEquipped(): this { this._handEquipped = true; return this; }
  isHandEquipped(): boolean { return this._handEquipped; }
  isMirroredArt(): boolean { return false; }
  isFood(): boolean { return false; }
  isArmor(): boolean { return false; }
  setDescriptionId(id: string): this { this.descriptionId = Item.ICON_DESCRIPTION_PREFIX + id; return this; }
  getDescription(): string { return this.descriptionId; }
  getDescriptionId(): string { return this.descriptionId; }
  getName(): string { return this.descriptionId + '.name'; }
  setCraftingRemainingItem(item: Item): this {
    if (this.maxStackSize > 1) console.warn('Max stack size must be 1 for items with crafting results');
    this.craftingRemainingItem = item;
    return this;
  }
  getCraftingRemainingItem(): Item | null { return this.craftingRemainingItem; }
  hasCraftingRemainingItem(): boolean { return this.craftingRemainingItem !== null; }
  releaseUsing(_itemInstance: unknown, _level: unknown, _player: unknown, _durationLeft: number): void {}
  getUseAnimation(): string { return 'none'; }

  protected setStackedByData(isStackedByData: boolean): this {
    this._isStackedByData = isStackedByData;
    return this;
  }
  protected setMaxDamage(maxDamage: number): this {
    this.maxDamage = maxDamage;
    return this;
  }

  static initItems(): void {
    // Verbatim translation of Item.cpp initItems().
    // All subclass constructors (FoodItem, WeaponItem, etc.) are deferred
    // until their .cpp files are translated — we use base Item for now.
    // The id arg passed to Item constructor is offset by 256 internally.
    const ItemCategory = { Structures: 1, Tools: 2, FoodArmor: 4, Decorations: 8, Mechanisms: 16 };

    Item.shovel_iron = new Item(0).setIcon(2, 5).setCategory(ItemCategory.Tools).setDescriptionId('shovelIron');
    Item.pickAxe_iron = new Item(1).setIcon(2, 6).setCategory(ItemCategory.Tools).setDescriptionId('pickaxeIron');
    Item.hatchet_iron = new Item(2).setIcon(2, 7).setCategory(ItemCategory.Tools).setDescriptionId('hatchetIron');
    Item.flintAndSteel = new Item(3).setIcon(5, 0).setCategory(ItemCategory.Tools).setDescriptionId('flintAndSteel');
    Item.apple = new Item(4).setIcon(10, 0).setCategory(ItemCategory.FoodArmor).setDescriptionId('apple');
    Item.bow = new Item(5).setIcon(5, 1).setCategory(ItemCategory.Tools).setDescriptionId('bow');
    Item.arrow = new Item(6).setIcon(5, 2).setCategory(ItemCategory.Tools).setDescriptionId('arrow');
    Item.coal = new Item(7).setIcon(7, 0).setCategory(ItemCategory.Tools).setDescriptionId('coal');
    Item.emerald = new Item(8).setIcon(7, 3).setCategory(ItemCategory.Decorations).setDescriptionId('emerald');
    Item.ironIngot = new Item(9).setIcon(7, 1).setCategory(ItemCategory.Decorations).setDescriptionId('ingotIron');
    Item.goldIngot = new Item(10).setIcon(7, 2).setCategory(ItemCategory.Decorations).setDescriptionId('ingotGold');
    Item.sword_iron = new Item(11).setIcon(2, 4).setCategory(ItemCategory.Tools).setDescriptionId('swordIron');
    Item.sword_wood = new Item(12).setIcon(0, 4).setCategory(ItemCategory.Tools).setDescriptionId('swordWood');
    Item.shovel_wood = new Item(13).setIcon(0, 5).setCategory(ItemCategory.Tools).setDescriptionId('shovelWood');
    Item.pickAxe_wood = new Item(14).setIcon(0, 6).setCategory(ItemCategory.Tools).setDescriptionId('pickaxeWood');
    Item.hatchet_wood = new Item(15).setIcon(0, 7).setCategory(ItemCategory.Tools).setDescriptionId('hatchetWood');
    Item.sword_stone = new Item(16).setIcon(1, 4).setCategory(ItemCategory.Tools).setDescriptionId('swordStone');
    Item.shovel_stone = new Item(17).setIcon(1, 5).setCategory(ItemCategory.Tools).setDescriptionId('shovelStone');
    Item.pickAxe_stone = new Item(18).setIcon(1, 6).setCategory(ItemCategory.Tools).setDescriptionId('pickaxeStone');
    Item.hatchet_stone = new Item(19).setIcon(1, 7).setCategory(ItemCategory.Tools).setDescriptionId('hatchetStone');
    Item.sword_emerald = new Item(20).setIcon(3, 4).setCategory(ItemCategory.Tools).setDescriptionId('swordDiamond');
    Item.shovel_emerald = new Item(21).setIcon(3, 5).setCategory(ItemCategory.Tools).setDescriptionId('shovelDiamond');
    Item.pickAxe_emerald = new Item(22).setIcon(3, 6).setCategory(ItemCategory.Tools).setDescriptionId('pickaxeDiamond');
    Item.hatchet_emerald = new Item(23).setIcon(3, 7).setCategory(ItemCategory.Tools).setDescriptionId('hatchetDiamond');
    Item.stick = new Item(24).setIcon(5, 3).handEquipped().setCategory(ItemCategory.Structures).setDescriptionId('stick');
    Item.bowl = new Item(25).setIcon(7, 4).setCategory(ItemCategory.FoodArmor).setDescriptionId('bowl');
    Item.mushroomStew = new Item(26).setIcon(8, 4).setCategory(ItemCategory.FoodArmor).setDescriptionId('mushroomStew');
    Item.sword_gold = new Item(27).setIcon(4, 4).setCategory(ItemCategory.Tools).setDescriptionId('swordGold');
    Item.shovel_gold = new Item(28).setIcon(4, 5).setCategory(ItemCategory.Tools).setDescriptionId('shovelGold');
    Item.pickAxe_gold = new Item(29).setIcon(4, 6).setCategory(ItemCategory.Tools).setDescriptionId('pickaxeGold');
    Item.hatchet_gold = new Item(30).setIcon(4, 7).setCategory(ItemCategory.Tools).setDescriptionId('hatchetGold');
    Item.string = new Item(31).setIcon(8, 0).setCategory(ItemCategory.Tools).setDescriptionId('string');
    Item.feather = new Item(32).setIcon(8, 1).setCategory(ItemCategory.Tools).setDescriptionId('feather');
    Item.sulphur = new Item(33).setIcon(8, 2).setCategory(ItemCategory.Tools).setDescriptionId('sulphur');
    Item.hoe_wood = new Item(34).setIcon(0, 8).setCategory(ItemCategory.Tools).setDescriptionId('hoeWood');
    Item.hoe_stone = new Item(35).setIcon(1, 8).setCategory(ItemCategory.Tools).setDescriptionId('hoeStone');
    Item.hoe_iron = new Item(36).setIcon(2, 8).setCategory(ItemCategory.Tools).setDescriptionId('hoeIron');
    Item.hoe_emerald = new Item(37).setIcon(3, 8).setCategory(ItemCategory.Tools).setDescriptionId('hoeDiamond');
    Item.hoe_gold = new Item(38).setIcon(4, 8).setCategory(ItemCategory.Tools).setDescriptionId('hoeGold');
    Item.seeds_wheat = new Item(39).setIcon(9, 0).setCategory(ItemCategory.FoodArmor).setDescriptionId('seeds');
    Item.wheat = new Item(40).setIcon(9, 1).setCategory(ItemCategory.FoodArmor).setDescriptionId('wheat');
    Item.bread = new Item(41).setIcon(9, 2).setCategory(ItemCategory.FoodArmor).setDescriptionId('bread');

    Item.helmet_cloth = new Item(42).setIcon(0, 0).setCategory(ItemCategory.FoodArmor).setDescriptionId('helmetCloth');
    Item.chestplate_cloth = new Item(43).setIcon(0, 1).setCategory(ItemCategory.FoodArmor).setDescriptionId('chestplateCloth');
    Item.leggings_cloth = new Item(44).setIcon(0, 2).setCategory(ItemCategory.FoodArmor).setDescriptionId('leggingsCloth');
    Item.boots_cloth = new Item(45).setIcon(0, 3).setCategory(ItemCategory.FoodArmor).setDescriptionId('bootsCloth');

    Item.helmet_chain = new Item(46).setIcon(1, 0).setCategory(ItemCategory.FoodArmor).setDescriptionId('helmetChain');
    Item.chestplate_chain = new Item(47).setIcon(1, 1).setCategory(ItemCategory.FoodArmor).setDescriptionId('chestplateChain');
    Item.leggings_chain = new Item(48).setIcon(1, 2).setCategory(ItemCategory.FoodArmor).setDescriptionId('leggingsChain');
    Item.boots_chain = new Item(49).setIcon(1, 3).setCategory(ItemCategory.FoodArmor).setDescriptionId('bootsChain');

    Item.helmet_iron = new Item(50).setIcon(2, 0).setCategory(ItemCategory.FoodArmor).setDescriptionId('helmetIron');
    Item.chestplate_iron = new Item(51).setIcon(2, 1).setCategory(ItemCategory.FoodArmor).setDescriptionId('chestplateIron');
    Item.leggings_iron = new Item(52).setIcon(2, 2).setCategory(ItemCategory.FoodArmor).setDescriptionId('leggingsIron');
    Item.boots_iron = new Item(53).setIcon(2, 3).setCategory(ItemCategory.FoodArmor).setDescriptionId('bootsIron');

    Item.helmet_diamond = new Item(54).setIcon(3, 0).setCategory(ItemCategory.FoodArmor).setDescriptionId('helmetDiamond');
    Item.chestplate_diamond = new Item(55).setIcon(3, 1).setCategory(ItemCategory.FoodArmor).setDescriptionId('chestplateDiamond');
    Item.leggings_diamond = new Item(56).setIcon(3, 2).setCategory(ItemCategory.FoodArmor).setDescriptionId('leggingsDiamond');
    Item.boots_diamond = new Item(57).setIcon(3, 3).setCategory(ItemCategory.FoodArmor).setDescriptionId('bootsDiamond');

    Item.helmet_gold = new Item(58).setIcon(4, 0).setCategory(ItemCategory.FoodArmor).setDescriptionId('helmetGold');
    Item.chestplate_gold = new Item(59).setIcon(4, 1).setCategory(ItemCategory.FoodArmor).setDescriptionId('chestplateGold');
    Item.leggings_gold = new Item(60).setIcon(4, 2).setCategory(ItemCategory.FoodArmor).setDescriptionId('leggingsGold');
    Item.boots_gold = new Item(61).setIcon(4, 3).setCategory(ItemCategory.FoodArmor).setDescriptionId('bootsGold');

    Item.flint = new Item(62).setIcon(6, 0).setCategory(ItemCategory.Tools).setDescriptionId('flint');
    Item.porkChop_raw = new Item(63).setIcon(7, 5).setCategory(ItemCategory.FoodArmor).setDescriptionId('porkchopRaw');
    Item.porkChop_cooked = new Item(64).setIcon(8, 5).setCategory(ItemCategory.FoodArmor).setDescriptionId('porkchopCooked');
    Item.painting = new Item(65).setIcon(10, 1).setCategory(ItemCategory.Decorations).setDescriptionId('painting');
    Item.sign = new Item(67).setIcon(10, 2).setCategory(ItemCategory.Decorations).setDescriptionId('sign');
    Item.door_wood = new Item(68).setIcon(11, 2).setCategory(ItemCategory.Structures).setDescriptionId('doorWood');
    Item.door_iron = new Item(74).setIcon(12, 2).setCategory(ItemCategory.Structures).setDescriptionId('doorIron');
    Item.snowBall = new Item(76).setIcon(14, 0).setCategory(ItemCategory.Decorations).setDescriptionId('snowball');
    Item.leather = new Item(78).setIcon(7, 6).setCategory(ItemCategory.Tools).setDescriptionId('leather');
    Item.brick = new Item(80).setIcon(6, 1).setCategory(ItemCategory.Structures).setDescriptionId('brick');
    Item.clay = new Item(81).setIcon(9, 3).setCategory(ItemCategory.Structures).setDescriptionId('clay');
    Item.reeds = new Item(82).setIcon(11, 1).setCategory(ItemCategory.FoodArmor).setDescriptionId('reeds');
    Item.paper = new Item(83).setIcon(10, 3).setCategory(ItemCategory.Decorations).setDescriptionId('paper');
    Item.book = new Item(84).setIcon(11, 3).setCategory(ItemCategory.Decorations).setDescriptionId('book');
    Item.slimeBall = new Item(85).setIcon(14, 1).setCategory(ItemCategory.Decorations).setDescriptionId('slimeball');
    Item.egg = new Item(88).setIcon(12, 0).setCategory(ItemCategory.FoodArmor).setDescriptionId('egg');
    Item.compass = new Item(89).setIcon(6, 3).setCategory(ItemCategory.Tools).setDescriptionId('compass');
    Item.clock = new Item(91).setIcon(6, 4).setCategory(ItemCategory.Tools).setDescriptionId('clock');
    Item.yellowDust = new Item(92).setIcon(9, 4).setCategory(ItemCategory.Tools).setDescriptionId('yellowDust');
    Item.dye_powder = new Item(95).setIcon(14, 4).setCategory(ItemCategory.Decorations).setDescriptionId('dyePowder');
    Item.bone = new Item(96).setIcon(12, 1).setCategory(ItemCategory.Tools).setDescriptionId('bone').handEquipped();
    Item.sugar = new Item(97).setIcon(13, 0).setCategory(ItemCategory.FoodArmor).setDescriptionId('sugar').handEquipped();
    Item.bed = new Item(99).setMaxStackSize(1).setIcon(13, 2).setCategory(ItemCategory.Structures).setDescriptionId('bed');
    Item.shears = new Item(103).setIcon(13, 5).setCategory(ItemCategory.Tools).setDescriptionId('shears');
    Item.melon = new Item(104).setIcon(13, 6).setCategory(ItemCategory.FoodArmor).setDescriptionId('melon');
    Item.seeds_melon = new Item(106).setIcon(14, 3).setCategory(ItemCategory.FoodArmor).setDescriptionId('seedsMelon');
    Item.beef_raw = new Item(107).setIcon(9, 6).setCategory(ItemCategory.FoodArmor).setDescriptionId('beefRaw');
    Item.beef_cooked = new Item(108).setIcon(10, 6).setCategory(ItemCategory.FoodArmor).setDescriptionId('beefCooked');
    Item.chicken_raw = new Item(109).setIcon(9, 7).setCategory(ItemCategory.FoodArmor).setDescriptionId('chickenRaw');
    Item.chicken_cooked = new Item(110).setIcon(10, 7).setCategory(ItemCategory.FoodArmor).setDescriptionId('chickenCooked');

    Item.netherbrick = new Item(149).setIcon(5, 9).setDescriptionId('netherbrickItem').setCategory(ItemCategory.Structures);
    Item.netherQuartz = new Item(150).setIcon(5, 10).setDescriptionId('netherquartz').setCategory(ItemCategory.Mechanisms);
    Item.camera = new Item(200).setIcon(2, 15).setCategory(ItemCategory.Decorations).setDescriptionId('camera');

    // C++: post-loop validates every item has a category; we skip the log.
  }

  static teardownItems(): void {
    for (let i = 256; i < Item.MAX_ITEMS; ++i) {
      Item.items[i] = null;
    }
  }
}

// GameType constants (Item.cpp needs Survival from GameType enum)
export const GameType = {
  Survival: 0,
  Creative: 1,
  Adventure: 2,
} as const;
