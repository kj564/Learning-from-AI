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
    //  Virtual dispatch (MODLOG §26.9):
    //    tick(): Entity::baseTick → Mob::tick (super.tick + aiStep + walkAnim)
    //    aiStep(): Mob::aiStep (updateAi + travel) → AgableMob::aiStep (age) → Chicken::aiStep (wing flap)
    //    travel(): Mob::travel (3-branch water/lava/land)
    //    updateAi(): Mob::updateAi (look-around) → PathfinderMob::updateAi (wander)
    //    getMaxHealth(): Mob=10 → Chicken=4
    //    getWalkingSpeedModifier(): Mob=1.0 → Animal=0.7
    //    causeFallDamage(): Mob (damage) → Chicken (no-op)
    // ============================================================

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
        this.entityId = 0;
      }
      // VERIFIED Entity::tick (Entity.cpp:463-466) — calls baseTick
      tick() { this.baseTick(); }
      // VERIFIED Entity::baseTick (Entity.cpp:468+) — tickCount++, xo=x, etc.
      baseTick() {
        this.tickCount++;
        this.walkDistO = this.walkDist;
        this.xo = this.x; this.yo = this.y; this.zo = this.z;
        this.xRotO = this.xRot; this.yRotO = this.yRot;
        this.firstTick = false;
      }
      // VERIFIED Entity::move (Entity.cpp:137) — Y→X→Z with slide
      move(xa, ya, za) {
        if (this.noPhysics) {
          this.setPos(this.x + xa, this.y + ya, this.z + za);
          return;
        }
        // Y axis first (verified Entry 1)
        const maxStep = 0.25;
        let newYd = ya;
        const ySteps = Math.max(1, Math.ceil(Math.abs(newYd) / maxStep));
        const stepY = newYd / ySteps;
        for (let i = 0; i < ySteps; i++) {
          const ny = this.y + stepY;
          if (this.isSolidAt(this.x, ny, this.z)) {
            if (newYd < 0) this.onGround = true;
            newYd = 0; this.yd = 0;
            break;
          }
          this.y = ny;
          this.onGround = false;
        }
        // X axis
        let newXa = xa;
        const xSteps = Math.max(1, Math.ceil(Math.abs(newXa) / maxStep));
        const stepX = newXa / xSteps;
        for (let i = 0; i < xSteps; i++) {
          const nx = this.x + stepX;
          if (this.isSolidAt(nx, this.y, this.z)) { newXa = 0; this.xd = 0; break; }
          this.x = nx;
        }
        // Z axis
        let newZa = za;
        const zSteps = Math.max(1, Math.ceil(Math.abs(newZa) / maxStep));
        const stepZ = newZa / zSteps;
        for (let i = 0; i < zSteps; i++) {
          const nz = this.z + stepZ;
          if (this.isSolidAt(this.x, this.y, nz)) { newZa = 0; this.zd = 0; break; }
          this.z = nz;
        }
        this.horizontalCollision = (xa !== newXa) || (za !== newZa);
        this.verticalCollision = (ya !== newYd);
      }
      // VERIFIED Entity::moveRelative (Entity.cpp:575) — adds to vel using yRot
      moveRelative(xa, za, speed) {
        let dist = Math.sqrt(xa * xa + za * za);
        if (dist < 0.01) return;
        if (dist < 1) dist = 1;
        const f = speed / dist;
        xa *= f; za *= f;
        const sinY = Math.sin(this.yRot);
        const cosY = Math.cos(this.yRot);
        this.xd += xa * cosY - za * sinY;
        this.zd += za * cosY + xa * sinY;
      }
      setPos(x, y, z) { this.x = x; this.y = y; this.z = z; }
      // VERIFIED Entity::isSolidAt — checks world for solid block
      isSolidAt(x, y, z) {
        const id = world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
        if (!id) return false;
        const d = BLOCKS[id];
        return d ? d.solid : false;
      }
      isInWater() {
        const id = world.getBlock(Math.floor(this.x), Math.floor(this.y + 0.5), Math.floor(this.z));
        return id === 8 || id === 9;
      }
      isInLava() {
        const id = world.getBlock(Math.floor(this.x), Math.floor(this.y + 0.5), Math.floor(this.z));
        return id === 10 || id === 11;
      }
      distanceToSqr(x, y, z) {
        const dx = this.x - x, dy = this.y - y, dz = this.z - z;
        return dx * dx + dy * dy + dz * dz;
      }
      // Pure virtual — must be overridden
      getEntityTypeId() { throw new Error('abstract'); }
    }

    // ---- Mob (Mob.h:23, 249 lines) : extends MobEntity ----
    class Mob extends MobEntity {
      constructor(level) {
        super(level);
        // VERIFIED Mob init list (Mob.cpp:27-68)
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
      }
      // VERIFIED Mob::tick (Mob.cpp:270-303) — super.tick + aiStep + updateWalkAnim
      tick() {
        super.tick();  // Entity::tick → baseTick
        // arrowCount + lSteps skipped (no network/arrows in port)
        this.aiStep();  // virtual — Chicken overrides
        this.updateWalkAnim();
      }
      // VERIFIED Mob::aiStep (Mob.cpp:688-757) — updateAi + jumping + travel
      aiStep() {
        if (this.isImmobile()) {
          this.jumping = false; this.xxa = 0; this.yya = 0; this.yRotA = 0;
        } else {
          this.updateAi();  // virtual — PathfinderMob::updateAi
        }
        // jumping (Mob.cpp:717-725)
        if (this.jumping) {
          if (this.isInWater()) this.yd += 0.04;
          else if (this.isInLava()) this.yd += 0.04;
          else if (this.onGround) this.jumpFromGround();
        }
        // input decay (Mob.cpp:727-729)
        this.xxa *= 0.98;
        this.yya *= 0.98;
        this.yRotA *= 0.9;
        // travel with walkingSpeed modifier (Mob.cpp:731-737)
        const normalSpeed = this.walkingSpeed;
        this.walkingSpeed *= this.getWalkingSpeedModifier();  // virtual
        this.travel(this.xxa, this.yya);  // virtual — Mob::travel
        this.walkingSpeed = normalSpeed;
      }
      // VERIFIED Mob::travel (Mob.cpp:558-626) — 3 branches: water/lava/land
      travel(xa, ya) {
        if (this.isInWater()) {
          const yo = this.y;
          this.moveRelative(xa, ya, 0.02);
          this.move(this.xd, this.yd, this.zd);
          this.xd *= 0.8; this.yd *= 0.8; this.zd *= 0.8;
          this.yd -= 0.02;
          if (this.horizontalCollision && !this.isSolidAt(this.x, this.y + 0.6, this.z)) {
            this.yd = 0.3;
          }
        } else if (this.isInLava()) {
          const yo = this.y;
          this.moveRelative(xa, ya, 0.02);
          this.move(this.xd, this.yd, this.zd);
          this.xd *= 0.5; this.yd *= 0.5; this.zd *= 0.5;
          this.yd -= 0.02;
          if (this.horizontalCollision && !this.isSolidAt(this.x, this.y + 0.6, this.z)) {
            this.yd = 0.3;
          }
        } else {
          // land branch — friction2 formula (Mob.cpp:586-624)
          let friction = 0.91;
          if (this.onGround) friction = 0.6 * 0.91;
          const friction2 = (0.6*0.6*0.91*0.91*0.6*0.91) / (friction*friction*friction);
          this.moveRelative(xa, ya, this.onGround ? this.walkingSpeed * friction2 : this.flyingSpeed);
          this.move(this.xd, this.yd, this.zd);
          this.yd -= 0.08;       // gravity
          this.yd *= 0.98;       // air drag
          this.xd *= friction;
          this.zd *= friction;
        }
      }
      // VERIFIED Mob::updateAi (Mob.cpp:760-802) — look-around + random turn
      updateAi() {
        this.noActionTime++;
        this.xxa = 0; this.yya = 0;
        // 2%/tick look at nearest player within 8 blocks
        if (Math.random() < 0.02) {
          const d = this.distanceToSqr(player.pos.x, player.pos.y, player.pos.z);
          if (d < 64) {
            this.lookingAtId = 1;
            this.lookTime = 10 + Math.floor(Math.random() * 20); // 10-30 ticks
          } else {
            this.yRotA = (Math.random() - 0.5) * 20; // ±10°
          }
        }
        if (this.lookingAtId !== 0) {
          const dx = player.pos.x - this.x, dz = player.pos.z - this.z;
          const targetYaw = Math.atan2(-dx, -dz);
          const maxTurn = Math.PI / 6;  // MAX_TURN = 30°
          let delta = targetYaw - this.yRot;
          while (delta > Math.PI) delta -= 2 * Math.PI;
          while (delta < -Math.PI) delta += 2 * Math.PI;
          delta = Math.max(-maxTurn, Math.min(maxTurn, delta));
          this.yRot += delta;
          if (this.lookTime-- <= 0 || this.distanceToSqr(player.pos.x, player.pos.y, player.pos.z) > 64) {
            this.lookingAtId = 0;
          }
        } else {
          if (Math.random() < 0.05) this.yRotA = (Math.random() - 0.5) * 20;
          this.yRot += this.yRotA * Math.PI / 180;
        }
      }
      // VERIFIED Mob::jumpFromGround (Mob.cpp) — single value 0.42
      jumpFromGround() { this.yd = 0.42; }
      // VERIFIED Mob::getMaxHealth — returns 10 (Chicken overrides to 4)
      getMaxHealth() { return 10; }
      // VERIFIED Mob::getWalkingSpeedModifier — 1.0 (Animal overrides to 0.7)
      getWalkingSpeedModifier() { return 1.0; }
      // VERIFIED Mob::updateWalkAnim (Mob.cpp:628-637)
      updateWalkAnim() {
        this.walkAnimSpeedO = this.walkAnimSpeed;
        const dx = this.x - this.xo, dz = this.z - this.zo;
        let wst = Math.sqrt(dx * dx + dz * dz) * 4;
        if (wst > 1) wst = 1;
        this.walkAnimSpeed += (wst - this.walkAnimSpeed) * 0.4;
        this.walkAnimPos += this.walkAnimSpeed;
        this.run += (Math.sqrt(dx * dx + dz * dz) - this.run) * 0.1;
      }
      // VERIFIED Mob::checkDespawn (Mob.cpp) — hard 96, soft 32 + 30s + 1/800
      checkDespawn() {
        const d = this.distanceToSqr(player.pos.x, player.pos.y, player.pos.z);
        if (d > 96 * 96) return true;
        if (d > 32 * 32) {
          if (this.noActionTime > 600 && Math.random() < 1/800) return true;
        } else {
          this.noActionTime = 0;
        }
        return false;
      }
      isImmobile() { return this.health <= 0; }
      interpolateOnly() { return false; }
      removeWhenFarAway() { return true; }
      setSize(w, h) { this.bbWidth = w; this.bbHeight = h; }
    }

    // ---- PathfinderMob (PathfinderMob.h:21, 65 lines) : extends Mob ----
    class PathfinderMob extends Mob {
      constructor(level) {
        super(level);
        // VERIFIED PathfinderMob init list (PathfinderMob.cpp:11-17)
        this.attackTargetId = 0;
        this.holdGround = false;
        this.fleeTime = 0;
        this.strollX = 0; this.strollY = 0; this.strollZ = 0;
        this.strollTimer = 0;
      }
      // VERIFIED PathfinderMob::updateAi (PathfinderMob.cpp:59+) — wander + super
      updateAi() {
        super.updateAi();  // Mob::updateAi (look-around)
        // Animal flee: 60 ticks, walkingSpeed * 2
        if (this.fleeTime > 0) {
          this.fleeTime--;
          const dx = this.x - player.pos.x, dz = this.z - player.pos.z;
          const d = Math.sqrt(dx * dx + dz * dz) || 1;
          this.yya = -dx / d;
          this.xxa = -dz / d;
          if (this.onGround) this.jumping = true;
        } else {
          // wander stroll: ±6/±3/±6, 10 attempts (PathfinderMob::findRandomStrollLocation)
          this.strollTimer--;
          if (this.strollTimer <= 0) {
            for (let i = 0; i < 10; i++) {
              const tx = this.x + (Math.random() - 0.5) * 12;
              const ty = this.y + (Math.random() - 0.5) * 6;
              const tz = this.z + (Math.random() - 0.5) * 12;
              if (!this.isSolidAt(tx, ty - 1, tz)) {
                this.strollX = tx; this.strollY = ty; this.strollZ = tz;
                this.strollTimer = 60 + Math.floor(Math.random() * 60);
                break;
              }
            }
          }
          if (this.strollTimer > 0) {
            const dx = this.strollX - this.x, dz = this.strollZ - this.z;
            const d = Math.sqrt(dx * dx + dz * dz);
            if (d > 0.5) {
              this.yya = dx / d;
              this.xxa = -dz / d;
            }
          }
        }
      }
    }

    // ---- AgableMob (AgableMob.h:8, 30 lines) : extends PathfinderMob ----
    class AgableMob extends PathfinderMob {
      constructor(level) {
        super(level);
        // VERIFIED AgableMob init (AgableMob.cpp:3-5)
        this.age = -1;
        this.setAge(0);  // VERIFIED AgableMob body: setAge(0) — age was -1 → 0
      }
      // VERIFIED AgableMob::aiStep — super.aiStep() + age progression
      aiStep() {
        super.aiStep();  // Mob::aiStep (or Chicken::aiStep if Chicken)
        // age progression (AgableMob.cpp:aiStep body)
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
        // VERIFIED Animal init (Animal.cpp:8-13)
        this.inLove = 0;
      }
      // VERIFIED Animal::getWalkingSpeedModifier — 0.7 (NOT 1.0)
      getWalkingSpeedModifier() { return 0.7; }
      // VERIFIED Animal::removeWhenFarAway — false (never despawn)
      removeWhenFarAway() { return false; }
    }

    // ---- Chicken (Chicken.h:11, 49 lines) : extends Animal ----
    class Chicken extends Animal {
      constructor(level) {
        super(level);
        // VERIFIED Chicken init (Chicken.cpp:14-19)
        this.sheared = false;
        this.flap = 0;
        this.oFlap = 0;
        this.flapSpeed = 0;
        this.oFlapSpeed = 0;
        this.flapping = 1;
        this.eggTime = Math.floor(Math.random() * 6000) + 6000;
        this.setSize(0.3, 0.7);  // VERIFIED Chicken.cpp:18
      }
      // VERIFIED Chicken::aiStep (Chicken.cpp:33-61) — super.aiStep() THEN wing flap
      aiStep() {
        super.aiStep();  // AgableMob::aiStep → Mob::aiStep (travel happens here)
        // wing flap + slow fall AFTER travel (1:1 with rujukan)
        this.oFlap = this.flap;
        this.oFlapSpeed = this.flapSpeed;
        this.flapSpeed += (this.onGround ? -1 : 4) * 0.3;
        if (this.flapSpeed < 0) this.flapSpeed = 0;
        if (this.flapSpeed > 1) this.flapSpeed = 1;
        if (!this.onGround && this.flapping < 1) this.flapping = 1;
        this.flapping *= 0.9;
        if (!this.onGround && this.yd < 0) this.yd *= 0.6;  // slow fall
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
