/**
 * API: /api/tools — Tool executor (Anthropic-standard)
 *
 * Tools: web_search, read_url, read_file, list_dir, write_file, edit_file,
 *        run_code_sandbox, run_shell, create_note, recall_memory,
 *        search_knowledge_base, image_generate, image_search
 */

import { NextRequest, NextResponse } from 'next/server';
import { writeFile, readFile, readdir, mkdir, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import { randomUUID } from 'crypto';
import ZAI from 'z-ai-web-dev-sdk';
import { db } from '@/lib/db';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tool, args } = body as { tool: string; args: Record<string, unknown> };
    if (!tool) return NextResponse.json({ error: 'tool required' }, { status: 400 });

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
        const filePath = args.path as string;
        if (!filePath) return NextResponse.json({ error: 'path required' }, { status: 400 });
        const fullPath = safePath(filePath);
        if (!fullPath || !existsSync(fullPath)) return NextResponse.json({ error: 'File not found' }, { status: 404 });
        const content = await readFile(fullPath, 'utf-8');
        return NextResponse.json({ success: true, path: filePath, content });
      }

      case 'list_dir': {
        const dirPath = (args.path as string) || (args.dir as string) || '.';
        const fullPath = safePath(dirPath);
        if (!fullPath || !existsSync(fullPath)) return NextResponse.json({ error: 'Directory not found' }, { status: 404 });
        const entries = await readdir(fullPath, { withFileTypes: true });
        const items = entries
          .filter((e) => !e.name.startsWith('.') && e.name !== 'node_modules' && e.name !== '.next' && e.name !== '__pycache__')
          .map((e) => ({ name: e.name, type: e.isDirectory() ? 'dir' : 'file' }));
        return NextResponse.json({ success: true, dir: dirPath, items });
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
        const filePath = args.path as string;
        const content = args.content as string;
        if (!filePath || content === undefined) return NextResponse.json({ error: 'path + content required' }, { status: 400 });
        const fullPath = safePath(filePath);
        if (!fullPath) return NextResponse.json({ error: 'Invalid path (path traversal blocked)' }, { status: 400 });
        const dir = path.dirname(fullPath);
        if (!existsSync(dir)) await mkdir(dir, { recursive: true });
        await writeFile(fullPath, content, 'utf-8');
        return NextResponse.json({ success: true, path: filePath, size: content.length });
      }

      case 'edit_file': {
        const filePath = args.path as string;
        if (!filePath) return NextResponse.json({ error: 'path required' }, { status: 400 });
        const fullPath = safePath(filePath);
        if (!fullPath || !existsSync(fullPath)) return NextResponse.json({ error: 'File not found' }, { status: 404 });
        const oldText = args.old_text as string;
        const newText = args.new_text as string;
        if (!oldText || !newText) return NextResponse.json({ error: 'old_text + new_text required' }, { status: 400 });
        let fileContent = await readFile(fullPath, 'utf-8');
        const replaceAll = args.replace_all === true;
        if (replaceAll) {
          fileContent = fileContent.split(oldText).join(newText);
        } else {
          const count = (fileContent.match(new RegExp(escapeRegExp(oldText), 'g')) || []).length;
          if (count === 0) return NextResponse.json({ error: 'old_text not found' }, { status: 404 });
          if (count > 1) return NextResponse.json({ error: `old_text found ${count} times; use replace_all: true` }, { status: 400 });
          fileContent = fileContent.replace(oldText, newText);
        }
        await writeFile(fullPath, fileContent, 'utf-8');
        return NextResponse.json({ success: true, path: filePath });
      }

      case 'run_code_sandbox': {
        const code = args.code as string;
        const lang = (args.language as string) || 'javascript';
        if (!code) return NextResponse.json({ error: 'code required' }, { status: 400 });
        const tmpDir = path.join(WORKSPACE, '.tmp-exec');
        if (!existsSync(tmpDir)) await mkdir(tmpDir, { recursive: true });

        if (lang === 'javascript') {
          const tmpFile = path.join(tmpDir, `${randomUUID()}.js`);
          await writeFile(tmpFile, code, 'utf-8');
          try {
            const { stdout, stderr } = await execFileAsync('node', [tmpFile], { cwd: WORKSPACE, timeout: 10000, maxBuffer: 1024 * 1024 });
            await unlink(tmpFile).catch(() => {});
            return NextResponse.json({ success: true, stdout, stderr: stderr || undefined });
          } catch (e) {
            await unlink(tmpFile).catch(() => {});
            return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
          }
        }
        if (lang === 'typescript') {
          const tmpFile = path.join(tmpDir, `${randomUUID()}.ts`);
          await writeFile(tmpFile, code, 'utf-8');
          try {
            const { stdout, stderr } = await execFileAsync('bun', ['run', tmpFile], { cwd: WORKSPACE, timeout: 10000, maxBuffer: 1024 * 1024 });
            await unlink(tmpFile).catch(() => {});
            return NextResponse.json({ success: true, stdout, stderr: stderr || undefined });
          } catch (e) {
            await unlink(tmpFile).catch(() => {});
            return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
          }
        }
        if (lang === 'python') {
          const tmpFile = path.join(tmpDir, `${randomUUID()}.py`);
          await writeFile(tmpFile, code, 'utf-8');
          try {
            const { stdout, stderr } = await execFileAsync('python3', [tmpFile], { cwd: WORKSPACE, timeout: 10000, maxBuffer: 1024 * 1024 });
            await unlink(tmpFile).catch(() => {});
            return NextResponse.json({ success: true, stdout, stderr: stderr || undefined });
          } catch (e) {
            await unlink(tmpFile).catch(() => {});
            return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
          }
        }
        if (lang === 'bash' || lang === 'sh') {
          try {
            const { stdout, stderr } = await execAsync(code, { cwd: WORKSPACE, timeout: 10000, maxBuffer: 1024 * 1024 });
            return NextResponse.json({ success: true, stdout, stderr: stderr || undefined });
          } catch (e) {
            return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
          }
        }
        return NextResponse.json({ error: `Language ${lang} not supported` }, { status: 400 });
      }

      case 'run_shell': {
        const command = args.command as string;
        if (!command) return NextResponse.json({ error: 'command required' }, { status: 400 });
        try {
          const { stdout, stderr } = await execAsync(command, { cwd: WORKSPACE, timeout: 15000, maxBuffer: 1024 * 1024 });
          return NextResponse.json({ success: true, command, stdout, stderr: stderr || undefined });
        } catch (e) {
          const err = e as Error & { stdout?: string; stderr?: string };
          return NextResponse.json({ success: false, error: err.message, stdout: err.stdout, stderr: err.stderr }, { status: 500 });
        }
      }

      case 'create_note': {
        const title = args.title as string;
        const content = args.content as string;
        const category = (args.category as string) || 'finding';
        if (!title || !content) return NextResponse.json({ error: 'title + content required' }, { status: 400 });
        try {
          const doc = await db.knowledgeDoc.create({
            data: { title, source: `memory:${category}`, content, tags: JSON.stringify([category, 'memory']) },
          });
          return NextResponse.json({ success: true, id: doc.id });
        } catch (e) {
          return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
        }
      }

      // === LEGACY ALIASES (backward compat) ===
      case 'file_write': {
        return POST_proxy(req, 'write_file', { ...args, path: args.path, content: args.content });
      }
      case 'file_read': {
        return POST_proxy(req, 'read_file', { path: args.path });
      }
      case 'file_list': {
        return POST_proxy(req, 'list_dir', { dir: args.dir || '.' });
      }
      case 'code_run': {
        return POST_proxy(req, 'run_code_sandbox', { code: args.code, language: args.language || 'javascript' });
      }
      case 'shell_run': {
        return POST_proxy(req, 'run_shell', { command: args.command });
      }
      case 'knowledge_search': {
        return POST_proxy(req, 'search_knowledge_base', { query: args.query, top_k: args.topK });
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

      case 'send_email_with_approval': {
        // DANGEROUS tool — requires explicit user confirmation.
        // The frontend is expected to surface a confirmation UI before the model
        // ever calls this endpoint. If we get here without a confirmed flag, return
        // a "needs approval" response so the model knows to stop and ask.
        const to = args.to as string;
        const subject = args.subject as string;
        const body = args.body as string;
        if (!to || !subject || !body) {
          return NextResponse.json({ error: 'to, subject, body are all required' }, { status: 400 });
        }
        // Basic email syntax check
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
          return NextResponse.json({ error: 'invalid recipient address' }, { status: 400 });
        }
        const confirmed = args.confirmed === true;
        if (!confirmed) {
          return NextResponse.json({
            success: false,
            needsApproval: true,
            draft: { to, subject, body },
            message: 'This action requires explicit user confirmation. Present the draft to the user and resend with confirmed:true after they approve.',
          });
        }
        // Confirmed — in this environment we don't have an SMTP relay, so we log
        // the would-be send and return success. A real deployment would call the
        // email provider here.
        try {
          await mkdir(path.join(WORKSPACE, '.tmp-email-log'), { recursive: true });
          const logLine = `[${new Date().toISOString()}] to=${to} subject=${subject}\n${body}\n---\n`;
          await writeFile(path.join(WORKSPACE, '.tmp-email-log', 'sent.log'), logLine, { flag: 'a' });
          return NextResponse.json({ success: true, to, subject, delivered: 'logged' });
        } catch (e) {
          return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
        }
      }

      default:
        return NextResponse.json({ error: `Unknown tool: ${tool}` }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

// Helper: proxy a legacy tool call to the new tool name
async function POST_proxy(_req: NextRequest, tool: string, args: Record<string, unknown>) {
  const res = await POST(new NextRequest('http://localhost:3000/api/tools', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tool, args }),
  }));
  return res;
}

export async function GET() {
  return NextResponse.json({
    tools: ['web_search', 'read_url', 'read_file', 'list_dir', 'write_file', 'edit_file', 'run_code_sandbox', 'run_shell', 'create_note', 'recall_memory', 'search_knowledge_base', 'send_email_with_approval', 'image_generate', 'image_search', 'npm_install', 'project_create'],
  });
}
