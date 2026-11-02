# VoxelCraft — Bug Fix Report (Patched Build)

This document maps every bug you reported to its root cause in the MCPE 2013
source code, explains what was fixed at the JS layer, and what still needs a
C++/WASM recompile.

The patched build lives at `public/mcpe-wasm/minecraft-wasm.html` and is served
by the Next.js app at `/`.

---

## Summary table

| # | Bug (as reported)         | Root cause                                       | JS fix | C++ fix needed? |
|---|---------------------------|--------------------------------------------------|--------|------------------|
| 1 | kontrol ngawur            | keyboard never forwarded; right-click dropped;   | ✅ done | partial (see §1) |
|   |                           | mouse dx/dy always 0; touch-mode hardcoded      |        | yes              |
| 2 | inventori bodoh           | inventory opens via touch hotbar only; KEY_E      | —      | yes              |
|   |                           | opens inventory only on RPI build                |        |                  |
| 3 | bow busuk                 | arrow spawns only when `!level->isClientSide`;   | —      | yes              |
|   |                           | creative inventory has no arrows                  |        |                  |
| 4 | item tidak lengkap        | creative inventory list omits ~20 items: pickaxe, | —      | yes              |
|   |                           | shovel, axe, armor, food, arrows, dyes, bucket…   |        |                  |
| 5 | graphical glitch         | GLES1→WebGL2 layer hack-injects a perspective     | —      | yes (in JS shim) |
|   |                           | matrix when `isIdentityProj && count>50`          |        |                  |
| 6 | tidak bisa save           | `AppPlatform_emscripten::saveFile` returns       | toast  | yes              |
|   |                           | `false`; `-DNO_STORAGE` compile flag             | warns  |                  |
| 7 | options bug              | `Options::getMessage` returns "Not implemented"; | —      | yes              |
|   |                           | `Options::save/load` commented out; `viewDistance`|        |                  |
|   |                           | hardcoded to 2                                   |        |                  |

---

## 1. kontrol ngawur (chaotic controls)

### Root cause (from source)

`public/mcpe-wasm/minecraft-wasm.html` only wired **3** of the **6** input
channels the C++ game expects:

| Channel                    | C++ export              | Was wired? | Fix in patched build |
|----------------------------|-------------------------|------------|----------------------|
| Mouse move (action=0)      | `_mouse_feed(0,0,x,y)`  | ✅          | ✅ + dx/dy           |
| Mouse left (action=1)      | `_mouse_feed(1,1,x,y)`  | ✅          | ✅                   |
| Mouse right (action=2)     | `_mouse_feed(2,1,x,y)`  | ❌ missing | ✅ added             |
| Mouse wheel (action=3)     | `_mouse_feed(3,1,x,y)`  | ❌ missing | ✅ added             |
| Keyboard down             | `_keyboard_feed(k,1)`   | ❌ missing | ✅ added             |
| Keyboard up                | `_keyboard_feed(k,0)`   | ❌ missing | ✅ added             |

The C++ `mouse_feed` signature in `wasm/main_emscripten.cpp:20` is:

```cpp
extern "C" EMSCRIPTEN_KEEPALIVE void mouse_feed(
    char action, char data, short x, short y, short dx, short dy);
```

The original JS called `_mouse_feed(0, 0, c.x, c.y)` — only **4** args, so
`dx` and `dy` were always `0`. `MouseTurnInput` (`MODE_DELTA`) reads
`Mouse::getDX()/getDY()` for look (`MouseTurnInput.h:27-28`), so mouse-look
was dead.

`_keyboard_feed` is exported (`main_emscripten.cpp:27`) but the original JS
never attached any keyboard listener — so **all** keyboard input was
silently dropped. `player->setKey(key, isPressed)` (Minecraft.cpp:689) and
`Keyboard::isKeyDown()` therefore never saw WASD, E, Q, Shift, Space, Esc.

