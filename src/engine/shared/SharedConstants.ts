/**
 * Translation of: SharedConstants.h
 *
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/SharedConstants.h
 *
 * 0.5.0 uses NPv8
 * 0.6.0 uses NPv9
 * 0.7.x — delta vs 0.6.1 confirmed via binary RE: same NPv9 (no protocol
 *   change in the 0.7.0/0.7.1 bugfix line, only FoodItem::getUseDuration +
 *   XperiaPlayInput added; see worklog Entry 27).
 */

export const NetworkProtocolVersion = 9;
export const NetworkProtocolLowestSupportedVersion = 9;
export const GameProtocolVersion = 1;
export const GameProtocolLowestSupportedVersion = 1;

export const StorageVersion = 3;

export const MaxChatLength = 100;

export const TicksPerSecond = 20;

// enum LevelGeneratorVersion { LGV_ORIGINAL = 0 };
export const LGV_ORIGINAL = 0;
export const GeneratorVersion = LGV_ORIGINAL;
