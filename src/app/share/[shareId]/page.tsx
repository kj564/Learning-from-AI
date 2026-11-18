/**
 * Public read-only shared conversation view at /share/<shareId>.
 * No auth required — anyone with the link can read.
 */

import { db } from '@/lib/db';
import { notFound } from 'next/navigation';
import SharedView from './SharedView';

export default async function Page({ params }: { params: Promise<{ shareId: string }> }) {
  const { shareId } = await params;
  const shared = await db.sharedConversation.findUnique({ where: { shareId } });
  if (!shared) notFound();

  const messages = JSON.parse(shared.messages || '[]') as { role: string; content: string; createdAt: number }[];
  return <SharedView title={shared.title} messages={messages} createdAt={shared.createdAt.getTime()} />;
}
