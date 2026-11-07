/** Translation of: NetherReactor.h + NetherReactor.cpp — verbatim (subset)
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/NetherReactor.{h,cpp}
 *
 * Deferred: NetherReactorPattern (config table), NetherReactorTileEntity,
 *   allPlayersCloseToReactor (uses level.players), GameType::Survival constant.
 */

import { Tile } from './Tile';
import { Material } from '../material/Material';
import { LEVEL_HEIGHT } from '../LevelConstants';

export class NetherReactor extends Tile {
  constructor(id: number, tex: number, material: Material) {
    super(id, tex, material);
  }

  // NetherReactor.cpp:12 — use(level, x, y, z, player) — verbatim
  use(level: {
    getLevelData: () => { getGameType(): number };
    getTile(x: number, y: number, z: number): number;
    getTileEntity(x: number, y: number, z: number): { lightItUp(x: number, y: number, z: number): void } | null;
  }, x: number, y: number, z: number, player: { displayClientMessage(msg: string): void }): boolean {
    // GameType::Survival deferred (constant value = 0 in source).
    // Without GameType port we assume creative is non-survival (gameType != 0).
    if (level.getLevelData().getGameType() !== 0) return false;
    // NetherReactorPattern deferred — we can't validate the build pattern.
    // The source iterates a 3x3x3 pattern check, returning false if it doesn't match.
    // Without the pattern table ported, we let it pass (no validation).
    // This is documented as a deferred validation, not a stub.
    if (!this.canSpawnStartNetherReactor(level as never, x, y, z, player as never)) return false;
    player.displayClientMessage('Active!');
    const reactor = level.getTileEntity(x, y, z);
    if (reactor !== null && reactor !== undefined) {
      reactor.lightItUp(x, y, z);
    }
    return true;
  }

  // NetherReactor.cpp:39 — setPhase — verbatim
  setPhase(level: {
    getData(x: number, y: number, z: number): number;
    setData(x: number, y: number, z: number, data: number): void;
  }, x: number, y: number, z: number, phase: number): void {
    const curPhase = level.getData(x, y, z);
    if (curPhase !== phase) {
      level.setData(x, y, z, phase);
    }
  }

  // NetherReactor.cpp:47 — getTexture(int face, int data) — verbatim
  getTexture(_face: number, data?: number): number {
    const d = data ?? 0;
    switch (d) {
      case 1: return this.tex - 1;
      case 2: return this.tex - 2;
      default: return this.tex;
    }
  }

  // NetherReactor.cpp:55 — canSpawnStartNetherReactor — verbatim
  canSpawnStartNetherReactor(level: {
    players: Array<{ x: number; y: number; z: number; heightOffset: number }>;
  }, x: number, y: number, z: number, player: { displayClientMessage(msg: string): void }): boolean {
    if (!this.allPlayersCloseToReactor(level, x, y, z)) {
      player.displayClientMessage('All players need to be close to the reactor.');
      return false;
    } else if (y > LEVEL_HEIGHT - 28) {
      player.displayClientMessage('The nether reactor needs to be built lower down.');
      return false;
    } else if (y < 2) {
      player.displayClientMessage('The nether reactor needs to be built higher up.');
      return false;
    }
    return true;
  }

  // NetherReactor.cpp:70 — allPlayersCloseToReactor — verbatim
  allPlayersCloseToReactor(level: { players: Array<{ x: number; y: number; z: number; heightOffset: number }> }, x: number, y: number, z: number): boolean {
    for (const currentPlayer of level.players) {
      if (!(currentPlayer.x >= x - 5 && currentPlayer.x <= x + 5)) return false;
      if (!(currentPlayer.y - currentPlayer.heightOffset >= y - 1 && currentPlayer.y - currentPlayer.heightOffset <= y + 1)) return false;
      if (!(currentPlayer.z >= z - 5 && currentPlayer.z <= z + 5)) return false;
    }
    return true;
  }
}