A second, deeper problem: the game is **hard-coded to touch mode**.
`AppPlatform::supportsTouchscreen()` returns `true` by default
(`rujukan/.../AppPlatform.h:124`) and `AppPlatform_emscripten` does not
override it, so `Minecraft::_supportsNonTouchscreen = !true = false`
(Minecraft.cpp:1141), and `useTouchscreen()` returns `true`. The game then
instantiates `TouchInputHolder` (touch D-pad + UnifiedTurnBuild) instead of
`MouseBuildInput`+`KeyboardInput`+`MouseTurnInput` (Minecraft.cpp:1245-1258).
In touch mode, `TouchscreenInput_TestFps::setKey()` is `#ifdef WIN32`-guarded
(TouchscreenInput.cpp:175), so keyboard WASD does **nothing** for movement.

### What the patched build does

In `minecraft-wasm.html` (patched), the input layer now:

1. **Forwards all keyboard events** to `_keyboard_feed(key, state)`. Shift
   is mapped to code `10` because `Keyboard::KEY_LSHIFT = 10` in this codebase
   (not the usual `16`).
2. **Forwards right-click and middle-click** as `action=2` and `action=3`.
3. **Computes dx/dy** for every mouse move (and uses `e.movementX/Y` when
   pointer-locked) and passes them as the 5th/6th `_mouse_feed` args.
4. **Synthesises D-pad touches** when WASD/Space are pressed, using the exact
   button rectangles from `TouchscreenInput_TestFps::onConfigChanged()`
   (TouchscreenInput.cpp:109-159):
   - `Bw = Bh = 84` (capped from `0.11 * 854 = 93.94` → `6 * 14 = 84`)
   - `BaseX = 8`, `BaseY = 220`
   - Up `(134, 262)`, Down `(134, 430)`, Left `(50, 346)`,
     Right `(218, 346)`, Jump `(134, 346)`
5. **Press P** toggles pointer-lock for FPS-style free-look (uses movementX/Y).
6. **Press H** opens a controls help panel; **F1** toggles the patch HUD.

### What still needs C++ recompile

- Override `AppPlatform_emscripten::supportsTouchscreen()` to return `false`
  so the non-touch input path (`MouseBuildInput` + `KeyboardInput` +
  `MouseTurnInput::MODE_DELTA`) is used. That path already works with mouse
  and keyboard natively.
- The platform-guarded key handlers in `Minecraft.cpp:718-799`
  (`#if defined(RPI)` / `#if defined(WIN32)`) need an `#elif defined(__EMSCRIPTEN__)`
  branch so E opens inventory, F toggles fly, T toggles third-person, etc.

### Verified working (agent-browser)

- ✅ Pressing **H** opens the help panel (keyboard events reach iframe).
- ✅ Pressing **W** moves the player forward (parallax shift confirmed by VLM).
- ✅ Pressing **D** strafes right; **S** moves back.
- ✅ Menu clicks (Start Game, Create new) work normally.

---

## 2. inventori bodoh (stupid inventory)

### Root cause

`IngameBlockSelectionScreen` (the inventory screen) is opened by
`screenChooser.setScreen(SCREEN_BLOCKSELECTION)`, which is triggered by
`KEY_E` only under `#if defined(RPI)` (Minecraft.cpp:718-721). The WASM build
defines neither `RPI` nor `WIN32`, so **no keyboard shortcut opens the
inventory**.

In touch mode, the inventory is opened by tapping the `...` hotbar overflow
button or the dedicated inventory button in `TouchInputHolder`. The mouse
left-click does work for `gui.handleClick()` (Minecraft.cpp:662), so clicking
the hotbar slot with the mouse selects it — but there is no on-screen
"open inventory" button reachable by mouse in the current build.

### Fix needed (C++ recompile)

Add an `#elif defined(__EMSCRIPTEN__)` branch to Minecraft.cpp:718 that calls
`screenChooser.setScreen(SCREEN_BLOCKSELECTION)` on `KEY_E`.

### What the patched build does

The help panel documents that tapping the hotbar `...` button or pressing
the touch inventory button is the way to open the inventory in this build.
A proper keyboard shortcut requires the C++ change above.

---

## 3. bow busuk (broken bow)

### Root cause

`BowItem::releaseUsing` (BowItem.h:25-42) only spawns an `Arrow` entity when
`!level->isClientSide` (BowItem.h:36). In single-player MCPE 2013 the
integrated server sets `isClientSide` on the level the player sees, so
`releaseUsing` runs but the `new Arrow(...)` branch is skipped — the bow
draws, plays the sound, consumes an arrow from the inventory, but **no
arrow entity is spawned**.

