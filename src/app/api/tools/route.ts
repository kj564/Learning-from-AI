/**
 * API: /api/tools — Tool executor (Anthropic-standard)
 *
 * Tools: web_search, read_url, read_file, list_dir, write_file, edit_file,
 *        run_code_sandbox, run_shell, create_note, recall_memory,
 *        search_knowledge_base, send_email_with_approval, image_generate,
 *        image_search.
 *
 * Pipeline (P0 fixes):
 *   1. Strict Zod schema validation — invalid args return is_error:true,
 *      never reach the executor. (docs/agent/evaluation_tests.md T5)
 *   2. Every call is wrapped in audit logging (ToolCallAudit row written).
 *   3. Dangerous tools (send_email_with_approval) never execute inline — they
 *      create an ApprovalRequest and return {needsApproval:true, approvalId,
 *      token} for the UI to surface. (T1)
 */

import { NextRequest, NextResponse } from 'next/server';
import { writeFile, readFile, mkdir, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import ZAI from 'z-ai-web-dev-sdk';
import { db } from '@/lib/db';
import { validateToolCall, writeAudit } from '@/lib/tool-validation';
import { createApproval } from '@/lib/approval';
import {
  resolveWorkspacePath, listWorkspaceFiles, readWorkspaceFile, writeWorkspaceFile,
  buildSandboxEnv, ensureWorkspaceForConversation,
} from '@/lib/workspace';
import { enqueueSandboxJob } from '@/lib/sandbox-client';

const WORKSPACE = '/home/z/my-project';

function safePath(relPath: string): string | null {
  if (!relPath || typeof relPath !== 'string') return null;
  if (path.isAbsolute(relPath)) return null;
  const full = path.resolve(WORKSPACE, relPath);
  if (full !== WORKSPACE && !full.startsWith(WORKSPACE + path.sep)) return null;
  if (relPath.split(/[\\/]/).some((seg) => seg === '..')) return null;
  return full;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Tools that are "dangerous" — they always require the approval workflow and
// never execute inline regardless of what the model sends.
const DANGEROUS_TOOLS = new Set(['send_email_with_approval']);

// Tools that operate on files and therefore require a workspaceId. If the
// model omits workspaceId, the backend auto-creates one for the conversation
// and injects it — the model never needs to know the absolute root path.
const FILE_TOOLS = new Set([
  'read_file', 'write_file', 'edit_file', 'list_files', 'list_dir',
  'run_code_sandbox', 'run_shell', 'create_note',
]);

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  let conversationId: string | null = null;
  let sessionId: string | null = null;
  let workspaceId: string | null = null;
  let requestedPath: string | null = null;
  let resolvedPath: string | null = null;
  let accessDecision: string | 'n/a' = 'n/a';
  try {
    const body = await req.json();
    const { tool, args } = body as { tool: string; args: Record<string, unknown>; conversationId?: string; sessionId?: string };
    conversationId = body.conversationId ?? null;
    sessionId = body.sessionId ?? null;
    if (!tool) return NextResponse.json({ error: 'tool required' }, { status: 400 });
    if (!args || typeof args !== 'object') {
      return NextResponse.json({ success: false, is_error: true, error: 'INVALID_ARGUMENTS', details: 'args object required' }, { status: 400 });
    }

    // === Workspace injection: if this is a file tool and the model omitted
    // workspaceId, auto-create one for the conversation and inject it. The
    // model never sees the absolute rootPath — only the workspaceId. ===
    let effectiveArgs = args;
    if (FILE_TOOLS.has(tool) && !args.workspaceId) {
      const ws = await ensureWorkspaceForConversation(conversationId, 'default');
      effectiveArgs = { ...args, workspaceId: ws.id };
      workspaceId = ws.id;
    } else if (args.workspaceId) {
      workspaceId = args.workspaceId as string;
    }
    if (typeof effectiveArgs.path === 'string') requestedPath = effectiveArgs.path;

    // === 1. Schema validation (Zod) — before any execution. ===
    const v = validateToolCall(tool, effectiveArgs);
    if (!v.ok) {
      await writeAudit({
        conversationId, sessionId, toolName: tool, args: effectiveArgs,
        status: 'invalid', durationMs: Date.now() - t0,
        validationError: JSON.stringify(v.details),
        workspaceId, requestedPath, accessDecision: 'denied_absolute',
      });
      return NextResponse.json({
        success: false,
        is_error: true,
        error: 'INVALID_ARGUMENTS',
        details: v.details,
      }, { status: 400 });
    }

    // === 2. Dangerous tool — never execute inline, create approval instead. ===
    if (DANGEROUS_TOOLS.has(tool)) {
      const approval = await createApproval({
        toolName: tool,
        args: v.args,
        conversationId,
      });
      await writeAudit({
        conversationId, sessionId, toolName: tool, args: v.args,
        status: 'pending', durationMs: Date.now() - t0,
        approvalId: approval.approvalId,
      });
      // Return a structured response the chat stream surfaces as a tool_result
      // with a special "needsApproval" flag. The model is told to STOP and wait.
      return NextResponse.json({
        success: false,
        is_error: false,
        needsApproval: true,
        approvalId: approval.approvalId,
        token: approval.token, // UI must persist this; backend only stores the hash
        draft: v.args,
        expiresAt: approval.expiresAt,
        message: `This action requires user approval. The UI will show the draft. Do NOT call this tool again — wait for the user to approve or reject. Approval expires at ${approval.expiresAt.toISOString()}.`,
      });
    }

    // === 3. Normal tool execution — wrapped with audit logging. ===
    // For file tools, resolve the path FIRST so we can record the access
    // decision (allowed / denied_*) in the audit even on success.
    try {
      // For file tools, pre-resolve to capture the resolvedPath for the audit.
      // (The executor does its own resolution; this is just for observability.)
      if (FILE_TOOLS.has(tool) && typeof v.args.path === 'string') {
        const res = await resolveWorkspacePath(v.args.workspaceId as string, v.args.path as string, 'default');
        if (res.ok) {
          resolvedPath = res.absolutePath;
          accessDecision = 'allowed';
        } else {
          accessDecision = res.accessDecision;
          // Path resolution failed — record the denial and return the error.
          await writeAudit({
            conversationId, sessionId, toolName: tool, args: v.args,
            status: 'denied', durationMs: Date.now() - t0,
            errorMessage: res.error,
            workspaceId, requestedPath, accessDecision,
          });
          return NextResponse.json({
            success: false,
            is_error: true,
            error: 'PATH_DENIED',
            accessDecision: res.accessDecision,
            message: res.error,
          }, { status: 400 });
        }
      }
      const response = await executeTool(tool, v.args, { conversationId, sessionId });
      const status = response.status;
      const resultBytes = 0;
      if (status >= 200 && status < 300) {
        await writeAudit({
          conversationId, sessionId, toolName: tool, args: v.args,
          status: 'success', durationMs: Date.now() - t0, resultBytes,
          workspaceId, requestedPath, resolvedPath, accessDecision,
        });
      } else {
        await writeAudit({
          conversationId, sessionId, toolName: tool, args: v.args,
          status: 'failure', durationMs: Date.now() - t0,
          errorMessage: `executor returned status ${status}`,
          workspaceId, requestedPath, resolvedPath, accessDecision,
        });
      }
      return response;
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      await writeAudit({
        conversationId, sessionId, toolName: tool, args: v.args,
        status: 'failure', durationMs: Date.now() - t0, errorMessage: errMsg,
        workspaceId, requestedPath, resolvedPath, accessDecision,
      });
      return NextResponse.json({ success: false, is_error: true, error: errMsg }, { status: 500 });
    }
  } catch (error) {
    await writeAudit({
      conversationId, sessionId, toolName: '(unknown)',
      args: {}, status: 'failure', durationMs: Date.now() - t0,
      errorMessage: error instanceof Error ? error.message : String(error),
    }).catch(() => {});
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

// ============================================================
// Tool executor — the big switch. Called only after validation.
// Returns NextResponse directly; the outer wrapper audits and forwards.
// ============================================================
async function executeTool(
  tool: string,
  args: Record<string, unknown>,
  ctx: { conversationId?: string | null; sessionId?: string | null } = {},
): Promise<NextResponse> {
  switch (tool) {
      // === READ TOOLS ===
      case 'web_search': {
        const query = args.query as string;
        if (!query) return NextResponse.json({ error: 'query required' }, { status: 400 });
        try {
          const zai = await ZAI.create();
          const results = await zai.functions.invoke('web_search', { query, num: (args.max_results as number) || 5 });
          return NextResponse.json({ success: true, query, results: results || [] });
        } catch (e) {
          return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
        }
      }

      case 'read_url': {
        const url = args.url as string;
        if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 });
        try {
          const zai = await ZAI.create();
          const result = await zai.functions.invoke('page_reader', { url });
          return NextResponse.json({ success: true, url, title: result?.data?.title || '', content: result?.data?.html || '' });
        } catch (e) {
          return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
        }
      }

      case 'read_file': {
        const wsId = args.workspaceId as string;
        const filePath = args.path as string;
        const res = await readWorkspaceFile(wsId, filePath, 'default');
        if (!res.ok) {
          return NextResponse.json({
            success: false, is_error: true,
            error: 'PATH_DENIED', accessDecision: res.accessDecision,
            message: res.error,
          }, { status: 400 });
        }
        return NextResponse.json({ success: true, path: filePath, content: res.content, size: res.size });
      }

      case 'list_files':
      case 'list_dir': {
        const wsId = args.workspaceId as string;
        const dirPath = (args.path as string) || (args.dir as string) || '.';
        const res = await listWorkspaceFiles(wsId, dirPath, 'default');
        if (!res.ok) {
          return NextResponse.json({
            success: false, is_error: true,
            error: 'PATH_DENIED', accessDecision: res.accessDecision,
            message: res.error,
          }, { status: 400 });
        }
        return NextResponse.json({ success: true, workspaceId: wsId, dir: dirPath, items: res.entries });
      }

      case 'search_knowledge_base': {
        const query = args.query as string;
        if (!query) return NextResponse.json({ error: 'query required' }, { status: 400 });
        try {
          const res = await fetch('http://localhost:3000/api/knowledge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'search', query, topK: args.top_k || 5 }),
          });
          const data = await res.json();
          return NextResponse.json({ success: true, query, snippets: data.snippets || [] });
        } catch (e) {
          return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
        }
      }

      case 'recall_memory': {
        const query = args.query as string;
        if (!query) return NextResponse.json({ error: 'query required' }, { status: 400 });
        try {
          const res = await fetch('http://localhost:3000/api/knowledge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'search', query: `memory ${query}`, topK: 5 }),
          });
          const data = await res.json();
          const notes = (data.snippets || [])
            .filter((s: any) => s.source?.startsWith('memory:'))
            .map((s: any) => ({ title: s.title, content: s.content, category: s.source?.replace('memory:', '') }));
          return NextResponse.json({ success: true, notes });
        } catch (e) {
          return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
        }
      }

      // === WRITE TOOLS ===
      case 'write_file': {
        const wsId = args.workspaceId as string;
        const filePath = args.path as string;
        const content = args.content as string;
        const res = await writeWorkspaceFile(wsId, filePath, content, 'default');
        if (!res.ok) {
          return NextResponse.json({
            success: false, is_error: true,
            error: 'PATH_DENIED', accessDecision: res.accessDecision,
            message: res.error,
          }, { status: 400 });
        }
        return NextResponse.json({ success: true, workspaceId: wsId, path: res.path, size: res.size });
      }

      case 'edit_file': {
        const wsId = args.workspaceId as string;
        const filePath = args.path as string;
        const res = await resolveWorkspacePath(wsId, filePath, 'default');
        if (!res.ok) {
          return NextResponse.json({
            success: false, is_error: true,
            error: 'PATH_DENIED', accessDecision: res.accessDecision,
            message: res.error,
          }, { status: 400 });
        }
        if (!existsSync(res.absolutePath)) {
          return NextResponse.json({ success: false, is_error: true, error: 'File not found', path: filePath }, { status: 404 });
        }
        const oldText = args.old_text as string;
        const newText = args.new_text as string;
        let fileContent = await readFile(res.absolutePath, 'utf-8');
        const replaceAll = args.replace_all === true;
        if (replaceAll) {
          fileContent = fileContent.split(oldText).join(newText);
        } else {
          const count = (fileContent.match(new RegExp(escapeRegExp(oldText), 'g')) || []).length;
          if (count === 0) return NextResponse.json({ error: 'old_text not found' }, { status: 404 });
          if (count > 1) return NextResponse.json({ error: `old_text found ${count} times; use replace_all: true` }, { status: 400 });
          fileContent = fileContent.replace(oldText, newText);
        }
        await writeFile(res.absolutePath, fileContent, 'utf-8');
        return NextResponse.json({ success: true, workspaceId: wsId, path: filePath });
      }

      case 'run_code_sandbox': {
        const wsId = args.workspaceId as string;
        const code = args.code as string;
        const lang = (args.language as string) || 'javascript';
        // === P0-3: execution moved to sandbox-worker mini-service ===
        // The API server does NOT execute code inline. We enqueue a job to the
        // worker (mini-services/sandbox-worker/, port 3030) and await the result.
        // The worker runs with the strongest isolation available (docker if
        // detected, else process tier with empty env + timeout + maxBuffer).
        try {
          const result = await enqueueSandboxJob({
            workspaceId: wsId,
            conversationId: ctx.conversationId,
            sessionId: ctx.sessionId,
            toolName: 'run_code_sandbox',
            args: { code, language: lang },
          });
          if (result.status === 'COMPLETED') {
            return NextResponse.json({
              success: true, workspaceId: wsId, language: lang,
              stdout: result.stdout, stderr: result.stderr || undefined,
              exitCode: result.exitCode,
              isolationTier: result.isolationTier,
              jobId: result.jobId,
            });
          }
          return NextResponse.json({
            success: false, is_error: true,
            error: result.status === 'TIMEOUT' ? 'TIMEOUT' : 'EXECUTION_FAILED',
            message: result.errorMessage || result.stderr || `exit code ${result.exitCode}`,
            stdout: result.stdout, stderr: result.stderr,
            exitCode: result.exitCode,
            isolationTier: result.isolationTier,
            jobId: result.jobId,
          }, { status: 500 });
        } catch (e: any) {
          return NextResponse.json({
            success: false, is_error: true,
            error: 'SANDBOX_WORKER_UNREACHABLE',
            message: `sandbox worker is not running or errored: ${e.message || String(e)}. Start it with \`bun run dev\` in mini-services/sandbox-worker/.`,
          }, { status: 503 });
        }
      }

      case 'run_shell': {
        const wsId = args.workspaceId as string;
        const command = args.command as string;
        // === P0-3: shell also runs in the sandbox worker ===
        try {
          const result = await enqueueSandboxJob({
            workspaceId: wsId,
            conversationId: ctx.conversationId,
            sessionId: ctx.sessionId,
            toolName: 'run_shell',
            args: { command },
          });
          if (result.status === 'COMPLETED') {
            return NextResponse.json({
              success: true, workspaceId: wsId, command,
              stdout: result.stdout, stderr: result.stderr || undefined,
              exitCode: result.exitCode,
              isolationTier: result.isolationTier,
              jobId: result.jobId,
            });
          }
          return NextResponse.json({
            success: false, is_error: true,
            error: result.status === 'TIMEOUT' ? 'TIMEOUT' : 'EXECUTION_FAILED',
            message: result.errorMessage || result.stderr || `exit code ${result.exitCode}`,
            stdout: result.stdout, stderr: result.stderr,
            exitCode: result.exitCode,
            isolationTier: result.isolationTier,
            jobId: result.jobId,
          }, { status: 500 });
        } catch (e: any) {
          return NextResponse.json({
            success: false, is_error: true,
            error: 'SANDBOX_WORKER_UNREACHABLE',
            message: `sandbox worker is not running or errored: ${e.message || String(e)}.`,
          }, { status: 503 });
        }
      }

      case 'create_note': {
        const wsId = args.workspaceId as string;
        const title = args.title as string;
        const content = args.content as string;
        const category = (args.category as string) || 'finding';
        // Save the note to the workspace notes/ folder AND to the knowledge
        // base for recall_memory. Notes are workspace-scoped: the filename
        // encodes the workspaceId so recall can filter by workspace.
        const notePath = `notes/${title.replace(/[^a-z0-9-_]+/gi, '_').slice(0, 60)}.md`;
        const writeRes = await writeWorkspaceFile(wsId, notePath, `# ${title}\n\nCategory: ${category}\n\n${content}\n`, 'default');
        if (!writeRes.ok) {
          return NextResponse.json({
            success: false, is_error: true,
            error: 'PATH_DENIED', accessDecision: writeRes.accessDecision,
            message: writeRes.error,
          }, { status: 400 });
        }
        try {
          const doc = await db.knowledgeDoc.create({
            data: { title, source: `memory:${category}:${wsId}`, content, tags: JSON.stringify([category, 'memory', wsId]) },
          });
          return NextResponse.json({ success: true, id: doc.id, workspaceId: wsId, path: notePath });
        } catch (e) {
          return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
        }
      }

      // === LEGACY ALIASES (backward compat) — delegate to executeTool directly
      // to avoid recursion through POST (which would double-audit).
      // workspaceId is passed through so legacy calls stay workspace-scoped.
      case 'file_write': {
        return executeTool('write_file', { workspaceId: args.workspaceId, path: args.path, content: args.content }, ctx);
      }
      case 'file_read': {
        return executeTool('read_file', { workspaceId: args.workspaceId, path: args.path }, ctx);
      }
      case 'file_list': {
        return executeTool('list_dir', { workspaceId: args.workspaceId, dir: args.dir || '.' }, ctx);
      }
      case 'code_run': {
        return executeTool('run_code_sandbox', { workspaceId: args.workspaceId, code: args.code, language: args.language || 'javascript' }, ctx);
      }
      case 'shell_run': {
        return executeTool('run_shell', { workspaceId: args.workspaceId, command: args.command }, ctx);
      }
      case 'knowledge_search': {
        return executeTool('search_knowledge_base', { workspaceId: args.workspaceId, query: args.query, top_k: args.topK }, ctx);
      }
      case 'image_generate': {
        try {
          const genRes = await fetch('http://localhost:3000/api/image/generate', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: args.prompt, size: args.size || '1024x1024' }),
          });
          const data = await genRes.json();
          return NextResponse.json({ success: !!data.success, prompt: args.prompt, image: data.image || null });
        } catch (e) {
          return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
        }
      }
      case 'image_search': {
        try {
          const isRes = await fetch('http://localhost:3000/api/image/search', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: args.query, count: 4 }),
          });
          const data = await isRes.json();
          return NextResponse.json({ success: !!data.success, query: args.query, results: data.results || [] });
        } catch (e) {
          return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
        }
      }
      case 'npm_install': {
        const packages = args.packages as string[];
        if (!packages || !Array.isArray(packages)) return NextResponse.json({ error: 'packages array required' }, { status: 400 });
        try {
          const { stdout } = await execFileAsync('bun', ['add', ...packages], { cwd: WORKSPACE, timeout: 60000, maxBuffer: 1024 * 1024 });
          return NextResponse.json({ success: true, packages, stdout: stdout.slice(0, 500) });
        } catch (e) {
          return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
        }
      }
      case 'project_create': {
        const name = args.name as string;
        if (!name || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(name)) return NextResponse.json({ error: 'valid name required' }, { status: 400 });
        const projectPath = path.join(WORKSPACE, name);
        if (existsSync(projectPath)) return NextResponse.json({ error: 'Project already exists' }, { status: 400 });
        try {
          const { stdout } = await execFileAsync('npx', ['create-next-app@latest', name, '--ts', '--tailwind', '--app', '--no-eslint', '--no-src-dir', '--use-bun', '--yes'], { cwd: WORKSPACE, timeout: 120000, maxBuffer: 1024 * 1024 * 2 });
          return NextResponse.json({ success: true, name, path: name, stdout: stdout.slice(0, 500) });
        } catch {
          await mkdir(path.join(projectPath, 'src/app'), { recursive: true });
          await writeFile(path.join(projectPath, 'src/app/page.tsx'), `export default function Home() {\n  return <div>Hello from ${name}</div>\n}\n`, 'utf-8');
          return NextResponse.json({ success: true, name, path: name, note: 'Minimal structure created' });
        }
      }

      default:
        return NextResponse.json({ error: `Unknown tool: ${tool}` }, { status: 400 });
    }
  // Note: executeTool does NOT catch — the outer POST wrapper audits and
  // converts thrown errors to a 500 response with is_error: true.
}

export async function GET() {
  return NextResponse.json({
    tools: ['web_search', 'read_url', 'read_file', 'list_dir', 'write_file', 'edit_file', 'run_code_sandbox', 'run_shell', 'create_note', 'recall_memory', 'search_knowledge_base', 'send_email_with_approval', 'image_generate', 'image_search', 'npm_install', 'project_create'],
  });
}
