'use client';

/**
 * SnapgentBar — native replication of the snapgentV3 extension UI.
 *
 * Features from the extension:
 *   - Status bar above composer with Start/Stop + MCP target selector
 *   - Bridge connection indicator (green/red dot)
 *   - Tool chips (animated cards showing tool execution status)
 *   - MCP servers dropdown (⋯ menu)
 *   - Session state (idle → starting → running → stopped)
 */

import { useState, useEffect, useRef } from 'react';
import {
  Terminal, Play, Square, ChevronDown, MoreVertical,
  Check, X, Loader2, Wrench, Eye, FileCode, FileEdit,
  Search, Sparkles, FolderOpen, GitBranch, Zap,
} from 'lucide-react';
import { useStore } from '@/lib/store';
import {
  connectBridge, disconnectBridge, isBridgeConnected,
  onBridgeStatus, listServers, listTools, runTool,
  useBridgeStatus, useAutoConnectBridge,
  extractSnapgentCommand,
} from '@/lib/snapgent-client';
import { toast } from 'sonner';

// Tool category → icon + color (from config.js toolCategory)
function toolCategory(name: string): { icon: typeof Wrench; color: string; label: string } {
  const n = (name || '').includes('/') ? name.split('/').pop() : (name || '');
  if (/^(get_workspace_info|get_project_info|list_dir|list_tree|find_files|search_files|read_file|read_files|read_file_lines|get_file_info|get_file_outline|list_commands|list_tools)$/.test(n))
    return { icon: Search, color: 'text-blue-400', label: 'read' };
  if (/^(create_file|write_file|edit_file|create_directory|move_file|copy_file|delete_file|apply_patch|git_add|git_commit)$/.test(n))
    return { icon: FileEdit, color: 'text-green-400', label: 'edit' };
  if (/^(git_status|git_diff|git_log|git_branches)$/.test(n))
    return { icon: GitBranch, color: 'text-orange-400', label: 'git' };
  if (/^(run_command|run_project_script|run_tests)$/.test(n))
    return { icon: Zap, color: 'text-amber-400', label: 'run' };
  return { icon: Wrench, color: 'text-zinc-400', label: 'tool' };
}

interface ToolChip {
  id: string;
  tool: string;
  params: Record<string, unknown>;
  status: 'running' | 'success' | 'error';
  result?: string;
  startTime: number;
  duration?: number;
}

