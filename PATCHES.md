# VoxelCraft — Bug Fix Report (Mobile-Patched Build)

This document maps every bug you reported to its root cause in the MCPE 2013
source code, explains what was fixed at the JS layer, and what still needs a
C++/WASM recompile.

**Important context:** MCPE 2013 is a **mobile game** (Minecraft Pocket
Edition for Android/iOS). The control scheme is touch-based (D-pad on the
bottom-left + drag-to-look on the rest of the screen). The patched build
respects this — touch is primary; keyboard/mouse are optional desktop
fallbacks because multitouch is broken in the WASM export.

The patched build lives at `public/mcpe-wasm/minecraft-wasm.html` and is served
by the Next.js app at `/`.

---

## Summary table

| # | Bug (as reported)         | Root cause                                          | JS fix      | C++ recompile? |
|---|---------------------------|-----------------------------------------------------|-------------|-----------------|
| 1 | kontrol ngawur            | `Multitouch::feed` hardcoded `pointerId=0` in      | partial     | **yes** (critical) |
|   |                           | `main_emscripten.cpp:25` → multitouch collapse;    | (single-    |                 |
|   |                           | JS only forwarded `e.touches[0]`                    | finger OK)  |                 |
| 2 | inventori bodoh           | inventory opens via touch hotbar only; KEY_E        | —           | yes              |
|   |                           | opens inventory only on RPI build                   |             |                  |
| 3 | bow busuk                 | arrow spawns only when `!level->isClientSide`;      | —           | yes              |
|   |                           | creative inventory has no arrows                    |             |                  |
| 4 | item tidak lengkap        | creative inventory list omits ~20 items: pickaxe,   | —           | yes              |
|   |                           | shovel, axe, armor, food, arrows, dyes, bucket…     |             |                  |
| 5 | graphical glitch         | GLES1→WebGL2 layer hack-injects a perspective       | —           | yes (in JS shim) |
|   |                           | matrix when `isIdentityProj && count>50`            |             |                  |
| 6 | tidak bisa save           | `AppPlatform_emscripten::saveFile` returns         | toast       | yes              |
|   |                           | `false`; `-DNO_STORAGE` compile flag               | warns       |                  |
| 7 | options bug              | `Options::getMessage` returns "Not implemented";    | —           | yes              |
|   |                           | `Options::save/load` commented out; `viewDistance`  |             |                  |
|   |                           | hardcoded to 2                                      |             |                  |


---

## 1. kontrol ngawur (chaotic controls) — **mobile multitouch bug**

### The REAL root cause (mobile-first analysis)

MCPE 2013 is a **mobile game**. The control scheme is:
- Bottom-left D-pad (5 buttons: up/down/left/right/jump-in-center)
- Rest of screen = drag-to-look (turn area)
- **Two fingers expected simultaneously**: one on D-pad to move, one dragging
  to look around.

The C++ game tracks up to 12 independent touch pointers via the `Multitouch`
class (`Multitouch.h:9-174`). Each pointer has its own position, button state,
and `_wasPressed`/`_wasReleased` flags. The D-pad and turn-area logic iterate
`Multitouch::getActivePointerIdsThisUpdate()` (TouchscreenInput.cpp:222,
TouchTurnInput.h:29-42) and check each pointer's position independently.

**The critical bug** is in the WASM bridge at `wasm/main_emscripten.cpp:20-26`:

```cpp
extern "C" EMSCRIPTEN_KEEPALIVE void mouse_feed(
    char action, char data, short x, short y, short dx, short dy) {
    Mouse::feed(action, data, x, y, dx, dy);
    Multitouch::feed(action, data, x, y, 0);   // ← pointerId hardcoded 0
}
```

`Multitouch::feed` accepts a `pointerId` arg (Multitouch.h:121) and uses it to
select which of the 12 `TouchPointer` slots to write to. But the export
hardcodes `0`, so **every touch — regardless of finger — writes to pointer
slot 0**. A second finger doesn't create a second pointer; it overwrites
pointer 0's position.

Concrete failure:
1. Finger 1 touches D-pad N (134, 262) → Multitouch pointer 0 down at (134, 262)
2. `TouchscreenInput::tick` sees pointer 0 at (134, 262) → D-pad N pressed →
   player moves forward
