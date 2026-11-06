/**
 * Translation of: Facing.h + Direction.h + Direction.cpp
 *
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/Facing.h,
 *         world/Direction.h, world/Direction.cpp
 *
 * Combined here because Facing's static arrays (OPPOSITE_FACING, STEP_*) are
 * defined in Direction.cpp in the C++ source — they live together.
 */

export const Facing = {
  DOWN: 0,
  UP: 1,
  NORTH: 2,
  SOUTH: 3,
  WEST: 4,
  EAST: 5,
} as const;

export type FaceId = (typeof Facing)[keyof typeof Facing];

export function facingToString(face: number): string {
  if (face === Facing.DOWN) return 'Down';
  if (face === Facing.UP) return 'Up';
  if (face === Facing.NORTH) return 'North';
  if (face === Facing.SOUTH) return 'South';
  if (face === Facing.WEST) return 'West';
  if (face === Facing.EAST) return 'East';
  return 'Unknown facing';
}

// From Direction.cpp — Facing::OPPOSITE_FACING[6]
export const OPPOSITE_FACING: readonly number[] = [
  Facing.UP, Facing.DOWN, Facing.SOUTH, Facing.NORTH, Facing.EAST, Facing.WEST,
];

// From Direction.cpp — Facing::STEP_X[6], STEP_Y[6], STEP_Z[6]
export const STEP_X: readonly number[] = [0, 0, 0, 0, -1, 1];
export const STEP_Y: readonly number[] = [-1, 1, 0, 0, 0, 0];
export const STEP_Z: readonly number[] = [0, 0, -1, 1, 0, 0];

export const Direction = {
  UNDEFINED: -1,
  SOUTH: 0,
  WEST: 1,
  NORTH: 2,
  EAST: 3,
} as const;

// Direction::DIRECTION_FACING[4]
export const DIRECTION_FACING: readonly number[] = [
  Facing.SOUTH, Facing.WEST, Facing.NORTH, Facing.EAST,
];

// Direction::FACING_DIRECTION[6]
export const FACING_DIRECTION: readonly number[] = [
  Direction.UNDEFINED, Direction.UNDEFINED,
  Direction.NORTH, Direction.SOUTH, Direction.WEST, Direction.EAST,
];

// Direction::DIRECTION_OPPOSITE[4]
export const DIRECTION_OPPOSITE: readonly number[] = [
  Direction.NORTH, Direction.EAST, Direction.SOUTH, Direction.WEST,
];

// Direction::RELATIVE_DIRECTION_FACING[4][6]
export const RELATIVE_DIRECTION_FACING: readonly number[][] = [
  // south
  [Facing.DOWN, Facing.UP, Facing.SOUTH, Facing.NORTH, Facing.EAST, Facing.WEST],
  // west
  [Facing.DOWN, Facing.UP, Facing.EAST, Facing.WEST, Facing.NORTH, Facing.SOUTH],
  // north
  [Facing.DOWN, Facing.UP, Facing.NORTH, Facing.SOUTH, Facing.WEST, Facing.EAST],
  // east
  [Facing.DOWN, Facing.UP, Facing.WEST, Facing.EAST, Facing.SOUTH, Facing.NORTH],
];
