/**
 * Translation of: EntityRendererId.h
 *
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/entity/EntityRendererId.h
 */

export const EntityRendererId = {
  ER_DEFAULT_RENDERER: 0,
  ER_QUERY_RENDERER: 1,
  ER_TNT_RENDERER: 2,
  ER_HUMANOID_RENDERER: 3,
  ER_ITEM_RENDERER: 4,
  ER_TRIPODCAMERA_RENDERER: 5,
  ER_CHICKEN_RENDERER: 6,
  ER_COW_RENDERER: 7,
  ER_PIG_RENDERER: 8,
  ER_SHEEP_RENDERER: 9,
  ER_SHEEP_FUR_RENDERER: 10,
  ER_ZOMBIE_RENDERER: 11,
  ER_SKELETON_RENDERER: 12,
  ER_SPIDER_RENDERER: 13,
  ER_CREEPER_RENDERER: 14,
  ER_ARROW_RENDERER: 15,
  ER_PLAYER_RENDERER: 16,
  ER_THROWNEGG_RENDERER: 17,
  ER_SNOWBALL_RENDERER: 18,
  ER_PAINTING_RENDERER: 19,
  ER_FALLINGTILE_RENDERER: 20,
} as const;

export type EntityRendererId = (typeof EntityRendererId)[keyof typeof EntityRendererId];
