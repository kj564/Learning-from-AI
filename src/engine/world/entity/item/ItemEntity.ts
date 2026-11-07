/**
 * Translation of: world/entity/item/ItemEntity.{h,cpp} (subset — constructor + tick)
 *
 * Source: rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/entity/item/ItemEntity.{h,cpp}
 *
 * Faithful translation of:
 *   - LIFETIME = 5 * 60 * TicksPerSecond = 6000 ticks (5 minutes)
 *   - constructor(level, x, y, z, itemInstance) — sets health=5, age=0,
 *     throwTime=0, lifeTime=LIFETIME, bobOffs=random*2PI, setSize(0.25, 0.25),
 *     heightOffset=bbHeight/2, setPos(x,y,z), yRot=random*360, xd/zd random*0.2-0.1,
 *     yd=0.2, makeStepSound=false
 *   - constructor(level) — same minus setPos + rotation + velocity
 *   - getEntityTypeId() = 0 (deferred — ItemEntity's actual id is in EntityTypes.h)
 *   - getLifeTime() returns lifeTime
 *   - isItemEntity() = true
 *
 * Deferred:
 *   - tick() body (full ItemEntity::tick needs water/bounce/touch logic)
 *   - playerTouch (player pickup logic — needs Inventory port)
 *   - isInWater override (uses level.checkAndHandleWater differently)
 *   - hurt(Entity*, int) override
 *   - burn(int dmg) override
 *   - save/load (CompoundTag port)
 *   - checkInTile (collision helper)
 */

import { Entity, type EntityLevel } from '../Entity';
import { ItemInstance } from '../../item/ItemInstance';
import { Mth } from '../../../util/Mth';
import { TicksPerSecond } from '../../../shared/SharedConstants';
import { EntityRendererId as ER } from '../EntityRendererId';

export class ItemEntity extends Entity {
  static readonly LIFETIME = 5 * 60 * TicksPerSecond; // 6000 ticks = 5 minutes

  item: ItemInstance;
  age = 0;
  throwTime = 0;
  bobOffs: number;
  private tickCount = 0;
  protected health = 5;
  private lifeTime: number;

  constructor(level: EntityLevel);
  constructor(level: EntityLevel, x: number, y: number, z: number, item: ItemInstance);
  constructor(level: EntityLevel, x?: number, y?: number, z?: number, item?: ItemInstance) {
    super(level);
    this.item = item ?? new ItemInstance();
    this.health = 5;
    this.age = 0;
    this.tickCount = 0;
    this.throwTime = 0;
    this.lifeTime = ItemEntity.LIFETIME;
    this.bobOffs = Math.random() * Math.PI * 2;

    this.entityRendererId = ER.ER_ITEM_RENDERER;
    this.setSize(0.25, 0.25);
    this.heightOffset = this.bbHeight / 2.0;

    if (x !== undefined && y !== undefined && z !== undefined) {
      // ItemEntity(level, x, y, z, item) constructor body — verbatim from ItemEntity.cpp:13
      this.setPos(x, y, z);
      this.yRot = Math.random() * 360;
      this.xd = Math.random() * 0.2 - 0.1;
      this.yd = 0.2;
      this.zd = Math.random() * 0.2 - 0.1;
    }
    this.makeStepSound = false;
  }

  getEntityTypeId(): number { return 0; /* deferred — ItemEntity's actual id from EntityTypes.h */ }
  getLifeTime(): number { return this.lifeTime; }
  isItemEntity(): boolean { return true; }

  protected readAdditionalSaveData(_tag: unknown): void {}
  protected addAdditonalSaveData(_tag: unknown): void {}
  protected burn(_dmg: number): void {}
}

void Mth;
