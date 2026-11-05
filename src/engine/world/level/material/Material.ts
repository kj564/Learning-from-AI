/**
 * Translation of: Material.h + Material.cpp + GasMaterial.h + LiquidMaterial.h
 *                + DecorationMaterial.h + WebMaterial.h
 *
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/material/
 *
 * In C++ these are five files with class hierarchies and protected builder
 * methods. TS keeps the same structure. The Material interface lives in
 * Tile.ts (since the base Tile depends on it); the concrete classes here
 * re-implement that interface so subclassing works naturally.
 */

import type { Material } from '../tile/Tile';

abstract class MaterialBase implements Material {
  protected _flammable = false;
  protected _neverBuildable = false;
  protected _isAlwaysDestroyable = true;
  protected _replaceable = false;

  isLiquid(): boolean { return false; }
  letsWaterThrough(): boolean { return !this.isLiquid() && !this.isSolid(); }
  isSolid(): boolean { return true; }
  blocksLight(): boolean { return true; }
  isSolidBlocking(): boolean {
    if (this._neverBuildable) return false;
    return this.blocksMotion();
  }
  isAlwaysDestroyable(): boolean { return this._isAlwaysDestroyable; }
  blocksMotion(): boolean { return true; }
  isFlammable(): boolean { return this._flammable; }
  isReplaceable(): boolean { return this._replaceable; }

  protected flammable(): this { this._flammable = true; return this; }
  protected neverBuildable(): this { this._neverBuildable = true; return this; }
  protected notAlwaysDestroyable(): this { this._isAlwaysDestroyable = false; return this; }
  protected replaceable(): this { this._replaceable = true; return this; }
}

export class MaterialImpl extends MaterialBase {}

export class GasMaterial extends MaterialBase {
  constructor() {
    super();
    this.replaceable();
  }
  isSolid(): boolean { return false; }
  blocksLight(): boolean { return false; }
  blocksMotion(): boolean { return false; }
}

export class LiquidMaterial extends MaterialBase {
  constructor() {
    super();
    this.replaceable();
  }
  isLiquid(): boolean { return true; }
  blocksMotion(): boolean { return false; }
  isSolid(): boolean { return false; }
}

export class DecorationMaterial extends MaterialBase {
  isSolid(): boolean { return false; }
  blocksLight(): boolean { return false; }
  blocksMotion(): boolean { return false; }
}

export class WebMaterial extends MaterialBase {
  constructor() {
    super();
    this.notAlwaysDestroyable();
  }
  blocksMotion(): boolean { return false; }
}

// Static const Material* Material::air etc. (from Material.cpp initMaterials)
export const Material: {
  air: Material;
  dirt: Material;
  wood: Material;
  stone: Material;
  metal: Material;
  water: Material;
  lava: Material;
  leaves: Material;
  plant: Material;
  replaceable_plant: Material;
  sponge: Material;
  cloth: Material;
  fire: Material;
  sand: Material;
  decoration: Material;
  glass: Material;
  explosive: Material;
  coral: Material;
  ice: Material;
  topSnow: Material;
  snow: Material;
  cactus: Material;
  clay: Material;
  vegetable: Material;
  portal: Material;
  cake: Material;
  web: Material;
} = {} as never;

// Material::initMaterials() — exactly as in Material.cpp
export function initMaterials(): void {
  (Material as any).air = new GasMaterial();
  (Material as any).dirt = new MaterialImpl();
  (Material as any).wood = (new MaterialImpl()).flammable();
  (Material as any).stone = (new MaterialImpl()).notAlwaysDestroyable();
  (Material as any).metal = (new MaterialImpl()).notAlwaysDestroyable();
  (Material as any).water = new LiquidMaterial();
  (Material as any).lava = new LiquidMaterial();
  (Material as any).leaves = (new MaterialImpl()).flammable().neverBuildable();
  (Material as any).plant = new DecorationMaterial();
  (Material as any).replaceable_plant = (new DecorationMaterial()).replaceable().flammable();
  (Material as any).sponge = new MaterialImpl();
  (Material as any).cloth = (new MaterialImpl()).flammable();
  (Material as any).fire = new GasMaterial();
  (Material as any).sand = new MaterialImpl();
  (Material as any).decoration = new DecorationMaterial();
  (Material as any).glass = (new MaterialImpl()).neverBuildable();
  (Material as any).explosive = (new MaterialImpl()).flammable().neverBuildable();
  (Material as any).coral = new MaterialImpl();
  (Material as any).ice = (new MaterialImpl()).neverBuildable();
  (Material as any).topSnow = (new DecorationMaterial()).neverBuildable().notAlwaysDestroyable().replaceable();
  (Material as any).snow = (new MaterialImpl()).notAlwaysDestroyable();
  (Material as any).cactus = (new MaterialImpl()).neverBuildable();
  (Material as any).clay = new MaterialImpl();
  (Material as any).vegetable = new MaterialImpl();
  (Material as any).portal = new MaterialImpl();
  (Material as any).cake = new MaterialImpl();
  (Material as any).web = new WebMaterial();
}
