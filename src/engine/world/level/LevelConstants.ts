/**
 * Translation of: LevelConstants.h
 *
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/LevelConstants.h
 *
 * Faithful line-by-line. Note: this is the 0.6.1/0.7.x fixed-world layout —
 * 16×16 chunk grid × 16×16 chunk = 256×256 world, height 128. The infinite
 * worlds that 0.9.0 added did not exist in this version.
 */

export const LEVEL_HEIGHT = 128;
export const CHUNK_CACHE_WIDTH = 16;   // in chunks
export const CHUNK_WIDTH = 16;         // in blocks
export const CHUNK_DEPTH = 16;
export const LEVEL_WIDTH = CHUNK_CACHE_WIDTH * CHUNK_WIDTH;     // 256
export const LEVEL_DEPTH = CHUNK_CACHE_WIDTH * CHUNK_DEPTH;   // 256
export const CHUNK_COLUMNS = CHUNK_WIDTH * CHUNK_DEPTH;        // 256
export const CHUNK_BLOCK_COUNT = CHUNK_COLUMNS * LEVEL_HEIGHT; // 32768
