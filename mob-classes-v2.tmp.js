    // ============================================================
    //  Mob class hierarchy — 1:1 faithful ES6 port of rujukan C++
    //
    //  Inheritance (MODLOG Entry 26, verified from rujukan headers):
    //    Entity → Mob → PathfinderMob → AgableMob → Animal → Chicken
    //
    //  Constructor chain (MODLOG §26.8):
    //    Entity() → Mob() → PathfinderMob() → AgableMob() → Animal() → Chicken()
    //    Then MobFactory re-sets health = getMaxHealth() (C++ vtable-in-ctor quirk)
    //
    //  Method bodies (MODLOG Entry 27, EXACT line-by-line transcription):
    //    §27.1  Entity::move          (Entity.cpp:137-359)
    //    §27.2  Entity::tick          (Entity.cpp:463-466)  — trivial
    //    §27.3  Entity::baseTick      (Entity.cpp:468-534)
    //    §27.4  Entity::moveRelative  (Entity.cpp:575-590)
    //    §27.5  Mob::baseTick         (Mob.cpp:148-237)
    //    §27.6  Mob::tick             (Mob.cpp:270-376)
    //    §27.7  Mob::travel           (Mob.cpp:558-626)
    //    §27.8  Mob::aiStep           (Mob.cpp:688-757)
    //    §27.9  Mob::updateAi         (Mob.cpp:760-802)
    //    §27.10 PathfinderMob::updateAi (PathfinderMob.cpp:59-185) — simplified per spec
    //    §27.11 PathfinderMob::findRandomStrollLocation (PathfinderMob.cpp:187-214)
    //    §27.12 Chicken::aiStep       (Chicken.cpp:33-61)
    //    §27.13 Level::getCubes       (Level.cpp:1119-1161)
    //    §27.14 AABB geometry methods (AABB.h:39-167)
    //
    //  Virtual dispatch (MODLOG §26.9):
    //    tick(): Mob::tick → Entity::baseTick + aiStep + walkAnim + body-rot
    //    aiStep(): Mob::aiStep (updateAi + travel + push) → AgableMob::aiStep (age) → Chicken::aiStep (wing flap)
    //    travel(): Mob::travel (3-branch water/lava/land)
    //    updateAi(): Mob::updateAi (look-around) → PathfinderMob::updateAi (wander)
    //    getMaxHealth(): Mob=10 → Chicken=4
    //    getWalkingSpeedModifier(): Mob=1.0 → PathfinderMob=(flee?2:1) → Animal=0.7
    //    causeFallDamage(): Mob (damage) → Chicken (no-op)
    // ============================================================

    // ---- AABB (AABB.h:39-167, §27.14) — collision geometry ----
    // EXACT transcription of expand / grow / cloneMove / clipX/Y/ZCollide / move / set / intersects.
    // Per §27.14 port note: clipX/Y/ZCollide semantics — `this` = STATIC collision cube,
    // `c` = MOVING box (entity bb), `xa/ya/za` = moving box's velocity on that axis.
    // This matches the C++ call pattern `aABBs[i].clipXCollide(bb, xa)` in §27.1.
    class AABB {
      constructor(x0, y0, z0, x1, y1, z1) {
        this.x0 = x0; this.y0 = y0; this.z0 = z0;
        this.x1 = x1; this.y1 = y1; this.z1 = z1;
      }
      // §27.14 expand: DIRECTIONAL — negative xa shrinks x0, positive xa grows x1.
      expand(xa, ya, za) {
        let _x0 = this.x0, _y0 = this.y0, _z0 = this.z0;
        let _x1 = this.x1, _y1 = this.y1, _z1 = this.z1;
        if (xa < 0) _x0 += xa;
        if (xa > 0) _x1 += xa;
        if (ya < 0) _y0 += ya;
        if (ya > 0) _y1 += ya;
        if (za < 0) _z0 += za;
        if (za > 0) _z1 += za;
        return new AABB(_x0, _y0, _z0, _x1, _y1, _z1);
      }
      // §27.14 grow: SYMMETRIC — subtract from min, add to max.
      grow(xa, ya, za) {
        return new AABB(this.x0 - xa, this.y0 - ya, this.z0 - za,
                        this.x1 + xa, this.y1 + ya, this.z1 + za);
      }
      // §27.14 cloneMove: returns NEW translated AABB (does not mutate this).
      cloneMove(xa, ya, za) {
        return new AABB(this.x0 + xa, this.y0 + ya, this.z0 + za,
                        this.x1 + xa, this.y1 + ya, this.z1 + za);
      }
      // §27.14 clipXCollide: this = static cube, c = moving box, xa = moving box's X velocity
      // Per-axis: only clip on axis A if the boxes overlap on the OTHER two axes.
      clipXCollide(c, xa) {
        if (c.y1 <= this.y0 || c.y0 >= this.y1) return xa;  // no Y overlap
        if (c.z1 <= this.z0 || c.z0 >= this.z1) return xa;  // no Z overlap
        if (xa > 0 && c.x1 <= this.x0) {
          const max = this.x0 - c.x1;
          if (max < xa) xa = max;
        }
        if (xa < 0 && c.x0 >= this.x1) {
          const max = this.x1 - c.x0;
          if (max > xa) xa = max;
        }
        return xa;
      }
      // §27.14 clipYCollide: this = static cube, c = moving box, ya = moving box's Y velocity
      clipYCollide(c, ya) {
        if (c.x1 <= this.x0 || c.x0 >= this.x1) return ya;  // no X overlap
        if (c.z1 <= this.z0 || c.z0 >= this.z1) return ya;  // no Z overlap
        if (ya > 0 && c.y1 <= this.y0) {
          const max = this.y0 - c.y1;
          if (max < ya) ya = max;
        }
        if (ya < 0 && c.y0 >= this.y1) {
          const max = this.y1 - c.y0;
          if (max > ya) ya = max;
        }
        return ya;
      }
      // §27.14 clipZCollide: this = static cube, c = moving box, za = moving box's Z velocity
      clipZCollide(c, za) {
        if (c.x1 <= this.x0 || c.x0 >= this.x1) return za;  // no X overlap
        if (c.y1 <= this.y0 || c.y0 >= this.y1) return za;  // no Y overlap
        if (za > 0 && c.z1 <= this.z0) {
          const max = this.z0 - c.z1;
          if (max < za) za = max;
        }
        if (za < 0 && c.z0 >= this.z1) {
          const max = this.z1 - c.z0;
          if (max > za) za = max;
        }
        return za;
      }
      // §27.14 move: MUTATES this in place, returns this for chaining.
      move(xa, ya, za) {
        this.x0 += xa; this.y0 += ya; this.z0 += za;
        this.x1 += xa; this.y1 += ya; this.z1 += za;
        return this;
      }
      // §27.14 set: MUTATES this from another AABB.
      set(b) {
        this.x0 = b.x0; this.y0 = b.y0; this.z0 = b.z0;
        this.x1 = b.x1; this.y1 = b.y1; this.z1 = b.z1;
        return this;
      }
      // §27.14 copy: returns a value-copy.
      copy() {
        return new AABB(this.x0, this.y0, this.z0, this.x1, this.y1, this.z1);
      }
      // §27.14 intersects: touching faces do NOT count as intersecting.
      intersects(c) {
        if (c.x1 <= this.x0 || c.x0 >= this.x1) return false;
        if (c.y1 <= this.y0 || c.y0 >= this.y1) return false;
        if (c.z1 <= this.z0 || c.z0 >= this.z1) return false;
        return true;
      }
    }

    // ---- Level::getCubes (Level.cpp:1119-1161, §27.13) — collision AABB gatherer ----
    // EXACT per §27.13: x1/y1/z1 = floor(box.*1 + 1); Y loop starts at y0 - 1; iteration x,z,y.
    // For the browser port: simplified `addAABBs` — full 1x1x1 cube for solid blocks;
    // skip air (id 0) and water (id 19 in this port, was 8/9 in MCPE).
    function getCubes(source, box) {
      const boxes = [];
      const x0 = Math.floor(box.x0);
      const x1 = Math.floor(box.x1 + 1);  // §27.13: +1 on upper bound
      const y0 = Math.floor(box.y0);
      const y1 = Math.floor(box.y1 + 1);
      const z0 = Math.floor(box.z0);
      const z1 = Math.floor(box.z1 + 1);
      for (let x = x0; x < x1; x++) {
        for (let z = z0; z < z1; z++) {
          // §27.13 chunk-loaded check skipped — all chunks loaded in browser port
          for (let y = y0 - 1; y < y1; y++) {  // §27.13: Y starts at y0 - 1
            const id = world.getBlock(x, y, z);
            if (!id) continue;  // air
            if (id === 19) continue;  // water (this port: id 19, noCollide)
            // §27.13 simplified: full 1x1x1 cube for any solid block
            const d = BLOCKS[id];
            if (!d || !d.solid) continue;
            boxes.push(new AABB(x, y, z, x + 1, y + 1, z + 1));
          }
        }
      }
      return boxes;
    }

    // ---- Entity (Entity.h:23, 224 lines) — root base ----
    class MobEntity {
      constructor(level) {
        // VERIFIED Entity init list (Entity.cpp:15-63)
        this.level = level;
        this.x = 0; this.y = 0; this.z = 0;
        this.xo = 0; this.yo = 0; this.zo = 0;
        this.xd = 0; this.yd = 0; this.zd = 0;
        this.yRot = 0; this.xRot = 0;
        this.yRotO = 0; this.xRotO = 0;
        this.onGround = false;
        this.horizontalCollision = false;
        this.verticalCollision = false;
        this.collision = false;
        this.removed = false;
        this.noPhysics = false;
        this.tickCount = 0;
        this.fallDistance = 0;
        this.bbWidth = 0.6; this.bbHeight = 1.8;
        this.heightOffset = 0;
        this.pushthrough = 0;
        this.airSupply = 300; this.airCapacity = 300;
        this.onFire = 0; this.flameTime = 1;
        this.firstTick = true;
        this.blocksBuilding = false;
        this.walkDist = 0; this.walkDistO = 0;
        this.nextStep = 0;
        this.entityId = 0;
        // §27.1 / §27.14 — bounding box + step-up support
        this.bb = new AABB(0, 0, 0, 0, 0, 0);
        this.ySlideOffset = 0;
        // §MODLOG Entry 26 (line 15575, 15605, 16332): Entity.h:206 — `slide` defaults to TRUE.
        // This is critical: with slide=true, the "stick-on-landing" zeroing
        // (§27.1 `if (!slide && yaOrg != ya) xa=ya=za=0`) is SKIPPED, allowing mobs
        // to walk on flat ground every tick (gravity makes yd=-0.0784 → Y clip
        // fires every tick, but horizontal isn't zeroed). With slide=false, mobs
        // would be stuck (horizontal zeroed every tick).
        this.slide = true;
        this.makeStepSound = true;
        this.isStuckInWeb = false;
        this.fireImmune = false;
        this.wasInWater = false;
      }

      // §27.2 — Entity::tick (Entity.cpp:463-466) — EXACT
      tick() { this.baseTick(); }

      // §27.3 — Entity::baseTick (Entity.cpp:468-534) — EXACT
      baseTick() {
        this.tickCount++;
        this.walkDistO = this.walkDist;
        this.xo = this.x; this.yo = this.y; this.zo = this.z;
        this.xRotO = this.xRot; this.yRotO = this.yRot;

        if (this.isInWater()) {
          if (!this.wasInWater && !this.firstTick) {
            // §27.3 splash — speed = sqrt(xd²·0.2 + yd² + zd²·0.2) · 0.2, clamp ≤1
            const speed = Math.sqrt(this.xd * this.xd * 0.2 + this.yd * this.yd + this.zd * this.zd * 0.2) * 0.2;
            // §27.3 port note: playSound + addParticle skipped (no audio/particles in browser port)
            void speed;  // preserve the calculation for fidelity
          }
          this.fallDistance = 0;
          this.wasInWater = true;
          this.onFire = 0;
        } else {
          this.wasInWater = false;
        }

        // §27.3 — server-side fire tick (browser port = single-player server)
        if (this.onFire > 0) {
          if (this.fireImmune) {
            this.onFire -= 4;
            if (this.onFire < 0) this.onFire = 0;
          } else {
            if (this.onFire % 20 === 0) {
              this.hurt(null, 1);
            }
            this.onFire--;
          }
        }

        if (this.isInLava()) {
          this.lavaHurt();
        }

        if (this.y < -64) {
          this.outOfWorld();
        }

        this.firstTick = false;
      }

      // §27.1 — Entity::move (Entity.cpp:137-359) — EXACT
      // Y-first clip collision with step-up / sneak / web / fire / fall-damage.
      move(xa, ya, za) {
        // §27.1 noPhysics short-circuit
        if (this.noPhysics) {
          this.bb.move(xa, ya, za);
          this.x = (this.bb.x0 + this.bb.x1) / 2;
          this.y = this.bb.y0 + this.heightOffset - this.ySlideOffset;
          this.z = (this.bb.z0 + this.bb.z1) / 2;
          return;
        }

        const xo = this.x;
        const zo = this.z;

        // §27.1 web slowdown (one-shot)
        if (this.isStuckInWeb) {
          this.isStuckInWeb = false;
          xa *= 0.25; ya *= 0.05; za *= 0.25;
          this.xd = 0; this.yd = 0; this.zd = 0;
        }

        let xaOrg = xa, yaOrg = ya, zaOrg = za;
        const bbOrg = this.bb.copy();
        const sneaking = this.onGround && this.isSneaking();

        // §27.1 sneak edge-clamp — three nudge loops (X, Z, diagonal)
        if (sneaking) {
          const d = 0.05;
          while (xa !== 0 && getCubes(this, this.bb.cloneMove(xa, -1.0, 0)).length === 0) {
            if (xa < d && xa >= -d) xa = 0;
            else if (xa > 0) xa -= d;
            else xa += d;
            xaOrg = xa;
          }
          while (za !== 0 && getCubes(this, this.bb.cloneMove(0, -1.0, za)).length === 0) {
            if (za < d && za >= -d) za = 0;
            else if (za > 0) za -= d;
            else za += d;
            zaOrg = za;
          }
          // §27.1 third loop — diagonal sneak (often dropped in ports; must be kept)
          while (xa !== 0 && za !== 0 && getCubes(this, this.bb.cloneMove(xa, -1.0, za)).length === 0) {
            if (xa < d && xa >= -d) xa = 0;
            else if (xa > 0) xa -= d;
            else xa += d;
            if (za < d && za >= -d) za = 0;
            else if (za > 0) za -= d;
            else za += d;
            xaOrg = xa;
            zaOrg = za;
          }
        }

        // §27.1 — gather cubes once, then Y/X/Z clip per axis
        let aABBs = getCubes(this, this.bb.expand(xa, ya, za));

        // LAND FIRST, then X, then Z
        for (let i = 0; i < aABBs.length; i++) ya = aABBs[i].clipYCollide(this.bb, ya);
        this.bb.move(0, ya, 0);

        if (!this.slide && yaOrg !== ya) { xa = 0; ya = 0; za = 0; }

        const og = this.onGround || (yaOrg !== ya && yaOrg < 0);

        for (let i = 0; i < aABBs.length; i++) xa = aABBs[i].clipXCollide(this.bb, xa);
        this.bb.move(xa, 0, 0);

        if (!this.slide && xaOrg !== xa) { xa = 0; ya = 0; za = 0; }

        for (let i = 0; i < aABBs.length; i++) za = aABBs[i].clipZCollide(this.bb, za);
        this.bb.move(0, 0, za);

        if (!this.slide && zaOrg !== za) { xa = 0; ya = 0; za = 0; }

        // §27.1 step-up / footSize / ySlideOffset retry block (auto-jump)
        if (this.footSize > 0 && og && (this.ySlideOffset < 0.05) && ((xaOrg !== xa) || (zaOrg !== za))) {
          const xaN = xa, yaN = ya, zaN = za;
          xa = xaOrg;
          ya = this.footSize;
          za = zaOrg;
          const normal = this.bb.copy();
          this.bb.set(bbOrg);
          aABBs = getCubes(this, this.bb.expand(xa, ya, za));

          for (let i = 0; i < aABBs.length; i++) ya = aABBs[i].clipYCollide(this.bb, ya);
          this.bb.move(0, ya, 0);
          if (!this.slide && yaOrg !== ya) { xa = 0; ya = 0; za = 0; }

          for (let i = 0; i < aABBs.length; i++) xa = aABBs[i].clipXCollide(this.bb, xa);
          this.bb.move(xa, 0, 0);
          if (!this.slide && xaOrg !== xa) { xa = 0; ya = 0; za = 0; }

          for (let i = 0; i < aABBs.length; i++) za = aABBs[i].clipZCollide(this.bb, za);
          this.bb.move(0, 0, za);
          if (!this.slide && zaOrg !== za) { xa = 0; ya = 0; za = 0; }

          if (xaN * xaN + zaN * zaN >= xa * xa + za * za) {
            xa = xaN; ya = yaN; za = zaN;
            this.bb.set(normal);
          } else {
            this.ySlideOffset += 0.5;
          }
        }

        // §27.1 recenter x/y/z from bb
        this.x = (this.bb.x0 + this.bb.x1) / 2;
        this.y = this.bb.y0 + this.heightOffset - this.ySlideOffset;
        this.z = (this.bb.z0 + this.bb.z1) / 2;

        this.horizontalCollision = (xaOrg !== xa) || (zaOrg !== za);
        this.verticalCollision = (yaOrg !== ya);
        this.onGround = yaOrg !== ya && yaOrg < 0;
        this.collision = this.horizontalCollision || this.verticalCollision;
        this.checkFallDamage(ya, this.onGround);

        // §27.1 zero velocity on blocked axes
        if (xaOrg !== xa) this.xd = 0;
        if (yaOrg !== ya) this.yd = 0;
        if (zaOrg !== za) this.zd = 0;

        const xm = this.x - xo;
        const zm = this.z - zo;

        if (this.makeStepSound && !sneaking) {
          // §27.1 walk-distance += sqrt * 0.6
          this.walkDist += Math.sqrt(xm * xm + zm * zm) * 0.6;
          const xt = Math.floor(this.x);
          const yt = Math.floor(this.y - 0.2 - this.heightOffset);
          const zt = Math.floor(this.z);
          let t = world.getBlock(xt, yt, zt);
          if (t === 0) {
            // §27.1 fence/fenceGate step-sound special case — no fence IDs in this port, skip
          }
          if (this.walkDist > this.nextStep && t > 0) {
            this.nextStep = Math.floor(this.walkDist) + 1;
            this.playStepSound(xt, yt, zt, t);
          }
        }

        // §27.1 entityInside tile loop — skipped (no tile-entity effects in browser port)

        // §27.1 ySlideOffset decay
        this.ySlideOffset *= 0.4;

        // §27.1 fire tile check
        const water = this.isInWater();
        if (this.containsFireTile()) {
          this.burn(1);
          if (!water) {
            this.onFire++;
            if (this.onFire === 0) this.onFire = 20 * 15;
          }
        } else {
          if (this.onFire <= 0) {
            this.onFire = -this.flameTime;
          }
        }
        if (water && this.onFire > 0) {
          this.onFire = -this.flameTime;
        }
      }

      // §27.4 — Entity::moveRelative (Entity.cpp:575-590) — EXACT
      // `xa` = strafe, `za` = forward (param naming per source).
      moveRelative(xa, za, speed) {
        let dist = Math.sqrt(xa * xa + za * za);
        if (dist < 0.01) return;  // §27.4 early-out — no input → no drift
        if (dist < 1) dist = 1;   // §27.4 sub-unit input clamp
        const f = speed / dist;
        xa *= f; za *= f;
        const sin_ = Math.sin(this.yRot * Math.PI / 180);
        const cos_ = Math.cos(this.yRot * Math.PI / 180);
        this.xd += xa * cos_ - za * sin_;
        this.zd += za * cos_ + xa * sin_;
      }

      // ---- Helpers (not in Entry 27; minimal stubs for browser port) ----
      setPos(x, y, z) {
        this.x = x; this.y = y; this.z = z;
        this.recomputeBB();
      }
      recomputeBB() {
        const w = this.bbWidth / 2;
        const y0 = this.y - this.heightOffset + this.ySlideOffset;
        this.bb.set(new AABB(this.x - w, y0, this.z - w,
                              this.x + w, y0 + this.bbHeight, this.z + w));
      }
      setSize(w, h) {
        this.bbWidth = w; this.bbHeight = h;
        this.recomputeBB();
      }
      isInWater() {
        const id = world.getBlock(Math.floor(this.x), Math.floor(this.y + 0.5), Math.floor(this.z));
        return id === 19;  // this port: water is id 19 (TILE.WATER, noCollide)
      }
      isInLava() {
        // No lava block in this port — always false.
        return false;
      }
      isUnderLiquid(material) {
        if (material === 'water') return this.isInWater();
        if (material === 'lava') return this.isInLava();
        return false;
      }
      isInWall() {
        // Suffocation check at body mid-height
        const cx = Math.floor(this.x);
        const cy = Math.floor(this.y + this.bbHeight * 0.5);
        const cz = Math.floor(this.z);
        const id = world.getBlock(cx, cy, cz);
        if (!id) return false;
        if (id === 19) return false;  // water
        const d = BLOCKS[id];
        return d ? d.solid : false;
      }
      isSneaking() { return false; }  // mobs don't sneak by default
      onLadder() { return false; }   // no ladders in this port
      isFree(xd, yd, zd) {
        // §27.7 swim-up check: is the space at (x+xd, y+yd, z+zd) free of collision?
        const testBox = this.bb.cloneMove(xd, yd, zd);
        return getCubes(this, testBox).length === 0;
      }
      containsFireTile() {
        // No fire/lava blocks in this port — always false.
        return false;
      }
      burn(amount) { this.hurt(null, amount); }
      lavaHurt() {
        // No lava in this port — no-op.
      }
      outOfWorld() {
        this.health = 0;
        this.die();
      }
      die() { /* overridden by subclasses if needed */ }
      hurt(source, amount) {
        if (this.invulnerableTime > 0 || (this.health !== undefined && this.health <= 0)) return;
        this.health -= amount;
        if (this.hurtTime !== undefined) this.hurtTime = 10;
        if (this.hurtDuration !== undefined) this.hurtDuration = 10;
        if (this.invulnerableTime !== undefined) this.invulnerableTime = this.invulnerableDuration || 10;
        if (this.health <= 0) this.die();
      }
      remove() { this.removed = true; }
      beforeRemove() { /* stub — subclasses override */ }
      isAlive() { return this.health === undefined || this.health > 0; }
      isPushable() { return this.isAlive(); }
      isPlayer() { return false; }
      isSleeping() { return false; }
      isWaterMob() { return false; }
      push(other) {
        // Simplified push: nudge other entity away from this one along X/Z.
        const dx = other.x - this.x;
        const dz = other.z - this.z;
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d > 0 && d < 1.0) {
          const nx = dx / d, nz = dz / d;
          other.x += nx * 0.1;
          other.z += nz * 0.1;
        }
      }
      distanceToSqr(x, y, z) {
        const dx = this.x - x, dy = this.y - y, dz = this.z - z;
        return dx * dx + dy * dy + dz * dz;
      }
      distanceTo(other) {
        return Math.sqrt(this.distanceToSqr(other.x, other.y, other.z));
      }
      checkFallDamage(ya, onGround) {
        if (onGround) {
          if (this.fallDistance > 0) {
            this.causeFallDamage(this.fallDistance);
            this.fallDistance = 0;
          }
        } else if (ya < 0) {
          this.fallDistance += -ya;
        }
      }
      causeFallDamage(distance) {
        if (distance > 2) this.hurt(null, Math.ceil(distance - 1));
      }
      playStepSound(xt, yt, zt, t) { /* stub — no audio in browser port */ }
      isSolidAt(x, y, z) {
        const id = world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
        if (!id) return false;
        const d = BLOCKS[id];
        return d ? d.solid : false;
      }
      getEntityTypeId() { throw new Error('abstract'); }
    }

    // ---- Mob (Mob.h:23, 249 lines) : extends MobEntity ----
    class Mob extends MobEntity {
      constructor(level) {
        super(level);
        // VERIFIED Mob init list (Mob.cpp:27-68) — unchanged per Entry 26
        this.health = 10;  // VERIFIED Mob.cpp:73 — health=10 (NOT getMaxHealth yet)
        this.lastHealth = 20;
        this.hurtTime = 0;
        this.hurtDuration = 0;
        this.hurtDir = 0;
        this.deathTime = 0;
        this.attackTime = 0;
        this.tilt = 0; this.oTilt = 0;
        this.bob = 0; this.oBob = 0;
        this.xxa = 0; this.yya = 0; this.yRotA = 0;
        this.run = 0; this.oRun = 0;
        this.walkAnimSpeed = 0; this.walkAnimSpeedO = 0; this.walkAnimPos = 0;
        this.attackAnim = 0; this.oAttackAnim = 0;
        this.walkingSpeed = 0.1;  // VERIFIED Mob.h: DEFAULT_WALK_SPEED
        this.flyingSpeed = 0.02;  // VERIFIED Mob.h: DEFAULT_FLY_SPEED
        this.runSpeed = 0.7;
        this.noActionTime = 0;
        this.lookingAtId = 0;
        this.lookTime = 0;
        this.jumping = false;
        this.swinging = false;
        this.swingTime = 0;
        this.invulnerableTime = 0;
        this.invulnerableDuration = 20;
        this.yBodyRot = 0; this.yBodyRotO = 0;
        this.timeOffs = Math.random() * 12398;  // VERIFIED Mob.cpp:78
        this.yRot = Math.random() * Math.PI * 2;  // VERIFIED Mob.cpp:79
        this.footSize = 0.5;  // VERIFIED Mob.cpp:81
        this.blocksBuilding = true;  // VERIFIED Mob.cpp:75 — overrides Entity's false
        // §27.5 / §27.6 fields
        this.ambientSoundTime = 0;
        this.defaultLookAngle = 0;
        this.animStep = 0; this.animStepO = 0;
        this.arrowCount = 0;
        this.removeArrowTime = 0;
        // §27.6 network lerp (dead in browser port — keep structure)
        this.lSteps = 0;
        this.lx = 0; this.ly = 0; this.lz = 0;
        this.lyr = 0; this.lxr = 0;
      }

      // §27.6 — Mob::tick (Mob.cpp:270-376) — EXACT
      tick() {
        super.tick();  // Entity::tick → Entity::baseTick

        // §27.6 arrow-in-body countdown (60-tick cycle)
        if (this.arrowCount > 0) {
          if (this.removeArrowTime <= 0) {
            this.removeArrowTime = 20 * 3;  // 60 ticks
          }
          this.removeArrowTime--;
          if (this.removeArrowTime <= 0) {
            this.arrowCount--;
          }
        }

        // §27.6 network lerp (dead code in single-player port — keep structure)
        if (this.lSteps > 0) {
          const xt = this.x + (this.lx - this.x) / this.lSteps;
          const yt = this.y + (this.ly - this.y) / this.lSteps;
          const zt = this.z + (this.lz - this.z) / this.lSteps;
          let yrd = this.lyr - this.yRot;
          while (yrd < -180) yrd += 360;
          while (yrd >= 180) yrd -= 360;
          this.yRot += yrd / this.lSteps;
          this.xRot += (this.lxr - this.xRot) / this.lSteps;
          this.lSteps--;
          this.setPos(xt, yt, zt);
        }

        this.aiStep();  // §27.8 — virtual (Chicken overrides)

        this.updateWalkAnim();

        // §27.6 body rotation lerp — local xd/zd (NOT the velocity fields)
        const dxLocal = this.x - this.xo;
        const dzLocal = this.z - this.zo;
        const sideDist = Math.sqrt(dxLocal * dxLocal + dzLocal * dzLocal);
        let yBodyRotT = this.yBodyRot;
        let walkSpeed = 0;
        this.oRun = this.run;
        let tRun = 0;
        if (sideDist <= 0.05) {
          // §27.6 commented: animStep = 0;
        } else {
          tRun = 1;
          walkSpeed = sideDist * 3;
          yBodyRotT = Math.atan2(dzLocal, dxLocal) * (180 / Math.PI) - 90;
        }
        if (this.attackAnim > 0) {
          yBodyRotT = this.yRot;
        }
        if (!this.onGround) {
          tRun = 0;
        }
        this.run = this.run + (tRun - this.run) * 0.3;

        let yBodyRotD = yBodyRotT - this.yBodyRot;
        while (yBodyRotD < -180) yBodyRotD += 360;
        while (yBodyRotD >= 180) yBodyRotD -= 360;
        this.yBodyRot += yBodyRotD * 0.3;

        let headDiff = this.yRot - this.yBodyRot;
        while (headDiff < -180) headDiff += 360;
        while (headDiff >= 180) headDiff -= 360;
        const behind = headDiff < -90 || headDiff >= 90;
        if (headDiff < -75) headDiff = -75;
        if (headDiff >= 75) headDiff = +75;
        this.yBodyRot = this.yRot - headDiff;
        if (headDiff * headDiff > 50 * 50) {
          this.yBodyRot += headDiff * 0.2;
        }
        if (behind) {
          walkSpeed *= -1;
        }

        // §27.6 wrap-normalize rotation old-values (shortest-path next tick)
        while (this.yRot - this.yRotO < -180) this.yRotO -= 360;
        while (this.yRot - this.yRotO >= 180) this.yRotO += 360;
        while (this.yBodyRot - this.yBodyRotO < -180) this.yBodyRotO -= 360;
        while (this.yBodyRot - this.yBodyRotO >= 180) this.yBodyRotO += 360;
        while (this.xRot - this.xRotO < -180) this.xRotO -= 360;
        while (this.xRot - this.xRotO >= 180) this.xRotO += 360;

        this.animStep += walkSpeed;
      }

      // §27.5 — Mob::baseTick (Mob.cpp:148-237) — EXACT
      baseTick() {
        this.oAttackAnim = this.attackAnim;
        super.baseTick();  // §27.3 Entity::baseTick

        // §27.5 ambient sound timer — (ambientSoundTime++ & 15) == 0 AND random(2000) < ambientSoundTime
        const oldAmbient = this.ambientSoundTime++;
        if ((oldAmbient & 15) === 0 && Math.floor(Math.random() * 2000) < this.ambientSoundTime) {
          this.ambientSoundTime = -this.getAmbientSoundInterval();
          this.playAmbientSound();
        }

        // §27.5 suffocation — isInWall hurt
        if (this.isAlive() && this.isInWall()) {
          this.hurt(null, 1);
        }

        // §27.5 drowning
        if (this.isAlive() && this.isUnderLiquid('water') && !this.isWaterMob()) {
          this.airSupply--;
          if (this.airSupply === -20) {
            this.airSupply = 0;
            // §27.5 bubble particles — skipped in browser port
            this.hurt(null, 2);
          }
        } else {
          this.airSupply = this.airCapacity;
        }

        this.oTilt = this.tilt;
        if (this.attackTime > 0) this.attackTime--;
        if (this.hurtTime > 0) this.hurtTime--;
        if (this.invulnerableTime > 0) this.invulnerableTime--;

        // §27.5 death sequence — deathTime > TicksPerSecond (20)
        if (this.health <= 0) {
          this.deathTime++;
          if (this.deathTime > 20) {  // SharedConstants::TicksPerSecond = 20
            this.beforeRemove();
            this.remove();
            // §27.5 20 explode particles — skipped in browser port
          }
        }

        this.animStepO = this.animStep;

        // §27.5 re-snapshot for renderer interp (overrides super.baseTick's snapshots)
        this.yBodyRotO = this.yBodyRot;
        this.yRotO = this.yRot;
        this.xRotO = this.xRot;

        // §27.5 network send (server-only) — no-op in browser port (no RakNet)
      }

      // §27.8 — Mob::aiStep (Mob.cpp:688-757) — EXACT
      aiStep() {
        if (this.isImmobile()) {
          this.jumping = false;
          this.xxa = 0;
          this.yya = 0;
          this.yRotA = 0;
        } else {
          if (!this.interpolateOnly()) {
            if (this.useNewAi()) {
              this.newServerAiStep();  // §27.8 new-AI branch — stub (no monster classes yet)
            } else {
              this.updateAi();  // §27.9 — virtual (PathfinderMob::updateAi)
            }
          }
        }

        // §27.8 jumping — water/lava swim kick or jumpFromGround
        const inWater = this.isInWater();
        const inLava = this.isInLava();
        if (this.jumping) {
          if (inWater) {
            this.yd += 0.04;
          } else if (inLava) {
            this.yd += 0.04;
          } else if (this.onGround) {
            this.jumpFromGround();
          }
        }

        // §27.8 input decay
        this.xxa *= 0.98;
        this.yya *= 0.98;
        this.yRotA *= 0.9;

        // §27.8 save-modify-restore walkingSpeed/flyingSpeed
        const normalSpeed = this.walkingSpeed;
        const normalAirControllSpeed = this.flyingSpeed;
        this.walkingSpeed *= this.getWalkingSpeedModifier();  // virtual
        this.flyingSpeed *= this.getWalkingSpeedModifier();
        this.travel(this.xxa, this.yya);  // §27.7 — virtual (Mob::travel)
        this.walkingSpeed = normalSpeed;
        this.flyingSpeed = normalAirControllSpeed;

        // §27.8 push entities — bb.grow(0.2, 0, 0.2) (NOT Y — only at foot level)
        const playerThis = this.isPlayer() ? this : null;
        if (playerThis === null || !playerThis.isSleeping()) {
          // §27.8 iterate nearby entities (only X/Z grown, skip sleeping players)
          const growBox = this.bb.grow(0.2, 0, 0.2);
          for (const other of mobs) {
            if (other === this) continue;
            if (other.removed) continue;
            if (other.isPlayer() && other.isSleeping()) continue;
            if (!growBox.intersects(other.bb)) continue;
            if (other.isPushable()) other.push(this);
          }
        }
      }

      // §27.7 — Mob::travel (Mob.cpp:558-626) — EXACT
      travel(xa, ya) {
        if (this.isInWater()) {
          // §27.7 water branch
          const yo = this.y;
          this.moveRelative(xa, ya, 0.02);
          this.move(this.xd, this.yd, this.zd);
          this.xd *= 0.80;
          this.yd *= 0.80;
          this.zd *= 0.80;
          this.yd -= 0.02;
          if (this.horizontalCollision && this.isFree(this.xd, this.yd + 0.6 - this.y + yo, this.zd)) {
            this.yd = 0.3;
          }
        } else if (this.isInLava()) {
          // §27.7 lava branch (drag = 0.50, otherwise same as water)
          const yo = this.y;
          this.moveRelative(xa, ya, 0.02);
          this.move(this.xd, this.yd, this.zd);
          this.xd *= 0.50;
          this.yd *= 0.50;
          this.zd *= 0.50;
          this.yd -= 0.02;
          if (this.horizontalCollision && this.isFree(this.xd, this.yd + 0.6 - this.y + yo, this.zd)) {
            this.yd = 0.3;
          }
        } else {
          // §27.7 land branch
          // First friction compute (pre-move)
          let friction = 0.91;
          if (this.onGround) {
            friction = 0.6 * 0.91;
            const t = world.getBlock(Math.floor(this.x), Math.floor(this.bb.y0 - 0.5), Math.floor(this.z));
            if (t > 0) {
              friction = this.getTileFriction(t) * 0.91;
            }
          }
          // §27.7 friction2 = (0.6·0.6·0.91·0.91·0.6·0.91) / friction³ — CUBED denominator
          const friction2 = (0.6 * 0.6 * 0.91 * 0.91 * 0.6 * 0.91) / (friction * friction * friction);
          this.moveRelative(xa, ya, this.onGround ? this.walkingSpeed * friction2 : this.flyingSpeed);

          // §27.7 recompute friction post-move (move() may have changed onGround)
          friction = 0.91;
          if (this.onGround) {
            friction = 0.6 * 0.91;
            const t = world.getBlock(Math.floor(this.x), Math.floor(this.bb.y0 - 0.5), Math.floor(this.z));
            if (t > 0) {
              friction = this.getTileFriction(t) * 0.91;
            }
          }
          // §27.7 ladder logic
          if (this.onLadder()) {
            this.fallDistance = 0;
            if (this.yd < -0.15) this.yd = -0.15;
            if (this.isSneaking() && this.yd < 0) this.yd = 0;
          }
          this.move(this.xd, this.yd, this.zd);
          // §27.7 ladder climb kick
          if (this.horizontalCollision && this.onLadder()) {
            this.yd = 0.2;
          }
          this.yd -= 0.08;       // §27.7 gravity
          this.yd *= 0.98;       // §27.7 air drag (vertical)
          this.xd *= friction;   // §27.7 ground/air friction (horizontal)
          this.zd *= friction;
        }
      }

      // §27.9 — Mob::updateAi (Mob.cpp:760-802) — EXACT
      updateAi() {
        this.noActionTime++;

        // §27.9 checkDespawn(player) — getNearestPlayer is global `player`
        const nearestPlayer = (typeof player !== 'undefined') ? player : null;
        this.checkDespawn(nearestPlayer);

        this.xxa = 0;
        this.yya = 0;

        // §27.9 look-around AI
        const lookDistance = 8;
        if (Math.random() < 0.02) {
          // 2% chance per tick to look at nearest player within 8 blocks
          let nearbyPlayer = null;
          if (nearestPlayer) {
            const d = this.distanceToSqr(nearestPlayer.pos.x, nearestPlayer.pos.y, nearestPlayer.pos.z);
            if (d < lookDistance * lookDistance) nearbyPlayer = nearestPlayer;
          }
          if (nearbyPlayer) {
            this.lookingAtId = nearbyPlayer.entityId || 1;
            this.lookTime = 10 + Math.floor(Math.random() * 20);  // 10-29 ticks
          } else {
            this.yRotA = (Math.random() - 0.5) * 20;  // ±10°
          }
        }

        if (this.lookingAtId !== 0) {
          // §27.9 currently looking at someone
          const lookingAt = (this.lookingAtId === 1 && nearestPlayer) ? nearestPlayer : null;
          this.lookingAtId = 0;
          if (lookingAt) {
            this.lookAt(lookingAt, 10, this.getMaxHeadXRot());
            // §27.9 post-decrement: lookTime-- <= 0 uses pre-decrement value
            if (this.lookTime-- <= 0 || lookingAt.removed ||
                lookingAt.distanceToSqr(this.x, this.y, this.z) > lookDistance * lookDistance) {
              this.lookingAtId = 0;
            } else {
              this.lookingAtId = lookingAt.entityId || 1;
            }
          }
        } else {
          if (Math.random() < 0.05) {
            this.yRotA = (Math.random() - 0.5) * 20;
          }
          this.yRot += this.yRotA;
          this.xRot = this.defaultLookAngle;
        }

        // §27.9 water/lava swim-up — jumping = rand < 0.8
        const inWater = this.isInWater();
        const inLava = this.isInLava();
        if (inWater || inLava) this.jumping = Math.random() < 0.8;
      }

      // ---- Mob helpers (not in Entry 27; minimal stubs for browser port) ----
      jumpFromGround() { this.yd = 0.42; }  // §27.8 reference jump velocity
      getWalkingSpeedModifier() { return 1.0; }  // §27.8 Mob base
      getMaxHealth() { return 10; }
      getAmbientSoundInterval() { return 8; }  // §27.5 port note: Mob base = 8
      playAmbientSound() { /* stub — no audio in browser port */ }
      getMaxHeadXRot() { return 40; }  // §27.9 Mob base
      isImmobile() { return this.health <= 0; }
      interpolateOnly() { return false; }  // single-player port — always false
      useNewAi() { return false; }  // §27.8 — chicken uses old AI (updateAi)
      newServerAiStep() { /* §27.8 stub — no monster classes in this port */ }
      removeWhenFarAway() { return true; }
      lookAt(target, maxYaw, maxPitch) {
        if (!target) return;
        const dx = (target.pos ? target.pos.x : target.x) - this.x;
        const dz = (target.pos ? target.pos.z : target.z) - this.z;
        const targetYaw = Math.atan2(dz, dx) * (180 / Math.PI) - 90;
        let yawDiff = targetYaw - this.yRot;
        while (yawDiff < -180) yawDiff += 360;
        while (yawDiff >= 180) yawDiff -= 360;
        if (yawDiff > maxYaw) yawDiff = maxYaw;
        if (yawDiff < -maxYaw) yawDiff = -maxYaw;
        this.yRot += yawDiff;
        // §27.9 pitch toward target — simplified (full impl needs eye-height)
        void maxPitch;
      }
      checkDespawn(playerArg) {
        const p = playerArg || (typeof player !== 'undefined' ? player : null);
        if (!p) return false;
        const d = this.distanceToSqr(p.pos.x, p.pos.y, p.pos.z);
        if (d > 96 * 96) return true;  // hard despawn
        if (d > 32 * 32) {
          if (this.noActionTime > 600 && Math.random() < 1 / 800) return true;  // soft despawn
        } else {
          this.noActionTime = 0;  // player near — reset noActionTime (gates wander)
        }
        return false;
      }
      getTileFriction(id) {
        // §27.7 simplified Tile::tiles[t]->friction — 0.6 default, 0.98 ice
        if (id === 56) return 0.98;  // ice (this port: id 56)
        return 0.6;
      }
      updateWalkAnim() {
        // VERIFIED Mob::updateWalkAnim (Mob.cpp:628-637) — unchanged from prior port
        this.walkAnimSpeedO = this.walkAnimSpeed;
        const dx = this.x - this.xo, dz = this.z - this.zo;
        let wst = Math.sqrt(dx * dx + dz * dz) * 4;
        if (wst > 1) wst = 1;
        this.walkAnimSpeed += (wst - this.walkAnimSpeed) * 0.4;
        this.walkAnimPos += this.walkAnimSpeed;
        this.run += (Math.sqrt(dx * dx + dz * dz) - this.run) * 0.1;
      }
    }

    // ---- PathfinderMob (PathfinderMob.h:21, 65 lines) : extends Mob ----
    class PathfinderMob extends Mob {
      constructor(level) {
        super(level);
        // VERIFIED PathfinderMob init list (PathfinderMob.cpp:11-17) — unchanged
        this.attackTargetId = 0;
        this.holdGround = false;
        this.fleeTime = 0;
        this.strollX = 0; this.strollY = 0; this.strollZ = 0;
        this.strollTimer = 0;
      }

      // §27.10 — PathfinderMob::updateAi (PathfinderMob.cpp:59-185) — simplified per spec
      // EXACT §27.10 has full path-finding (path object, findPath, currentPos, waypoint-skip
      // loop, MAX_TURN=30 clamp). This simplified port uses strollTimer-based wander
      // toward strollX/Y/Z, but reproduces §27.11 findRandomStrollLocation EXACTLY
      // (including the SOURCE BUG `randInt(13) - 3` for Z).
      updateAi() {
        super.updateAi();  // §27.9 Mob::updateAi (look-around + xxa/yya clearing)

        // §27.10 fleeTime branch — flee from attackTarget (player in simplified port)
        if (this.fleeTime > 0) {
          this.fleeTime--;
          // Flee from player (no explicit attackTarget stored in simplified port)
          const dx = this.x - player.pos.x, dz = this.z - player.pos.z;
          const yRotD = Math.atan2(dz, dx) * (180 / Math.PI) - 90;
          let rotDiff = yRotD - this.yRot;
          while (rotDiff < -180) rotDiff += 360;
          while (rotDiff >= 180) rotDiff -= 360;
          // §27.10 MAX_TURN = 30
          if (rotDiff > 30) rotDiff = 30;
          if (rotDiff < -30) rotDiff = -30;
          this.yRot += rotDiff;
          this.yya = this.runSpeed;  // §27.10 yya = runSpeed
          if (this.onGround) this.jumping = true;
        } else {
          // §27.10 wander — strollTimer-based (simplified port)
          this.strollTimer--;
          if (this.strollTimer <= 0) {
            if (this.findRandomStrollLocation()) {
              // §27.10 spec: strollTimer = 100 + rand(100) on success
              this.strollTimer = 100 + Math.floor(Math.random() * 100);
            }
          }
          if (this.strollTimer > 0) {
            // §27.10 spec: set yya/xxa toward stroll target
            const dx = this.strollX - this.x, dz = this.strollZ - this.z;
            const d = Math.sqrt(dx * dx + dz * dz);
            if (d > 0.5) {
              const yRotD = Math.atan2(dz, dx) * (180 / Math.PI) - 90;
              let rotDiff = yRotD - this.yRot;
              while (rotDiff < -180) rotDiff += 360;
              while (rotDiff >= 180) rotDiff -= 360;
              if (rotDiff > 30) rotDiff = 30;
              if (rotDiff < -30) rotDiff = -30;
              this.yRot += rotDiff;
              this.yya = this.runSpeed;
            }
          }
        }
      }

      // §27.11 — PathfinderMob::findRandomStrollLocation (PathfinderMob.cpp:187-214) — EXACT
      // 10 samples, x = ±6, y = randInt(7)-3 ([-3,+3]), z = randInt(13)-3 ([-3,+9] — SOURCE BUG)
      // Tracks best via `if (value > best)` with best=-99999 initial.
      findRandomStrollLocation() {
        let hasBest = false;
        let xBest = -1, yBest = -1, zBest = -1;
        let best = -99999;
        for (let i = 0; i < 10; i++) {
          const xt = Math.floor(this.x + Math.floor(Math.random() * 13) - 6);  // [-6, +6]
          const yt = Math.floor(this.y + Math.floor(Math.random() * 7) - 3);   // [-3, +3]
          // SOURCE BUG (§27.11 line 198): `random.nextInt(13) - 3` for Z, gives [-3, +9]
          // instead of symmetric [-6, +6]. Preserved per Rule Zero.
          const zt = Math.floor(this.z + Math.floor(Math.random() * 13) - 3);  // [-3, +9] BUG
          const value = this.getWalkTargetValue(xt, yt, zt);
          if (value > best) {
            best = value;
            xBest = xt;
            yBest = yt;
            zBest = zt;
            hasBest = true;
          }
        }
        if (hasBest) {
          // §27.11 source calls `level->findPath(&path, this, xBest, yBest, zBest, 10, ...)`.
          // Simplified port stores the target in strollX/Y/Z and steers toward it directly.
          this.strollX = xBest;
          this.strollY = yBest;
          this.strollZ = zBest;
          return true;
        }
        return false;
      }

      // §27.11 port note: PathfinderMob base returns 0; Animal overrides (grass=+10, brightness-0.5).
      getWalkTargetValue(x, y, z) {
        // Simplified: 1 if walkable (2 air above solid ground), -1 if blocked.
        const here = world.getBlock(x, y, z);
        const above = world.getBlock(x, y + 1, z);
        const below = world.getBlock(x, y - 1, z);
        if (here || above) return -1;
        if (!below) return -1;
        if (below === 1) return 10;  // grass (this port: id 1)
        return 0.5;  // bright spot — simplified
      }

      // §27.10 virtual stubs — Animal / monsters override
      findAttackTarget() { return null; }  // animals don't attack
      shouldHoldGround() { return false; }  // §27.10 holdGround virtual
      isPathFinding() { return false; }
    }

    // ---- AgableMob (AgableMob.h:8, 30 lines) : extends PathfinderMob ----
    class AgableMob extends PathfinderMob {
      constructor(level) {
        super(level);
        // VERIFIED AgableMob init (AgableMob.cpp:3-5) — unchanged
        this.age = -1;
        this.setAge(0);  // VERIFIED AgableMob body: setAge(0) — age was -1 → 0
      }
      // VERIFIED AgableMob::aiStep — super.aiStep() + age progression
      aiStep() {
        super.aiStep();  // Mob::aiStep (or Chicken::aiStep if Chicken overrides)
        if (this.age > 0) this.age--;
        else if (this.age < 0) this.age++;
      }
      isBaby() { return this.age < 0; }
      setAge(a) { this.age = a; }
    }

    // ---- Animal (Animal.h:13, 39 lines) : extends AgableMob ----
    class Animal extends AgableMob {
      constructor(level) {
        super(level);
        // VERIFIED Animal init (Animal.cpp:8-13) — unchanged
        this.inLove = 0;
      }
      // VERIFIED Animal::getWalkingSpeedModifier — 0.7 (NOT 1.0)
      getWalkingSpeedModifier() { return 0.7; }
      // VERIFIED Animal::removeWhenFarAway — false (never despawn)
      removeWhenFarAway() { return false; }
      // §27.5 port note: Animal ambient sound interval = 12
      getAmbientSoundInterval() { return 12; }
    }

    // ---- Chicken (Chicken.h:11, 49 lines) : extends Animal ----
    class Chicken extends Animal {
      constructor(level) {
        super(level);
        // VERIFIED Chicken init (Chicken.cpp:14-19) — unchanged
        this.sheared = false;
        this.flap = 0;
        this.oFlap = 0;
        this.flapSpeed = 0;
        this.oFlapSpeed = 0;
        this.flapping = 1;
        this.eggTime = Math.floor(Math.random() * 6000) + 6000;  // 6000-12000 (NEVER decremented — egg code commented out in §27.12)
        this.setSize(0.3, 0.7);  // VERIFIED Chicken.cpp:18
      }
      // §27.12 — Chicken::aiStep (Chicken.cpp:33-61) — EXACT
      aiStep() {
        super.aiStep();  // AgableMob::aiStep → Mob::aiStep (travel happens here)

        // §27.12 wing flap save-olds
        this.oFlap = this.flap;
        this.oFlapSpeed = this.flapSpeed;

        // §27.12 flapSpeed — (-1 ground, +4 air) * 0.3, clamp [0,1]
        this.flapSpeed += (this.onGround ? -1 : 4) * 0.3;
        if (this.flapSpeed < 0) this.flapSpeed = 0;
        if (this.flapSpeed > 1) this.flapSpeed = 1;

        // §27.12 flapping reset on takeoff, decay *0.9
        if (!this.onGround && this.flapping < 1) this.flapping = 1;
        this.flapping *= 0.9;

        // §27.12 slow-fall — ONLY when !onGround && yd < 0
        if (!this.onGround && this.yd < 0) {
          this.yd *= 0.6;
        }

        // §27.12 flap advance
        this.flap += this.flapping * 2;
      }
      // VERIFIED Chicken::getMaxHealth — 4 (overrides Mob's 10)
      getMaxHealth() { return 4; }
      // VERIFIED Chicken::causeFallDamage — no-op (chickens don't take fall damage)
      causeFallDamage(distance) { /* no-op — DO NOT call super */ }
      // VERIFIED Chicken::getEntityTypeId — MobTypes::Chicken = 10
      getEntityTypeId() { return 10; }
    }

    // ---- MobFactory (MobFactory.h) — post-construction health re-set ----
    class MobFactory {
      static createChicken(level) {
        const chicken = new Chicken(level);
        // VERIFIED MobFactory.cpp:50-52: re-set health = getMaxHealth()
        // (C++ vtable-in-ctor quirk: during Mob ctor, getMaxHealth returns
        // Mob's 10, not Chicken's 4. Factory re-sets after full construction.)
        chicken.health = chicken.getMaxHealth();  // 4
        return chicken;
      }
    }

    // ---- Mob spawning + tick driver (uses class hierarchy) ----
    function spawnChicken(x, y, z) {
      const chicken = MobFactory.createChicken(null);
      chicken.setPos(x, y, z);
      // attach Three.js mesh
      const mesh = makeVanillaChickenModel() || makeChickenFallback();
      mesh.position.set(x, y, z);
      scene.add(mesh);
      chicken.mesh = mesh;
      chicken.bones = mesh.userData?.bones || null;
      chicken.body = mesh.userData?.bones?.get('body') || mesh.userData?.fallbackBody || mesh;
      mobs.push(chicken);
    }

    function updateMobs(dt) {
      window.__mobUpdateCount = (window.__mobUpdateCount || 0) + 1;
      // VERIFIED MobSpawner::tick — spawn rules
      if (mobs.length < 4 && Math.random() < 0.008) {
        const ang = Math.random() * Math.PI * 2;
        const dist = 12 + Math.random() * 14;
        const sx = player.pos.x + Math.cos(ang) * dist;
        const sz = player.pos.z + Math.sin(ang) * dist;
        for (let y = CHUNK_Y - 1; y >= 0; y--) {
          const id = world.getBlock(Math.floor(sx), y, Math.floor(sz));
          if (id && id !== 8 && id !== 9 && id !== 19) {
            if (id === 2 || id === 3) { spawnChicken(sx + 0.5, y + 1, sz + 0.5); }
            break;
          }
        }
      }
      // tick mobs at FIXED 20 tps (accumulator, matches player physics)
      mobPhysicsAccumMs += dt * 1000;
      let mobTicks = 0;
      while (mobPhysicsAccumMs >= TICK_MS && mobTicks < MAX_TICKS_PER_UPDATE) {
        mobPhysicsAccumMs -= TICK_MS;
        mobTicks++;
        for (const m of mobs) m.tick();
      }
      // sync meshes (Entity logic → Three.js render)
      for (let i = mobs.length - 1; i >= 0; i--) {
        const m = mobs[i];
        m.mesh.position.set(m.x, m.y, m.z);
        m.mesh.rotation.y = m.yRot;
        // ChickenModel::setupAnim — wing flap + leg swing
        if (m.bones) {
          const legSwing = Math.cos(m.walkAnimPos * 0.6662) * 1.4;
          const leftLeg = m.bones.get('leg0');
          const rightLeg = m.bones.get('leg1');
          if (leftLeg) leftLeg.rotation.x = legSwing;
          if (rightLeg) rightLeg.rotation.x = -legSwing;
          const wingBob = (Math.sin(m.flap) + 1) * m.flapSpeed;
          const leftWing = m.bones.get('wing0');
          const rightWing = m.bones.get('wing1');
          if (leftWing) leftWing.rotation.z = -wingBob * 0.3;
          if (rightWing) rightWing.rotation.z = wingBob * 0.3;
          if (m.bones.get('body')) m.bones.get('body').rotation.x = -wingBob * 0.1;
        }
        // despawn
        if (m.checkDespawn()) {
          scene.remove(m.mesh);
          mobs.splice(i, 1);
        }
      }
    }
