'use client'

/**
 * VoxelCraft 0.7.1 + AI Chat (no restrictions)
 *
 * Game canvas + AI chat overlay. The AI answers ANYTHING — no domain restriction.
 * Toggle between game and chat with Tab key or the floating button.
 */

import { useEffect, useRef, useState } from 'react'
import { Engine } from '@/engine/engine'
import { initMaterials } from '@/engine/world/level/material/Material'
import { initTiles } from '@/engine/world/level/tile/tile-registry'
import { Item } from '@/engine/world/item/Item'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  time: string
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<Engine | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const [backend, setBackend] = useState('—')
  const [chatOpen, setChatOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string>('')
  const [err, setErr] = useState<string | null>(null)

  // === Game engine init ===
  useEffect(() => {
    if (!canvasRef.current) return
    initMaterials()
    initTiles()
    Item.initItems()

    const engine = new Engine(canvasRef.current, {
      onReady: (b) => { setReady(true); setBackend(b) },
    })
    engineRef.current = engine
    ;(window as any).voxelcraft = engine
    engine.start().then((ok) => {
      if (!ok) setErr('WebGPU/WebGL2 init gagal.')
    }).catch((e) => setErr(String(e)))
    return () => { engine.stop(); engineRef.current = null }
  }, [])

  // === Chat scroll to bottom ===
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // === Tab key toggle ===
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Tab') {
        e.preventDefault()
        setChatOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // === Send chat ===
  const sendChat = async () => {
    if (!input.trim() || loading) return
    const userMsg: ChatMessage = { role: 'user', content: input.trim(), time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg.content, sessionId }),
      })
      const data = await res.json()
      if (data.success) {
        setSessionId(data.sessionId)
        setMessages(prev => [...prev, { role: 'assistant', content: data.response, time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) }])
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: '❌ ' + (data.error || 'Error'), time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) }])
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: '❌ Koneksi gagal: ' + String(e), time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) }])
    } finally {
      setLoading(false)
    }
  }

  const clearChat = async () => {
    if (sessionId) {
      await fetch(`/api/chat?sessionId=${sessionId}`, { method: 'DELETE' })
    }
    setMessages([])
    setSessionId('')
  }

  return (
    <main className="fixed inset-0 bg-black text-white overflow-hidden select-none">
      {/* === Game canvas === */}
      <canvas
        ref={canvasRef}
        className="h-screen w-screen block touch-none"
        style={{ outline: 'none' }}
      />

      {/* === Status badge === */}
      <div className="pointer-events-none fixed top-2 left-2 z-20 font-mono text-xs space-y-1">
        <div className="bg-black/60 px-2 py-1 rounded inline-block">
          VoxelCraft 0.7.1 · {ready ? 'ready' : 'init…'} · GPU: {backend}
        </div>
        {err && (
          <div className="bg-red-900/80 px-2 py-1 rounded inline-block">{err}</div>
        )}
      </div>

      {/* === Crosshair === */}
      {!chatOpen && (
        <div className="pointer-events-none fixed inset-0 flex items-center justify-center z-10">
          <div className="w-5 h-5 relative opacity-70">
            <div className="absolute left-1/2 top-0 -translate-x-1/2 w-0.5 h-5 bg-white" />
            <div className="absolute top-1/2 left-0 -translate-y-1/2 h-0.5 w-5 bg-white" />
          </div>
        </div>
      )}

      {/* === Chat toggle button === */}
      <button
        onClick={() => setChatOpen(!chatOpen)}
        className="fixed bottom-4 right-4 z-30 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg transition-all text-2xl"
        title="Tab untuk toggle"
      >
        {chatOpen ? '🎮' : '💬'}
      </button>

      {/* === Chat panel === */}
      {chatOpen && (
        <div className="fixed right-0 top-0 bottom-0 w-full max-w-md z-20 bg-zinc-900/95 backdrop-blur-md border-l border-zinc-700 flex flex-col">
          {/* Header */}
          <div className="px-4 py-3 border-b border-zinc-700 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white">AI Chat</h2>
              <p className="text-[10px] text-zinc-400">No restrictions · Tab untuk toggle</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={clearChat}
                className="text-xs px-2 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-zinc-300"
              >
                Clear
              </button>
              <button
                onClick={() => setChatOpen(false)}
                className="text-xs px-2 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-zinc-300"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-zinc-500 text-sm mt-8">
                <p className="mb-2">💭 Tanya apa saja...</p>
                <p className="text-xs text-zinc-600">Tidak ada batasan topik</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-lg px-3 py-2 ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-zinc-700 text-zinc-100'}`}>
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                  <p className="text-[10px] text-zinc-400 mt-1">{msg.time}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-zinc-700 rounded-lg px-3 py-2">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-zinc-700">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.code === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat() } }}
                placeholder="Ketik pesan..."
                disabled={loading}
                className="flex-1 bg-zinc-800 text-white text-sm rounded-lg px-3 py-2 border border-zinc-600 focus:border-indigo-500 focus:outline-none disabled:opacity-50"
              />
              <button
                onClick={sendChat}
                disabled={loading || !input.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold rounded-lg px-4 py-2 transition-colors"
              >
                Kirim
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === Controls hint === */}
      {!chatOpen && (
        <div className="pointer-events-none fixed top-2 right-2 z-10 font-mono text-[11px] bg-black/50 px-2 py-1 rounded text-right space-y-0.5 max-w-xs">
          <div><b>Click</b> lock · <b>WASD</b> move · <b>Mouse</b> look</div>
          <div><b>Space</b> jump · <b>Shift</b> sneak · <b>1-9</b> hotbar</div>
          <div><b>L/R click</b> break/place · <b>Tab</b> chat</div>
        </div>
      )}
    </main>
  )
}
