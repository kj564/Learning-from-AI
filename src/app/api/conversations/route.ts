/**
 * API: /api/conversations — Server-side chat persistence (Onyx-style)
 *
 * Stores conversation metadata + messages in SQLite via Prisma.
 *
 * GET: ?id=<convoId>          → returns the conversation + its messages
 *      (no id)                → returns list of all conversations (most recent first)
 *
 * POST actions:
 *   - create:    { action:'create', title?, model?, assistantId?, projectId? }
 *   - update:    { action:'update', id, title?, model?, assistantId?, projectId? }
 *   - delete:    { action:'delete', id }
 *   - addMessage:{ action:'addMessage', conversationId, role, content, toolExecutions?, sessionId? }
 *   - clearMessages: { action:'clearMessages', id }
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export interface MessageDTO {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolExecutions: { tool: string; args: Record<string, unknown>; success: boolean }[];
  sessionId: string | null;
  createdAt: number;
}

export interface ConversationDTO {
  id: string;
  title: string;
  model: string;
  assistantId: string | null;
  projectId: string | null;
  createdAt: number;
  updatedAt: number;
  messages?: MessageDTO[];
  messageCount?: number;
}

function msgToDTO(m: {
  id: string;
  role: string;
  content: string;
  toolExecutions: string;
  sessionId: string | null;
  createdAt: Date;
}): MessageDTO {
  let toolExecs: { tool: string; args: Record<string, unknown>; success: boolean }[] = [];
  try {
    toolExecs = JSON.parse(m.toolExecutions || '[]');
  } catch {
    // ignore
  }
  return {
    id: m.id,
    role: m.role as MessageDTO['role'],
    content: m.content,
    toolExecutions: toolExecs,
    sessionId: m.sessionId,
    createdAt: m.createdAt.getTime(),
  };
}

function convoToDTO(c: {
  id: string;
  title: string;
  model: string;
  assistantId: string | null;
  projectId: string | null;
  createdAt: Date;
  updatedAt: Date;
  messages?: ReturnType<typeof msgToDTO>[] | unknown;
}): ConversationDTO {
  const dto: ConversationDTO = {
    id: c.id,
    title: c.title,
    model: c.model,
    assistantId: c.assistantId,
    projectId: c.projectId,
    createdAt: c.createdAt.getTime(),
    updatedAt: c.updatedAt.getTime(),
  };
  if (Array.isArray(c.messages)) {
    dto.messages = (c.messages as any[]).map(msgToDTO);
    dto.messageCount = dto.messages.length;
  }
  return dto;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (id) {
    const c = await db.conversation.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ conversation: convoToDTO(c) });
  }
  const list = await db.conversation.findMany({
    orderBy: { updatedAt: 'desc' },
    include: { messages: { select: { id: true } } },
  });
  const items = list.map((c) => ({
    ...convoToDTO(c),
    messageCount: c.messages.length,
  }));
  return NextResponse.json({ conversations: items });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action, id, conversationId, title, model, assistantId, projectId, role, content, toolExecutions, sessionId } = body;

  switch (action) {
    case 'create': {
      const c = await db.conversation.create({
        data: {
          title: title || 'New Chat',
          model: model || 'default',
          assistantId: assistantId || null,
          projectId: projectId || null,
        },
      });
      return NextResponse.json({ success: true, conversation: convoToDTO({ ...c, messages: [] }) });
    }

    case 'update': {
      if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
      const existing = await db.conversation.findUnique({ where: { id } });
      if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      const data: Record<string, string | null> = {};
      if (title !== undefined) data.title = title;
      if (model !== undefined) data.model = model;
      if (assistantId !== undefined) data.assistantId = assistantId || null;
      if (projectId !== undefined) data.projectId = projectId || null;
      const c = await db.conversation.update({ where: { id }, data });
      return NextResponse.json({ success: true, conversation: convoToDTO({ ...c, messages: [] }) });
    }

    case 'delete': {
      if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
      try {
        await db.conversation.delete({ where: { id } });
        return NextResponse.json({ success: true });
      } catch {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
    }

    case 'addMessage': {
      if (!conversationId) return NextResponse.json({ error: 'conversationId required' }, { status: 400 });
      if (!role || content === undefined) return NextResponse.json({ error: 'role + content required' }, { status: 400 });
      const c = await db.conversation.findUnique({ where: { id: conversationId } });
      if (!c) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
      const m = await db.message.create({
        data: {
          conversationId,
          role,
          content: String(content),
          toolExecutions: JSON.stringify(toolExecutions || []),
          sessionId: sessionId || null,
        },
      });
      // Bump conversation's updatedAt
      await db.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
      return NextResponse.json({ success: true, message: msgToDTO(m) });
    }

    case 'clearMessages': {
      if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
      await db.message.deleteMany({ where: { conversationId: id } });
      return NextResponse.json({ success: true });
    }

    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
}