Additionally, the creative inventory (`Inventory::setupDefault` in
Inventory.cpp:122-254) adds a bow (line 253) but **no arrows** (Item::arrow
is never added). So even if `releaseUsing` worked, `player->hasResource(
Item::arrow->id)` would be false in survival; in creative,
`player->abilities.instabuild` is true so the draw starts, but the spawn is
still gated by `isClientSide`.

### Fix needed (C++ recompile)

- Make `Arrow` spawn in single-player: either spawn on the server side and
  replicate, or spawn directly when `level->isClientSide` is true in
  single-player mode (no remote clients to conflict with).
- Add `addItem(new ItemInstance(Item::arrow));` to the creative inventory
  in `Inventory::setupDefault()`.

---

## 4. item tidak lengkap (incomplete items)

### Root cause

`Inventory::setupDefault()` (Inventory.cpp:122-254) populates the creative
inventory with a fixed hand-written list. Items present: ~60 blocks, hoe,
sword_iron, bow, sign, bed, painting, door, seeds, dye_powder (white only).

Items **missing** from the creative inventory that should be there:

| Category  | Missing items                                                                 |
|-----------|-------------------------------------------------------------------------------|
| Tools     | `Item::pickAxe_*`, `Item::shovel_*`, `Item::hatchet_*` (all tiers), shears    |
| Combat    | `Item::arrow`, `Item::sword_*` (wood/stone/iron/gold/diamond except iron)     |
| Armor     | All armor pieces (`helmet_*`, `chestplate_*`, `leggings_*`, `boots_*`)       |
| Food      | `Item::apple`, `Item::bread`, `Item::porkchop_*`, `Item::fish`, `bowl`        |
| Materials | `Item::stick`, `Item::coal`, `Item::ironIngot`, `Item::goldIngot`,           |
|           | `Item::diamond`, `Item::emerald`, `Item::gunpowder`, `Item::string`,         |
|           | `Item::bone`, `Item::leather`, `Item::brick` (item), `Item::clay` (item),    |
|           | `Item::flint`, `Item::sugar`                                                  |
| Utility   | `Item::bucket`, `Item::waterBucket`, `Item::lavaBucket`, `Item::milkBucket`, |
|           | `Item::fishingRod`, `Item::flintAndSteel`, `Item::shears`, `Item::compass`,  |
|           | `Item::clock`, `Item::map`, `Item::spawnEgg_*`                               |
| Dyes      | Only `DyePowderItem::WHITE` is added; the other 15 dye colors are missing.   |

### Fix needed (C++ recompile)

Extend `Inventory::setupDefault()` to add the missing items. One-liner per
item, e.g. `addItem(new ItemInstance(Item::arrow));`.

---

## 5. graphical glitch

### Root cause

`minecraft-wasm.html` (GLES1→WebGL2 translation layer) has this hack in
`GL1.draw()`:

```js
var isIdentityProj = (proj[0] === 1.0 && proj[5] === 1.0 && proj[10] === 1.0);
if (isIdentityProj && count > 50) {
  // §Inject a 70° FOV perspective matrix when projection is identity
  // and we're drawing > 50 vertices (assumed to be the 3D world).
  ...
}
```

This was added because some draw paths leave the projection as identity when
the world is drawn. It works for the common case but causes glitches when:

- The C++ code sets a **different** projection (e.g. `glOrthof` for the GUI)
  and then draws > 50 vertices of GUI text — the JS overrides it with a
  perspective matrix, distorting the GUI.
- The near/far planes (0.05 / 1000) don't match what the C++ frustum culling
  expects, so chunks pop in/out at the wrong distance.

Additional glitches come from `_glPopMatrix` restoring matrices in
last-in-first-out order across mixed `PROJECTION`/`MODELVIEW` pushes — if
the C++ pushes PROJECTION then MODELVIEW then pops, the stack matches, but
if it pushes PROJECTION, draws, then pops (expecting PROJECTION) while the
top of stack is MODELVIEW, the wrong matrix is restored.

### Fix needed

