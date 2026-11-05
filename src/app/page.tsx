'use client'

/**
 * VoxelCraft 0.7.1 — TypeScript + WebGPU rebuild
 *
 * Replaces the previous mcpe-wasm iframe approach with a native TS engine.
 * Renderer: WebGPU (Vulkan-backed on Linux/Android desktop Chrome,
 * Metal on macOS, D3D12 on Windows — adapter.backend logged on init).
 *
 * Controls (MVP):
 *   Click canvas      → lock pointer
 *   WASD / Arrows     → move
 *   Mouse             → look
 *   Space             → up (fly) or jump (ground)
 *   Shift             → down (fly)
 *   F                 → toggle fly mode
 *   1..9              → select hotbar slot
 *   Wheel             → cycle hotbar
 *   Left click        → break block
 *   Right click        → place selected block
 *   Esc               → unlock pointer
 *
 * This is iteration 1 of the 0.7.1 rebuild. See MODLOG.md for the
 * reverse-engineering journal the rebuild is grounded in.
 */

import { useEffect, useRef, useState } from 'react'
import { Engine } from '@/engine/engine'
import { HOTBAR_SLOTS, DEFAULT_HOTBAR, BlockId, BlockColor } from '@/engine/core/types'

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<Engine | null>(null)
  const [ready, setReady] = useState(false)
  const [backend, setBackend] = useState<string>('—')
  const [slot, setSlot] = useState(0)
  const [fly, setFly] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    const engine = new Engine(canvasRef.current, {
      onReady: (b) => { setReady(true); setBackend(b) },
      onSlot: setSlot,
      onFlyChange: setFly,
    })
    engineRef.current = engine
    ;(window as any).voxelcraft = engine // expose for debugging
    engine.start().then((ok) => {
      if (!ok) setErr('WebGPU init failed. Try a recent Chrome/Edge on desktop.')
    }).catch((e) => setErr(String(e)))
    return () => { engine.stop(); engineRef.current = null }
  }, [])

  return (
    <main className="fixed inset-0 bg-black text-white overflow-hidden select-none">
      <canvas
        ref={canvasRef}
        className="h-screen w-screen block touch-none"
        style={{ outline: 'none' }}
      />

      {/* Status badge — top-left */}
      <div className="pointer-events-none fixed top-2 left-2 z-10 font-mono text-xs space-y-1">
        <div className="bg-black/60 px-2 py-1 rounded inline-block">
          VoxelCraft 0.7.1 · {ready ? 'ready' : 'init…'} · GPU: {backend}
        </div>
        {err && (
          <div className="bg-red-900/80 px-2 py-1 rounded inline-block max-w-sm">
            {err}
          </div>
        )}
        {!ready && !err && (
          <div className="bg-black/60 px-2 py-1 rounded inline-block">
            Booting WebGPU… (Vulkan/Metal/D3D12 backend)
          </div>
        )}
      </div>

      {/* Crosshair center */}
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center z-10">
        <div className="w-5 h-5 relative opacity-70">
          <div className="absolute left-1/2 top-0 -translate-x-1/2 w-0.5 h-5 bg-white" />
          <div className="absolute top-1/2 left-0 -translate-y-1/2 h-0.5 w-5 bg-white" />
        </div>
      </div>

      {/* Hotbar — bottom center */}
      <div className="pointer-events-none fixed bottom-3 left-1/2 -translate-x-1/2 z-10">
        <div className="flex gap-0.5 bg-black/40 p-1 rounded">
          {Array.from({ length: HOTBAR_SLOTS }).map((_, i) => {
            const block = DEFAULT_HOTBAR[i]
            const col = BlockColor[block] ?? [1, 0.2, 0.8]
            return (
              <div
                key={i}
                className={`w-10 h-10 rounded-sm border-2 flex items-center justify-center text-[10px] font-mono ${
                  i === slot ? 'border-white bg-white/10' : 'border-gray-600 bg-black/30'
                }`}
                style={{
                  backgroundColor: `rgb(${col[0] * 255 | 0}, ${col[1] * 255 | 0}, ${col[2] * 255 | 0})`,
                }}
                title={blockName(block)}
              >
                {i + 1}
              </div>
            )
          })}
        </div>
        <div className="text-center mt-1 text-[10px] font-mono opacity-70">
          {fly ? 'fly' : 'walk'} · {blockName(DEFAULT_HOTBAR[slot])}
        </div>
      </div>

      {/* Controls hint — top-right */}
      <div className="pointer-events-none fixed top-2 right-2 z-10 font-mono text-[11px] bg-black/50 px-2 py-1 rounded text-right space-y-0.5 max-w-xs">
        <div><b>Click</b> lock pointer · <b>WASD</b> move · <b>Mouse</b> look</div>
        <div><b>Space</b> jump/up · <b>Shift</b> down(fly) · <b>F</b> toggle fly</div>
        <div><b>1-9</b>/<b>wheel</b> hotbar · <b>L</b> break · <b>R</b> place</div>
      </div>
    </main>
  )
}

function blockName(id: number): string {
  const names: Record<number, string> = {
    [BlockId.AIR]: 'Air',
    [BlockId.STONE]: 'Stone',
    [BlockId.GRASS]: 'Grass',
    [BlockId.DIRT]: 'Dirt',
    [BlockId.COBBLESTONE]: 'Cobblestone',
    [BlockId.PLANKS]: 'Planks',
    [BlockId.BEDROCK]: 'Bedrock',
    [BlockId.WATER]: 'Water',
    [BlockId.LAVA]: 'Lava',
    [BlockId.SAND]: 'Sand',
    [BlockId.GRAVEL]: 'Gravel',
    [BlockId.LOG]: 'Log',
    [BlockId.LEAVES]: 'Leaves',
    [BlockId.GLASS]: 'Glass',
    [BlockId.CAKE]: 'Cake (0.7.x)',
    [BlockId.DIAMOND_ORE]: 'Diamond Ore',
  }
  return names[id] ?? `#${id}`
}
