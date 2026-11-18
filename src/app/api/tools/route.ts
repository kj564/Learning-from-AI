/**
 * API: /api/tools — Tool executor (Anthropic tool_use → tool_result flow)
 *
 * Tools available (matching src/lib/tool-definitions.ts):
 *   - file_write, file_read, file_list, file_delete
 *   - code_run, shell_run, npm_install
 *   - web_search, knowledge_search
 *   - project_create, canva_mcp
 *
 * bolt.diy-inspired: agentic file + shell + code execution with timeout + stdout/stderr capture.
 * Onyx-inspired: knowledge_search routes through /api/knowledge.
 */

import { NextRequest, NextResponse } from 'next/server';
import { writeFile, readFile, readdir, mkdir, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import { randomUUID } from 'crypto';
import ZAI from 'z-ai-web-dev-sdk';
import { TOOL_BY_NAME } from '@/lib/tool-definitions';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);
const WORKSPACE = '/home/z/my-project';

/** Resolve a relative path against WORKSPACE and reject path traversal / absolute paths. */
function safePath(relPath: string): string | null {
  if (!relPath || typeof relPath !== 'string') return null;
  // Reject absolute paths (which path.join would happily accept as the new root)
  if (path.isAbsolute(relPath)) return null;
  const full = path.resolve(WORKSPACE, relPath);
  // Ensure the resolved path is still inside WORKSPACE
  if (full !== WORKSPACE && !full.startsWith(WORKSPACE + path.sep)) return null;
  // Reject any segment that is `..` (defense in depth)
  if (relPath.split(/[\\/]/).some((seg) => seg === '..')) return null;
  return full;
}

/** Validate an npm package name (with optional @version) — reject shell metacharacters. */
const PKG_RE = /^@?[a-zA-Z0-9][a-zA-Z0-9._/-]*(@[a-zA-Z0-9._^+:-]+)?$/;
function validPackageNames(pkgs: string[]): boolean {
  return pkgs.every((p) => typeof p === 'string' && PKG_RE.test(p) && p.length < 200);
}

/** Validate a project name (kebab-case) for project_create. */
const NAME_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
function validProjectName(name: string): boolean {
  return typeof name === 'string' && NAME_RE.test(name);
}

