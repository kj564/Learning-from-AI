/**
 * REA Panel — right-side panel (70% width) showing REA's reverse engineering tools.
 *
 * Features:
 *   - Connection status (auto-connect to REA HTTP MCP server at localhost:9849)
 *   - Tool browser: search + list all 263 REA tools
 *   - Tool execution: click a tool → fill params → run → see result
 *   - Analysis history: results from previous tool calls
 *
 * Layout: left=30% chat, right=70% this panel.
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search, Terminal, Play, Loader2, Check, X, ChevronDown,
  Cpu, Binary, FileSearch, Code, Bug, Shield, Zap, Folder,
} from 'lucide-react';
import {
  connectRea, disconnectRea, isReaConnected, runReaTool,
  useReaStatus, useReaTools, onReaStatus,
} from '@/lib/rea-client';

interface ToolResult {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  success: boolean;
  text: string;
  timestamp: number;
}

export default function ReaPanel({ onClose }: { onClose: () => void }) {
  const connected = useReaStatus();
  const tools = useReaTools();
  const [search, setSearch] = useState('');
  const [selectedTool, setSelectedTool] = useState<any>(null);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<ToolResult[]>([]);
  const [expandedResult, setExpandedResult] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Auto-connect on mount
  useEffect(() => {
    if (!connected) connectRea();
  }, []);

  // Auto-scroll results
  useEffect(() => {
    if (resultsRef.current) resultsRef.current.scrollTop = resultsRef.current.scrollHeight;
  }, [results]);

  const filtered = tools.filter((t: any) =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    (t.description || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleRun = useCallback(async () => {
    if (!selectedTool) return;
    setRunning(true);
    const args: Record<string, unknown> = {};
    const props = selectedTool.inputSchema?.properties || {};
    for (const [key, val] of Object.entries(paramValues)) {
      if (val.trim()) {
        // Try to parse JSON for arrays/objects, otherwise string
        try { args[key] = JSON.parse(val); } catch { args[key] = val; }
      }
    }
    const result = await runReaTool(selectedTool.name, args);
    const toolResult: ToolResult = {
      id: `r_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      tool: selectedTool.name,
      args,
      success: result.success,
      text: result.text || result.error || '',
      timestamp: Date.now(),
    };
    setResults((prev) => [...prev, toolResult]);
    setRunning(false);
  }, [selectedTool, paramValues]);

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden border-l border-zinc-800 bg-[#161616]">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-zinc-800 px-4">
        <Binary size={16} className="text-purple-400 shrink-0" />
        <span className="text-sm font-semibold text-zinc-100">REA</span>
        <span className="text-xs text-zinc-500">Reverse Engineer Anything</span>
        <span className={`ml-2 flex items-center gap-1 text-xs ${connected ? 'text-green-400' : 'text-red-400'}`}>
          <span className={`size-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
          {connected ? 'Connected' : 'Offline'}
        </span>
        <span className="text-xs text-zinc-600">·</span>
        <span className="text-xs text-zinc-500">{tools.length} tools</span>
        <div className="flex-1" />
        {!connected && (
          <button onClick={() => connectRea()} className="text-xs text-blue-400 hover:text-blue-300">
            Reconnect
          </button>
        )}
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
          ✕
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Left: tool list */}
        <div className="w-72 shrink-0 overflow-y-auto border-r border-zinc-800">
          {/* Search */}
          <div className="p-2 sticky top-0 bg-[#161616] z-10">
            <div className="flex items-center gap-2 rounded-lg bg-zinc-800/60 px-2.5 py-1.5">
              <Search size={14} className="text-zinc-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search 263 tools..."
                className="w-full bg-transparent text-sm text-zinc-200 placeholder:text-zinc-500 outline-none"
              />
            </div>
          </div>

          {/* Tool list */}
          <div className="px-1 pb-2">
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-center text-xs text-zinc-500">
                {connected ? 'No tools match' : 'Not connected to REA'}
              </div>
            )}
            {filtered.map((tool: any) => (
              <button
                key={tool.name}
                onClick={() => {
                  setSelectedTool(tool);
                  setParamValues({});
                }}
                className={`group flex w-full items-start gap-2 rounded-lg px-2.5 py-1.5 text-start transition ${
                  selectedTool?.name === tool.name ? 'bg-zinc-800' : 'hover:bg-zinc-800/50'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium text-zinc-200">{tool.name}</div>
                  <div className="truncate text-[10px] text-zinc-500">{tool.description?.slice(0, 80)}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right: tool detail + results */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Tool detail */}
          {selectedTool && (
            <div className="shrink-0 border-b border-zinc-800 p-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-sm font-medium text-zinc-100">{selectedTool.name}</span>
                <span className="text-xs text-zinc-500">·</span>
                <span className="text-xs text-zinc-500">
                  {Object.keys(selectedTool.inputSchema?.properties || {}).length} params
                </span>
              </div>
              <p className="mb-3 text-xs text-zinc-400">{selectedTool.description}</p>

              {/* Params */}
              {Object.entries(selectedTool.inputSchema?.properties || {}).length > 0 && (
                <div className="space-y-2">
                  {Object.entries(selectedTool.inputSchema?.properties || {}).map(([key, schema]: [string, any]) => (
                    <div key={key}>
                      <label className="mb-0.5 block text-[11px] font-medium text-zinc-400">
                        {key}
                        {selectedTool.inputSchema?.required?.includes(key) && (
                          <span className="text-red-400"> *</span>
                        )}
                        <span className="ml-1 text-zinc-600">({schema.type || 'any'})</span>
                      </label>
                      <input
                        value={paramValues[key] || ''}
                        onChange={(e) => setParamValues((prev) => ({ ...prev, [key]: e.target.value }))}
                        placeholder={schema.description?.slice(0, 60) || ''}
                        className="w-full rounded-md border border-zinc-700 bg-zinc-800/50 px-2.5 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-purple-500"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Run button */}
              <button
                onClick={handleRun}
                disabled={running || !connected}
                className="mt-3 flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-purple-700 disabled:opacity-50"
              >
                {running ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                {running ? 'Running...' : 'Run tool'}
              </button>
            </div>
          )}

          {/* Results */}
          <div ref={resultsRef} className="min-h-0 flex-1 overflow-y-auto p-3">
            {results.length === 0 && (
              <div className="flex h-full items-center justify-center text-center text-xs text-zinc-600">
                <div>
                  <Binary size={32} className="mx-auto mb-2 opacity-50" />
                  <p>Run a tool to see results here</p>
                  <p className="mt-1 text-zinc-700">263 reverse engineering tools available</p>
                </div>
              </div>
            )}
            {results.map((r) => (
              <div key={r.id} className="mb-3 rounded-lg border border-zinc-800 bg-zinc-900/50">
                {/* Result header */}
                <button
                  onClick={() => setExpandedResult(expandedResult === r.id ? null : r.id)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-start"
                >
                  {r.success ? (
                    <Check size={12} className="text-green-400 shrink-0" />
                  ) : (
                    <X size={12} className="text-red-400 shrink-0" />
                  )}
                  <span className="font-mono text-xs text-zinc-200">{r.tool}</span>
                  <span className="text-xs text-zinc-600">
                    {new Date(r.timestamp).toLocaleTimeString()}
                  </span>
                  <ChevronDown
                    size={12}
                    className={`ml-auto text-zinc-500 transition ${expandedResult === r.id ? 'rotate-180' : ''}`}
                  />
                </button>
                {/* Result body */}
                {expandedResult === r.id && (
                  <div className="border-t border-zinc-800 p-3">
                    {r.args && Object.keys(r.args).length > 0 && (
                      <div className="mb-2 text-[10px] text-zinc-500">
                        Args: {JSON.stringify(r.args, null, 2)}
                      </div>
                    )}
                    <pre className="overflow-x-auto whitespace-pre-wrap text-xs text-zinc-300 max-h-96 overflow-y-auto">
                      {r.text}
                    </pre>
                  </div>
                )}
                {/* Collapsed preview */}
                {expandedResult !== r.id && (
                  <div className="px-3 pb-2 text-[10px] text-zinc-600 truncate">
                    {r.text.slice(0, 120)}...
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
