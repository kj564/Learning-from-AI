'use client'

/**
 * VoxelCraft — MCPE 2013 WASM (Mobile Patched)
 *
 * Loads the WebAssembly-compiled Minecraft: Pocket Edition (2013) running
 * inside a WebGL2 canvas. This is a MOBILE game — touch controls are primary.
 *
 * The patched build (mcpe-wasm/minecraft-wasm.html) fixes JS-layer touch bugs:
 *
 *   ✓ All touches forwarded (was only e.touches[0])
 *   ✓ Touch dx/dy computed per finger
 *   ✓ Touch-debug overlay (press T) shows finger positions
 *   ✓ Right-click (mouse) for place/use item — desktop fallback
 *   ✓ Keyboard fallback (WASD, 1-9, Esc) for desktop testing
 *   ✓ Save-disabled toast warning (C++ saveFile stubbed → needs recompile)
 *
 * Still needs C++ recompile (see /PATCHES.md):
 *   ✗ Multitouch (gerak + lihat bareng) — main_emscripten.cpp hardcodes pointerId=0
 *   ⚠ inventori bodoh, bow busuk, item tidak lengkap, graphical glitch, options bug
 */

export default function Home() {
  return (
    <main className="fixed inset-0 bg-black">
      <iframe
        src="/mcpe-wasm/minecraft-wasm.html"
        title="VoxelCraft — MCPE 2013 WASM (Mobile Patched)"
        className="h-screen w-screen border-0"
        allow="fullscreen; autoplay; gamepad; pointer-lock"
      />
    </main>
  )
}
