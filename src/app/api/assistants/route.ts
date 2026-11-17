/**
 * API: /api/assistants — Onyx-style assistants CRUD (now persisted via Prisma)
 *
 * An Assistant bundles:
 *   - name, description
 *   - systemPrompt: persona injected into the system prompt
 *   - model: preferred AI model id
 *   - tools: JSON array of tool names the assistant can call
 *   - knowledgeIds: JSON array of KnowledgeDoc ids
 *   - createdAt / updatedAt
 *
 * Seeded with 3 default assistants on first import (only if table is empty).
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export interface AssistantDTO {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  model: string;
  tools: string[];
  knowledgeIds: string[];
  createdAt: number;
  updatedAt: number;
}

function toDTO(a: {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  model: string;
  tools: string;
  knowledgeIds: string;
  createdAt: Date;
  updatedAt: Date;
}): AssistantDTO {
  return {
    id: a.id,
    name: a.name,
    description: a.description,
    systemPrompt: a.systemPrompt,
    model: a.model,
    tools: JSON.parse(a.tools || '[]'),
    knowledgeIds: JSON.parse(a.knowledgeIds || '[]'),
    createdAt: a.createdAt.getTime(),
    updatedAt: a.updatedAt.getTime(),
  };
}

/** Seed default assistants if the table is empty (runs once on first request). */
let seeded = false;
async function ensureSeed() {
  if (seeded) return;
  seeded = true;
  const count = await db.assistant.count();
  if (count > 0) return;

  const defaults = [
    {
      id: 'asst_general',
      name: 'General Assistant',
      description: 'All-purpose Claude assistant with all tools enabled.',
      systemPrompt:
        'You are a helpful general-purpose assistant. Use tools when the user asks you to do something concrete.',
      model: 'default',
      tools: ['file_write', 'file_read', 'file_list', 'code_run', 'shell_run', 'web_search', 'knowledge_search'],
      knowledgeIds: [],
    },
    {
      id: 'asst_coder',
      name: 'Code Engineer',
      description: 'Coding specialist — writes, runs, and debugs code in the workspace.',
      systemPrompt:
        'You are a senior software engineer. Always use file_write + code_run to actually create files and verify they run. Never just paste code — create the file and run it. Use shell_run for tests and builds.',
      model: 'default',
      tools: ['file_write', 'file_read', 'file_list', 'file_delete', 'code_run', 'shell_run', 'npm_install', 'project_create'],
      knowledgeIds: [],
    },
    {
      id: 'asst_researcher',
      name: 'Researcher',
      description: 'Knowledge + web research assistant.',
      systemPrompt:
        'You are a research assistant. Use knowledge_search FIRST for any factual question (it searches the workspace knowledge base). If no relevant docs found, fall back to web_search. Synthesize findings with citations.',
      model: 'smart',
      tools: ['knowledge_search', 'web_search', 'file_read'],
      knowledgeIds: [],
    },
  ];
  for (const d of defaults) {
    await db.assistant.create({
      data: {
        id: d.id,
        name: d.name,
        description: d.description,
        systemPrompt: d.systemPrompt,
        model: d.model,
        tools: JSON.stringify(d.tools),
        knowledgeIds: JSON.stringify(d.knowledgeIds),
      },
    });
  }
}

export async function GET() {
  await ensureSeed();
  const list = await db.assistant.findMany({ orderBy: { updatedAt: 'desc' } });
  return NextResponse.json({ assistants: list.map(toDTO) });
}

export async function POST(req: NextRequest) {
  await ensureSeed();
  const body = await req.json();
  const { action, id, ...updates } = body;

  switch (action) {
    case 'create': {
      const a = await db.assistant.create({
        data: {
          name: updates.name || 'New Assistant',
          description: updates.description || '',
          systemPrompt: updates.systemPrompt || '',
          model: updates.model || 'default',
          tools: JSON.stringify(updates.tools || ['file_write', 'file_read', 'file_list', 'code_run', 'web_search']),
          knowledgeIds: JSON.stringify(updates.knowledgeIds || []),
        },
      });
      return NextResponse.json({ success: true, assistant: toDTO(a) });
    }

    case 'get': {
      if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
      const a = await db.assistant.findUnique({ where: { id } });
      if (!a) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ assistant: toDTO(a) });
    }

    case 'update': {
      if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
      const existing = await db.assistant.findUnique({ where: { id } });
      if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      const data: Record<string, string> = {};
      if (updates.name !== undefined) data.name = updates.name;
      if (updates.description !== undefined) data.description = updates.description;
      if (updates.systemPrompt !== undefined) data.systemPrompt = updates.systemPrompt;
      if (updates.model !== undefined) data.model = updates.model;
      if (updates.tools !== undefined) data.tools = JSON.stringify(updates.tools);
      if (updates.knowledgeIds !== undefined) data.knowledgeIds = JSON.stringify(updates.knowledgeIds);
      const a = await db.assistant.update({ where: { id }, data });
      return NextResponse.json({ success: true, assistant: toDTO(a) });
    }

    case 'delete': {
      if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
      try {
        await db.assistant.delete({ where: { id } });
        return NextResponse.json({ success: true });
      } catch {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
    }

    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
}