Rewrite `GL1.draw()` to NOT inject a perspective matrix. Instead, properly
implement `_glFrustumf` / `_glPerspective` and have the C++ code call them
(the original GLES1 `glFrustumf` / `gluPerspective` are currently no-ops in
the stub list). This requires changes in both the JS shim and the C++
glue (`wasm/gl1_stubs.cpp`).

---

## 6. tidak bisa save (cannot save)

### Root cause

`AppPlatform_emscripten::saveFile` is a stub that returns `false`
(`wasm/AppPlatform_emscripten.cpp:69`):

```cpp
bool AppPlatform_emscripten::saveFile(const std::string& path,
                                       const void* data, int size) {
    return false;
}
```

The build flags in `wasm/build.sh` also pass `-DNO_STORAGE`, which disables
the `LevelStorage` code paths in the C++ source. So even if `saveFile`
returned `true`, the higher-level save system would not call it.

`Options::save()` and `Options::load()` are also fully commented out
(Options.cpp:256-349), so options are never persisted either.

### What the patched build does

Shows a toast 6 seconds after load:

> ⚠ Save is disabled in this WASM build (needs C++ recompile). Play in one
> sitting.

So the user knows not to expect persistence.

### Fix needed (C++ recompile)

1. Remove `-DNO_STORAGE` from `wasm/build.sh`.
2. Implement `saveFile` / `loadFile` in `AppPlatform_emscripten.cpp` using
   Emscripten's MEMFS (`FS.writeFile(path, data)`) + IDBFS for persistence,
   or `localStorage` for small saves.
3. Uncomment the file I/O in `Options::save()` / `Options::load()`.

---

## 7. options bug

### Root cause

Three distinct bugs in `Options.cpp`:

1. **`Options::getMessage()` returns a placeholder string**
   (Options.cpp:367-369):
   ```cpp
   std::string Options::getMessage(const Option* item) {
       return "Options::getMessage - Not implemented";
   }
   ```
   Every option label in the Options screen renders as
   `"Options::getMessage - Not implemented"`.

2. **`Options::save()` builds a StringVector but never writes it to a file**
   (Options.cpp:293-349 — all the `pw.println(...)` lines are commented out).

3. **`Options::load()` is entirely commented out** (Options.cpp:256-291).

4. **`viewDistance` is hard-coded to 2 on every `Options::update()` call**
   (Options.cpp:188):
   ```cpp
   void Options::update() {
       viewDistance = 2;   // ← resets user choice every reload
       ...
   }
   ```
   So the render-distance option in the Options screen appears to change but
   snaps back to "short" on the next tick.

### Fix needed (C++ recompile)

1. Implement `Options::getMessage()` using the Language table (the
   commented-out body at Options.cpp:371-411 is the correct implementation —
   just uncomment it).
2. Wire `Options::save()` / `Options::load()` to the Emscripten FS (depends
   on fix #6).
3. Delete the `viewDistance = 2;` line at Options.cpp:188, or gate it behind
   a "first load" flag.

---

## How to re-compile the WASM with the C++ fixes

The WASM was built with Emscripten. From the project root:

```bash
# 1. Install emsdk (one-time)
git clone https://github.com/emscripten-core/emsdk /tmp/emsdk
cd /tmp/emsdk && ./emsdk install latest && ./emsdk activate latest

# 2. Apply the C++ fixes described above, then:
cd /tmp/Surprise564
./wasm/build.sh
# → outputs public/mcpe-wasm/mcpe_emscripten_full.{js,wasm}
```

`build.sh` compiles ~344 MCPE .cpp files with `-O1` and links them into a
single 7.7 MB WASM. A clean build takes ~3-5 minutes on a modern machine.

---

## Verification

Run the Next.js dev server and open `/`:

- The patched game loads with a green "VoxelCraft Patched Build" HUD top-left.
- Press **H** for the controls help panel.
- Click **Start Game → Create new** to enter a world.
- Press **W A S D** to move (synthetic D-pad touch).
- Press **P** to toggle pointer-lock for free-look.
- Press **F1** to hide/show the patch HUD.

The "N 1 Issue" badge in the bottom-left of the agent-browser screenshot is
the browser's devtools console indicator (one Emscripten `no-this-alias`
lint warning in the pre-compiled glue) — not a game bug.
