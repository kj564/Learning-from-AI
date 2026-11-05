'use client'

/**
 * VoxelCraft 0.7.1 — Faithful TS translation of the 0.6.1 source (Tile tree)
 *
 * This page is the proof-of-translation for iteration 2 of the rebuild.
 * Iteration 1 used fabricated constants and guessed tile IDs; iteration 2
 * replaces every one of those with a line-by-line translation of the
 * actual C++ source from rujukan/pocket-edition-2013.
 *
 * The page boots the engine modules in order (Material → Tile registry →
 * AABB/Vec3/Facing) and displays the resulting registry as evidence: the
 * IDs and descriptionIds below are the literal Tile::initTiles() output
 * from the C++ source, not invented values.
 *
 * Iteration 3 will re-wire the renderer + main loop back onto this registry
 * so the world uses the actual Material + Tile::isSolidRender +
 * Tile::getTexture system instead of the fabricated BlockColor table.
 */

import { useEffect, useState } from 'react'
import { initMaterials, Material } from '@/engine/world/level/material/Material'
import { initTiles } from '@/engine/world/level/tile/tile-registry'
import { Tiles } from '@/engine/world/level/tile/Tiles'
import { tiles, solid, lightBlock, lightEmission, translucent } from '@/engine/world/level/tile/Tile'

interface TileRow {
  id: number
  field: keyof typeof Tiles
  desc: string
  destroySpeed: number
  category: number
  isSolid: boolean
  lightBlock: number
  lightEmission: number
}

export default function Home() {
  const [rows, setRows] = useState<TileRow[]>([])
  const [count, setCount] = useState(0)

  useEffect(() => {
    // Run the faithful init sequence.
    initMaterials()
    initTiles()

    // Collect every registered tile from the Tiles singleton.
    const collected: TileRow[] = []
    for (const key of Object.keys(Tiles) as (keyof typeof Tiles)[]) {
      const t = Tiles[key]
      if (!t) continue
      collected.push({
        id: t.id,
        field: key,
        desc: t.getDescriptionId(),
        destroySpeed: (t as any).destroySpeed,
        category: t.category,
        isSolid: solid[t.id],
        lightBlock: lightBlock[t.id],
        lightEmission: lightEmission[t.id],
      })
    }
    collected.sort((a, b) => a.id - b.id)
    setRows(collected)
    setCount(tiles.filter(Boolean).length)
  }, [])

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 overflow-auto">
      <div className="max-w-5xl mx-auto p-6">
        <header className="mb-6">
          <h1 className="text-2xl font-mono font-bold">
            VoxelCraft 0.7.1 · Faithful TS translation
          </h1>
          <p className="text-sm text-zinc-400 mt-2 font-mono">
            Iteration 2 — line-by-line translation of Tile.cpp::initTiles() +
            Material.cpp::initMaterials() + Tile.h + AABB.h + Vec3.h + Facing.h.
            No more fabricated constants.
          </p>
        </header>

        <section className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
          <Stat label="Materials" value={countMaterials()} />
          <Stat label="Tiles registered" value={`${count} / 256`} />
          <Stat label="Solid blocks" value={solid.filter(Boolean).length} />
          <Stat label="Light emitters" value={lightEmission.filter((v) => v > 0).length} />
        </section>

        <section className="bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800">
          <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/80 font-mono text-xs uppercase tracking-wider text-zinc-500">
            Tile registry · {rows.length} entries · from Tile::initTiles() in rujukan source
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="w-full text-xs font-mono">
              <thead className="sticky top-0 bg-zinc-900/90 backdrop-blur">
                <tr className="text-zinc-400 text-left">
                  <th className="px-3 py-2">id</th>
                  <th className="px-3 py-2">field</th>
                  <th className="px-3 py-2">descriptionId</th>
                  <th className="px-3 py-2 text-right">destroyTime</th>
                  <th className="px-3 py-2 text-right">category</th>
                  <th className="px-3 py-2 text-center">solid</th>
                  <th className="px-3 py-2 text-right">lightBlk</th>
                  <th className="px-3 py-2 text-right">lightEm</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-zinc-900 hover:bg-zinc-800/50">
                    <td className="px-3 py-1.5 text-zinc-400">{r.id}</td>
                    <td className="px-3 py-1.5 text-emerald-300">{r.field}</td>
                    <td className="px-3 py-1.5 text-zinc-300">{r.desc}</td>
                    <td className="px-3 py-1.5 text-right text-zinc-400">{r.destroySpeed.toFixed(1)}</td>
                    <td className="px-3 py-1.5 text-right text-zinc-400">{r.category}</td>
                    <td className="px-3 py-1.5 text-center">
                      <span className={r.isSolid ? 'text-emerald-400' : 'text-zinc-600'}>
                        {r.isSolid ? '■' : '·'}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-right text-zinc-400">{r.lightBlock}</td>
                    <td className="px-3 py-1.5 text-right text-zinc-400">{r.lightEmission}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="mt-6 text-xs font-mono text-zinc-500">
          <p>
            Source:{' '}
            <code className="text-zinc-400">
              rujukan/pocket-edition-2013/mcpe-source/handheld/src/world/level/tile/Tile.cpp
            </code>
            . Every row above is a real Tile subclass instantiated by that file's
            initTiles() function, transcribed line-by-line in
            <code className="text-zinc-400"> src/engine/world/level/tile/tile-registry.ts</code>.
          </p>
          <p className="mt-2">
            Renderer + world + player will be re-wired onto this registry in iteration 3.
          </p>
        </footer>
      </div>
    </main>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded px-3 py-2">
      <div className="text-zinc-500 uppercase tracking-wider text-[10px]">{label}</div>
      <div className="text-zinc-200 text-base mt-1">{value}</div>
    </div>
  )
}

function countMaterials(): number {
  // Count non-null fields on the Material namespace.
  return Object.values(Material as Record<string, unknown>).filter((v) => v !== undefined && v !== null).length
}

void translucent