/** Call the knowledge search endpoint internally. */
async function knowledgeSearch(query: string, topK = 4): Promise<{ query: string; snippets: { source: string; content: string; score: number }[] }> {
  try {
    const res = await fetch(`http://localhost:3000/api/knowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'search', query, topK }),
    });
    if (!res.ok) return { query, snippets: [] };
    const data = await res.json();
    return { query, snippets: data.snippets || [] };
  } catch {
    return { query, snippets: [] };
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tool, args } = body as { tool: string; args: Record<string, unknown> };

    // Validate tool exists in definitions
    if (!TOOL_BY_NAME[tool]) {
      return NextResponse.json({ error: `Unknown tool: ${tool}` }, { status: 400 });
    }

    switch (tool) {
      // === FILE OPERATIONS ===
      case 'file_write': {
        const filePath = args.path as string;
        const content = args.content as string;
        if (!filePath || content === undefined)
          return NextResponse.json({ error: 'path + content required' }, { status: 400 });
        const fullPath = safePath(filePath);
        if (!fullPath) return NextResponse.json({ error: 'Invalid path (path traversal blocked)' }, { status: 400 });
        const dir = path.dirname(fullPath);
        if (!existsSync(dir)) await mkdir(dir, { recursive: true });
        await writeFile(fullPath, content, 'utf-8');
        return NextResponse.json({ success: true, path: filePath, size: content.length });
      }

      case 'file_read': {
        const filePath = args.path as string;
        if (!filePath) return NextResponse.json({ error: 'path required' }, { status: 400 });
        const fullPath = safePath(filePath);
        if (!fullPath) return NextResponse.json({ error: 'Invalid path (path traversal blocked)' }, { status: 400 });
        if (!existsSync(fullPath)) return NextResponse.json({ error: 'File not found' }, { status: 404 });
        const content = await readFile(fullPath, 'utf-8');
        return NextResponse.json({ success: true, path: filePath, content });
      }

      case 'file_list': {
        const dirPath = (args.dir as string) || '.';
        const fullPath = safePath(dirPath);
        if (!fullPath) return NextResponse.json({ error: 'Invalid path (path traversal blocked)' }, { status: 400 });
        if (!existsSync(fullPath)) return NextResponse.json({ error: 'Directory not found' }, { status: 404 });
        const entries = await readdir(fullPath, { withFileTypes: true });
        const items = entries
          .filter((e) => !e.name.startsWith('.') && e.name !== 'node_modules' && e.name !== '.next' && e.name !== '__pycache__')
          .map((e) => ({ name: e.name, type: e.isDirectory() ? 'dir' : 'file' }));
        return NextResponse.json({ success: true, dir: dirPath, items });
      }

      case 'file_delete': {
        const filePath = args.path as string;
        if (!filePath) return NextResponse.json({ error: 'path required' }, { status: 400 });
        const fullPath = safePath(filePath);
        if (!fullPath) return NextResponse.json({ error: 'Invalid path (path traversal blocked)' }, { status: 400 });
        if (!existsSync(fullPath)) return NextResponse.json({ error: 'File not found' }, { status: 404 });
        await unlink(fullPath);
        return NextResponse.json({ success: true, deleted: filePath });
      }

      // === CODE EXECUTION ===
      case 'code_run': {
        const code = args.code as string;
        const language = (args.language as string) || 'javascript';
        if (!code) return NextResponse.json({ error: 'code required' }, { status: 400 });

        // Use a unique temp file per request to avoid concurrent overwrites.
        const tmpDir = path.join(WORKSPACE, '.tmp-exec');
        if (!existsSync(tmpDir)) await mkdir(tmpDir, { recursive: true });

        if (language === 'javascript') {
          const tmpFile = path.join(tmpDir, `${randomUUID()}.js`);
          await writeFile(tmpFile, code, 'utf-8');
          try {
            const { stdout, stderr } = await execFileAsync('node', [tmpFile], {
              cwd: WORKSPACE,
              timeout: 10000,
              maxBuffer: 1024 * 1024,
            });
            await unlink(tmpFile).catch(() => {});
            return NextResponse.json({ success: true, stdout, stderr: stderr || undefined });
          } catch (e) {
            await unlink(tmpFile).catch(() => {});
            const err = e as Error & { stdout?: string; stderr?: string };
            return NextResponse.json(
              { success: false, error: err.message, stdout: err.stdout, stderr: err.stderr },
              { status: 500 }
            );
          }
        }

        if (language === 'typescript') {
          // Use bun (which has built-in TS support) to run TS code.
          const tmpFile = path.join(tmpDir, `${randomUUID()}.ts`);
          await writeFile(tmpFile, code, 'utf-8');
          try {
            const { stdout, stderr } = await execFileAsync('bun', ['run', tmpFile], {
              cwd: WORKSPACE,
              timeout: 10000,
              maxBuffer: 1024 * 1024,
            });
            await unlink(tmpFile).catch(() => {});
            return NextResponse.json({ success: true, stdout, stderr: stderr || undefined });
          } catch (e) {
            await unlink(tmpFile).catch(() => {});
            const err = e as Error & { stdout?: string; stderr?: string };
            return NextResponse.json(
              { success: false, error: err.message, stdout: err.stdout, stderr: err.stderr },
              { status: 500 }
            );
          }
        }

        if (language === 'python' || language === 'python3') {
          const tmpFile = path.join(tmpDir, `${randomUUID()}.py`);
          await writeFile(tmpFile, code, 'utf-8');
          try {
            const { stdout, stderr } = await execFileAsync('python3', [tmpFile], {
              cwd: WORKSPACE,
              timeout: 10000,
              maxBuffer: 1024 * 1024,
            });
            await unlink(tmpFile).catch(() => {});
            return NextResponse.json({ success: true, stdout, stderr: stderr || undefined });
          } catch (e) {
            await unlink(tmpFile).catch(() => {});
            return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
          }
        }

        if (language === 'bash' || language === 'sh') {
          try {
            // shell_run is intentionally shell — commands can use pipes/redirects.
            const { stdout, stderr } = await execAsync(code, {
              cwd: WORKSPACE,
              timeout: 10000,
              maxBuffer: 1024 * 1024,
            });
            return NextResponse.json({ success: true, stdout, stderr: stderr || undefined });
          } catch (e) {
            return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
          }
        }

        return NextResponse.json({ error: `Language ${language} not supported` }, { status: 400 });
      }

      // === SHELL RUN (new) ===
      case 'shell_run': {
        const command = args.command as string;
        const cwdRel = (args.cwd as string) || '.';
        if (!command) return NextResponse.json({ error: 'command required' }, { status: 400 });
        try {
          const { stdout, stderr } = await execAsync(command, {
            cwd: path.join(WORKSPACE, cwdRel),
            timeout: 15000,
            maxBuffer: 1024 * 1024,
          });
          return NextResponse.json({ success: true, command, stdout, stderr: stderr || undefined });
        } catch (e) {
          const err = e as Error & { stdout?: string; stderr?: string };
          return NextResponse.json(
            { success: false, error: err.message, stdout: err.stdout, stderr: err.stderr },
            { status: 500 }
          );
        }
      }

      // === PACKAGE INSTALL ===
      case 'npm_install': {
        const packages = args.packages as string[];
        if (!packages || !Array.isArray(packages) || !validPackageNames(packages))
          return NextResponse.json({ error: 'packages array of valid names required' }, { status: 400 });
        try {
          // Use execFile (no shell) to prevent command injection via package names.
          const { stdout } = await execFileAsync('bun', ['add', ...packages], {
            cwd: WORKSPACE,
            timeout: 60000,
            maxBuffer: 1024 * 1024,
          });
          return NextResponse.json({ success: true, packages, stdout: stdout.slice(0, 500) });
        } catch (e) {
          return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
        }
      }

      // === WEB SEARCH ===
      case 'web_search': {
        const query = args.query as string;
        if (!query) return NextResponse.json({ error: 'query required' }, { status: 400 });
        try {
          // REAL web search via the SDK's built-in function (replaces the old LLM-hallucinated version)
          const wsRes = await fetch('http://localhost:3000/api/web/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, num: 6 }),
          });
          const data = await wsRes.json();
          return NextResponse.json({ success: true, query, results: data.results || [] });
        } catch (e) {
          return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
        }
      }

      // === IMAGE GENERATION (new) ===
      case 'image_generate': {
        const prompt = args.prompt as string;
        const size = (args.size as string) || '1024x1024';
        if (!prompt) return NextResponse.json({ error: 'prompt required' }, { status: 400 });
        try {
          const genRes = await fetch('http://localhost:3000/api/image/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, size }),
          });
          const data = await genRes.json();
          return NextResponse.json({
            success: !!data.success,
            prompt,
            image: data.image || null,
          });
        } catch (e) {
          return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
        }
      }

      // === IMAGE SEARCH (new) ===
      case 'image_search': {
        const query = args.query as string;
        if (!query) return NextResponse.json({ error: 'query required' }, { status: 400 });
        try {
          const isRes = await fetch('http://localhost:3000/api/image/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, count: 4 }),
          });
          const data = await isRes.json();
          return NextResponse.json({ success: !!data.success, query, results: data.results || [] });
        } catch (e) {
          return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
        }
      }

      // === IMAGE EDIT (new) ===
      case 'image_edit': {
        const prompt = args.prompt as string;
        const image = args.image as string;
        const size = (args.size as string) || '1024x1024';
        if (!prompt || !image) return NextResponse.json({ error: 'prompt + image required' }, { status: 400 });
        try {
          const editRes = await fetch('http://localhost:3000/api/image/edit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, image, size }),
          });
          const data = await editRes.json();
          return NextResponse.json({
            success: !!data.success,
            prompt,
            image: data.image || null,
          });
        } catch (e) {
          return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
        }
      }

      // === VIDEO GENERATION (new, async) ===
      case 'video_generate': {
        const prompt = args.prompt as string;
        const image_url = args.image_url as string | undefined;
        const quality = (args.quality as 'speed' | 'quality') || 'quality';
        const with_audio = args.with_audio !== false;
        const duration = args.duration as number | undefined;
        if (!prompt && !image_url) return NextResponse.json({ error: 'prompt or image_url required' }, { status: 400 });
        try {
          const genRes = await fetch('http://localhost:3000/api/video/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, image_url, quality, with_audio, duration }),
          });
          const data = await genRes.json();
          return NextResponse.json({
            success: !!data.success,
            prompt,
            taskId: data.taskId,
            status: data.status,
            note: 'Video generation is async. Poll /api/video/status?taskId=<id> every 5-10s until status === SUCCESS.',
          });
        } catch (e) {
          return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
        }
      }

      // === KNOWLEDGE SEARCH (new) ===
      case 'knowledge_search': {
        const query = args.query as string;
        const topK = (args.topK as number) || 4;
        if (!query) return NextResponse.json({ error: 'query required' }, { status: 400 });
        const result = await knowledgeSearch(query, topK);
        return NextResponse.json({ success: true, ...result });
      }

      // === PROJECT CREATION ===
      case 'project_create': {
        const name = args.name as string;
        const type = (args.type as string) || 'nextjs';
        if (!name || !validProjectName(name))
          return NextResponse.json({ error: 'valid name required (kebab-case)' }, { status: 400 });
        const projectPath = path.join(WORKSPACE, name);
        if (existsSync(projectPath))
          return NextResponse.json({ error: 'Project already exists' }, { status: 400 });

        if (type === 'nextjs') {
          try {
            // Use execFile (no shell) to prevent command injection via project name.
            const { stdout } = await execFileAsync(
              'npx',
              ['create-next-app@latest', name, '--ts', '--tailwind', '--app', '--no-eslint', '--no-src-dir', '--use-bun', '--yes'],
              { cwd: WORKSPACE, timeout: 120000, maxBuffer: 1024 * 1024 * 2 }
            );
            return NextResponse.json({ success: true, name, path: name, stdout: stdout.slice(0, 500) });
          } catch {
            await mkdir(path.join(projectPath, 'src/app'), { recursive: true });
            await writeFile(
              path.join(projectPath, 'src/app/page.tsx'),
              `export default function Home() {\n  return <div>Hello from ${name}</div>\n}\n`,
              'utf-8'
            );
            await writeFile(
              path.join(projectPath, 'package.json'),
              JSON.stringify({ name, version: '0.1.0', private: true, scripts: { dev: 'next dev' } }, null, 2),
              'utf-8'
            );
            return NextResponse.json({ success: true, name, path: name, note: 'Created minimal structure (create-next-app failed)' });
          }
        }
        return NextResponse.json({ error: `Type ${type} not supported` }, { status: 400 });
      }

      // === CANVA MCP PROXY ===
      case 'canva_mcp': {
        const mcpRequest = args.mcpRequest as string;
        if (!mcpRequest) return NextResponse.json({ error: 'mcpRequest required' }, { status: 400 });
        const canvaRes = await fetch('http://localhost:3000/api/mcp/canva', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: mcpRequest,
        });
        const canvaData = await canvaRes.text();
        return new NextResponse(canvaData, {
          status: canvaRes.status,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      default:
        return NextResponse.json({ error: `Unknown tool: ${tool}` }, { status: 400 });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET() {
  // Return tool definitions in Anthropic format
  return NextResponse.json({
    tools: ['file_write', 'file_read', 'file_list', 'file_delete', 'code_run', 'shell_run', 'npm_install', 'web_search', 'image_generate', 'image_search', 'knowledge_search', 'project_create', 'canva_mcp'],
  });
}
