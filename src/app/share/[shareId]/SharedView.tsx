'use client';

import { Sparkles, User as UserIcon } from 'lucide-react';
import Markdown from '@/components/librechat/Markdown';

export default function SharedView({
  title, messages, createdAt,
}: {
  title: string;
  messages: { role: string; content: string; createdAt: number }[];
  createdAt: number;
}) {
  return (
    <div className="bg-surface-canvas min-h-screen">
      <div className="border-border-light bg-surface-popover sticky top-0 z-10 border-b px-4 py-3 backdrop-blur">
        <div className="mx-auto max-w-3xl">
          <div className="text-text-primary text-sm font-semibold">{title}</div>
          <div className="text-text-tertiary text-xs">
            Shared · {new Date(createdAt).toLocaleString()}
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-3xl px-4 py-6">
        {messages.length === 0 ? (
          <div className="text-text-tertiary text-center text-sm">This shared conversation is empty.</div>
        ) : (
          <div className="space-y-6">
            {messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex gap-3'}>
                {m.role === 'assistant' && (
                  <div className="bg-surface-active-alt flex size-6 shrink-0 items-center justify-center self-start rounded-full">
                    <Sparkles size={14} className="text-accent-primary" />
                  </div>
                )}
                <div className={m.role === 'user' ? 'max-w-[85%]' : 'flex-1'}>
                  {m.role === 'user' ? (
                    <div className="bg-surface-user-message text-text-primary w-fit rounded-2xl rounded-ee-md px-3 py-2.5 text-sm">
                      <p className="whitespace-pre-wrap break-words">{m.content}</p>
                    </div>
                  ) : (
                    <div className="text-text-primary">
                      <Markdown content={m.content} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="text-text-tertiary px-4 py-8 text-center text-xs">
        Powered by Z.ai · Chat shared via public link
      </div>
    </div>
  );
}