3. Finger 2 touches turn area (600, 200) → `_mouse_feed` → `Multitouch::feed
   (..., 0)` → **pointer 0 jumps to (600, 200)**
4. `TouchscreenInput::tick` now sees pointer 0 at (600, 200) → it's in the
   turn area, not D-pad N → **player stops moving**
5. `TouchTurnInput` sees pointer 0 in turn area → look starts working

So you can **either** move **or** look — never both. This is what makes the
controls feel "ngawur" (chaotic): every time you try to look around while
walking, you stop walking; every time you try to walk while looking, your
look resets.

A second JS-side bug compounded this: the original `touchmove` handler only
forwarded `e.touches[0]` (one finger). So even touches that *should* have
reached C++ were dropped at the JS layer.

### What the patched build fixes (JS layer)

`public/mcpe-wasm/minecraft-wasm.html` now:

1. **Forwards ALL touches** (`e.changedTouches[i]` for every i), not just
   `e.touches[0]`. Each touch is fed to `_mouse_feed` with proper canvas-pixel
   coordinates and computed `dx/dy` from the previous position of that
   `touch.identifier`.
2. **Computes touch dx/dy** per finger (was always 0,0). Note: for touch,
   the game uses `Multitouch::getX(p)` (position-based delta via
   `cx - cxO` in TouchTurnInput.h:66), so this is a minor correctness fix
   rather than a functional one. The position tracking already handled
   single-finger drag-look correctly in the original build.
3. **Adds a touch-debug overlay** (press **T**) that shows colored dots
   where each finger lands on screen — so you can verify touch positions
   visually.
4. **Keeps mouse + keyboard as a desktop fallback** (clearly labeled in the
   help panel as "desktop fallback"). Since multitouch is broken in the C++
   export, desktop users need an alternative:
   - WASD → synthetic D-pad taps (using exact button rectangles from
     `TouchscreenInput_TestFps::onConfigChanged()`, TouchscreenInput.cpp:109-159)
   - Right-click → `action=2` (place/use item — was missing in original)
   - 1-9 → hotbar slot selection
   - P → pointer-lock for FPS free-look

### What the patched build CANNOT fix (needs C++ recompile)

The multitouch collapse. To fix it properly you must:

**Step 1** — add a new export in `wasm/main_emscripten.cpp`:

```cpp
extern "C" EMSCRIPTEN_KEEPALIVE void multitouch_feed(
    char action, char data, short x, short y, char pointerId) {
    Multitouch::feed(action, data, x, y, pointerId);
}
```

**Step 2** — add it to `EXPORTED_FUNCTIONS` in `wasm/build.sh`:

```bash
-s EXPORTED_FUNCTIONS="['_main','_malloc','_free','_mouse_feed','_keyboard_feed','_multitouch_feed','_auto_create_world','_get_block','_get_brightness','_get_tile_ptr','_is_screen_null']"
```

**Step 3** — recompile (`./wasm/build.sh`).

**Step 4** — update `minecraft-wasm.html` to call `_multitouch_feed` per
touch with `e.touch.identifier` (clamped to 0-11) as the pointerId:

```js
canvas.addEventListener('touchstart', function(e) {
  e.preventDefault();
  for (var i = 0; i < e.changedTouches.length; i++) {
    var t = e.changedTouches[i];
    var c = canvasCoords(t.clientX, t.clientY);
    _mouse_feed(1, 1, c.x, c.y, 0, 0);              // Mouse for GUI clicks
    _multitouch_feed(1, 1, c.x, c.y, t.identifier % 12);  // ← NEW: separate pointer per finger
  }
}, {passive:false});
```

After this recompile, multi-finger touch works: finger 1 → pointer 0 on the
D-pad, finger 2 → pointer 1 in the turn area, both tracked independently by
`Multitouch::getActivePointerIdsThisUpdate()`. Move + look simultaneously
becomes possible.

### Verified working in patched build (agent-browser)

- ✅ Menu navigation (Start Game → Create new) — touch & click both work
- ✅ Single-finger drag on canvas → look around (position-based, was already
  working but now with proper per-touch tracking)
- ✅ Touch-debug overlay (T) shows finger positions
- ✅ Desktop keyboard fallback (WASD, 1-9, Esc) works for testing
- ❌ **Move + look simultaneously** — still broken, needs C++ recompile above

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