export default function SnapgentBar({
  onCommandResult,
}: {
  onCommandResult: (command: string, result: { success: boolean; text?: string; error?: string }) => void;
}) {
  useAutoConnectBridge();
  const bridgeConnected = useBridgeStatus();
  const snapgentEnabled = useStore((s) => s.snapgentEnabled);
  const toggleSnapgent = useStore((s) => s.toggleSnapgent);
  const isGenerating = useStore((s) => s.isGenerating);

  const [servers, setServers] = useState<{ id: string; alive: boolean; tools: number }[]>([]);
  const [selectedTarget, setSelectedTarget] = useState('vscode');
  const [menuOpen, setMenuOpen] = useState(false);
  const [targetOpen, setTargetOpen] = useState(false);
  const [mcpEnabled, setMcpEnabled] = useState<Record<string, boolean>>({});
  const [chips, setChips] = useState<ToolChip[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLDivElement>(null);

  // Load servers when bridge connects
  useEffect(() => {
    if (!bridgeConnected) { setServers([]); return; }
    (async () => {
      const srvs = await listServers();
      setServers(srvs);
      // Auto-select first alive server
      const alive = srvs.find((s: any) => s.alive);
      if (alive) setSelectedTarget(alive.id);
    })();
  }, [bridgeConnected]);

  // Close menus on outside click
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
      if (targetRef.current && !targetRef.current.contains(e.target as Node)) setTargetOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  // Expose command executor to parent (page.tsx calls this via ref/callback)
  // Actually we expose it via a global event listener
  useEffect(() => {
    const handler = async (e: CustomEvent) => {
      const { command, params, chipId } = e.detail;
      // Add chip
      setChips((prev) => [...prev, {
        id: chipId, tool: command, params, status: 'running', startTime: Date.now(),
      }]);

      // Execute via bridge
      const result = await runTool(selectedTarget, command, params);
      const duration = Date.now() - (chips.find(c => c.id === chipId)?.startTime || Date.now());

      // Update chip
      setChips((prev) => prev.map(c => c.id === chipId ? {
        ...c, status: result.success ? 'success' : 'error',
        result: result.text || result.error || '',
        duration,
      } : c));

      // Auto-remove chip after 5s if success
      if (result.success) {
        setTimeout(() => setChips((prev) => prev.filter(c => c.id !== chipId)), 5000);
      }

      // Notify parent
      onCommandResult(command, result);
    };

    window.addEventListener('snapgent:execute' as any, handler as EventListener);
    return () => window.removeEventListener('snapgent:execute' as any, handler as EventListener);
  }, [selectedTarget, onCommandResult]);

  // Don't render if snapgent is off
  // Debug: always render something to verify component mounts
  if (!snapgentEnabled) return null; // Component is only rendered when snapgentEnabled is true (parent checks)

  return (
    <>
      {/* === Tool chips (rendered in chat area) === */}
      {chips.length > 0 && (
        <div className="mx-auto max-w-3xl px-4 space-y-1.5 mb-2">
          {chips.map((chip) => {
            const cat = toolCategory(chip.tool);
            const Icon = cat.icon;
            return (
              <div
                key={chip.id}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
                  chip.status === 'running' ? 'border-blue-500/30 bg-blue-500/5' :
                  chip.status === 'success' ? 'border-green-500/30 bg-green-500/5' :
                  'border-red-500/30 bg-red-500/5'
                }`}
              >
                <Icon size={14} className={cat.color + ' shrink-0'} />
                <span className="font-mono text-zinc-200">{chip.tool}</span>
                <span className="text-zinc-500">·</span>
                <span className="text-zinc-500 truncate max-w-xs">
                  {Object.entries(chip.params).slice(0, 2).map(([k, v]) => `${k}: ${String(v).slice(0, 30)}`).join(', ')}
                </span>
                {chip.status === 'running' && (
                  <span className="ml-auto flex items-center gap-1.5 text-blue-400">
                    <Loader2 size={12} className="animate-spin" />
                    <span className="tabular-nums">{Math.round((Date.now() - chip.startTime) / 1000)}s</span>
                  </span>
                )}
                {chip.status === 'success' && (
                  <span className="ml-auto flex items-center gap-1 text-green-400">
                    <Check size={12} />
                    {chip.duration && <span className="tabular-nums">{(chip.duration / 1000).toFixed(1)}s</span>}
                  </span>
                )}
                {chip.status === 'error' && (
                  <span className="ml-auto flex items-center gap-1 text-red-400">
                    <X size={12} />
                    <span className="truncate max-w-xs">{chip.result}</span>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* === Snapgent bar (above composer) === */}
      <div className="mx-auto max-w-3xl px-4 mb-2">
        <div className="flex items-center gap-2.5 rounded-xl border border-zinc-700/50 bg-zinc-800/40 px-3 py-2 text-xs">
          {/* Connection dot */}
          <span className={`size-2 shrink-0 rounded-full ${bridgeConnected ? 'bg-green-500' : 'bg-red-500'}`} />

          {/* Status text */}
          <span className={`shrink-0 font-medium ${bridgeConnected ? 'text-green-400' : 'text-red-400'}`}>
            {bridgeConnected ? 'Connected' : 'Offline'}
          </span>

          {/* Separator */}
          <span className="text-zinc-700">·</span>

          {/* MCP target selector */}
          <div className="relative" ref={targetRef}>
            <button
              onClick={() => bridgeConnected && setTargetOpen(v => !v)}
              disabled={!bridgeConnected}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-zinc-300 hover:bg-zinc-700/50 disabled:opacity-50 transition"
            >
              <Terminal size={12} className="text-amber-400" />
              <span>{servers.find(s => s.id === selectedTarget)?.id || selectedTarget}</span>
              <ChevronDown size={10} className="text-zinc-500" />
            </button>
            {targetOpen && (
              <div className="absolute bottom-full left-0 z-50 mb-1 w-48 rounded-lg border border-zinc-700 bg-[#1a1c1e] py-1 shadow-2xl">
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">MCP Target</div>
                {servers.length === 0 && (
                  <div className="px-3 py-2 text-xs text-zinc-500">No servers available</div>
                )}
                {servers.map(s => (
                  <button
                    key={s.id}
                    onClick={() => { setSelectedTarget(s.id); setTargetOpen(false); }}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-start transition ${
                      selectedTarget === s.id ? 'bg-zinc-800' : 'hover:bg-zinc-800/50'
                    }`}
                  >
                    <span className={`size-1.5 rounded-full ${s.alive ? 'bg-green-500' : 'bg-zinc-600'}`} />
                    <span className="flex-1 text-sm text-zinc-200">{s.id}</span>
                    <span className="text-[10px] text-zinc-500">{s.tools} tools</span>
                    {selectedTarget === s.id && <Check size={12} className="text-amber-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Session state */}
          {isGenerating && (
            <>
              <span className="text-zinc-700">·</span>
              <span className="flex items-center gap-1 text-amber-400">
                <Loader2 size={10} className="animate-spin" />
                Running
              </span>
            </>
          )}

          <div className="flex-1" />

          {/* MCP servers menu (⋯) */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setTargetOpen(false) || setMenuOpen(v => !v)}
              disabled={!bridgeConnected}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-700/50 disabled:opacity-50"
              title="MCP servers"
            >
              <MoreVertical size={14} />
            </button>
            {menuOpen && (
              <div className="absolute bottom-full right-0 z-50 mb-1 w-56 rounded-lg border border-zinc-700 bg-[#1a1c1e] py-1 shadow-2xl">
                <div className="flex items-baseline gap-2 border-b border-zinc-800 px-3 py-2">
                  <span className="text-sm font-bold text-zinc-100">snapgentV3</span>
                  <span className="text-[10px] text-zinc-500">MCP servers</span>
                </div>
                <div className="px-3 py-2 space-y-1">
                  {servers.length === 0 && (
                    <div className="text-xs text-zinc-500">No servers configured</div>
                  )}
                  {servers.map(s => (
                    <label key={s.id} className="flex items-center gap-2 py-1">
                      <input
                        type="checkbox"
                        checked={mcpEnabled[s.id] !== false}
                        onChange={(e) => setMcpEnabled(prev => ({ ...prev, [s.id]: e.target.checked }))}
                        className="size-3.5 rounded border-zinc-600"
                      />
                      <span className="flex-1 text-sm text-zinc-200">{s.id}</span>
                      <span className={`size-1.5 rounded-full ${s.alive ? 'bg-green-500' : 'bg-zinc-600'}`} />
                      <span className="text-[10px] text-zinc-500">{s.tools}</span>
                    </label>
                  ))}
                </div>
                <div className="border-t border-zinc-800 px-3 py-2">
                  <button
                    onClick={() => { toggleSnapgent(); setMenuOpen(false); }}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Disable snapgent
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Toggle off button */}
          <button
            onClick={() => toggleSnapgent()}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-zinc-400 hover:bg-zinc-700/50 hover:text-red-400 transition"
            title="Disable VS Code mode"
          >
            <Square size={10} />
          </button>
        </div>
      </div>
    </>
  );
}

/** Helper: dispatch a snapgent command for the bar to execute + chip display. */
export function dispatchSnapgentCommand(command: string, params: Record<string, unknown>): string {
  const chipId = `chip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  window.dispatchEvent(new CustomEvent('snapgent:execute', { detail: { command, params, chipId } }));
  return chipId;
}
