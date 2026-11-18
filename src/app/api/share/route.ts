/**
 * API: /api/share — create + read shared conversations (public read-only links)
 *
 * POST  { action:'create', conversationId } → { shareId, url }
 * GET   ?shareId=<id>                         → { title, messages, createdAt }
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

function genShareId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export async function GET(req: NextRequest) {
  try {
    const shareId = new URL(req.url).searchParams.get('shareId');
    if (!shareId) return NextResponse.json({ error: 'shareId required' }, { status: 400 });
    const shared = await db.sharedConversation.findUnique({ where: { shareId } });
    if (!shared) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({
      title: shared.title,
      messages: JSON.parse(shared.messages || '[]'),
      createdAt: shared.createdAt.getTime(),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, conversationId } = body;

    if (action === 'create') {
      if (!conversationId) return NextResponse.json({ error: 'conversationId required' }, { status: 400 });
      // Load conversation + messages, snapshot them into the shared record.
      const convo = await db.conversation.findUnique({
        where: { id: conversationId },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      });
      if (!convo) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });

      const messages = convo.messages.map((m) => ({
        role: m.role,
        content: m.content,
        createdAt: m.createdAt.getTime(),
      }));

      const shareId = genShareId();
      await db.sharedConversation.create({
        data: {
          shareId,
          conversationId,
          title: convo.title,
          messages: JSON.stringify(messages),
        },
      });

      const origin = new URL(req.url).origin;
      return NextResponse.json({
        success: true,
        shareId,
        url: `${origin}/share/${shareId}`,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
