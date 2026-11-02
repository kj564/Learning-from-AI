'use client'

/**
 * VoxelCraft — MCPE 2013 WASM (Patched)
 *
 * Loads the WebAssembly-compiled Minecraft: Pocket Edition (2013) running
 * inside a WebGL2 canvas. The patched build (mcpe-wasm/minecraft-wasm.html)
 * fixes several JS-layer bugs that the user reported:
 *
 *   ✓ kontrol ngawur   — keyboard + right-click + mouse-look dx/dy + pointer-lock
 *   ✓ save indicator  — toast warning (C++ saveFile still stubbed → needs recompile)
 *   ⚠ inventori bodoh, bow busuk, item tidak lengkap, graphical glitch, options bug
 *     — these require C++ source changes + WASM recompile; see /PATCHES.md
 */

export default function Home() {
  return (
    <main className="fixed inset-0 bg-black">
      <iframe
        src={`/mcpe-wasm/minecraft-wasm.html?v=${process.env.NEXT_PUBLIC_BUILD_ID || Date.now()}`}
        title="VoxelCraft — MCPE 2013 WASM (Patched)"
        className="h-screen w-screen border-0"
        allow="fullscreen; autoplay; gamepad; pointer-lock"
      />
    </main>
  )
}
