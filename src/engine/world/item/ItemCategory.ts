/**
 * Translation of: ItemCategory.h
 *
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/item/ItemCategory.h
 */

export const ItemCategory = {
  Structures: 1,
  Tools: 2,
  FoodArmor: 4,
  Decorations: 8,
  Mechanisms: 16,

  NUM_CATEGORIES: 5,
} as const;

export function categoryToString(id: number): string {
  switch (id) {
    case ItemCategory.Structures: return 'Structures';
    case ItemCategory.Tools: return 'Tools';
    case ItemCategory.FoodArmor: return 'Food and\nArmor';
    case ItemCategory.Decorations: return 'Decorations';
    case ItemCategory.Mechanisms: return 'Mechanisms';
    default: return '<Unknown category>';
  }
}
