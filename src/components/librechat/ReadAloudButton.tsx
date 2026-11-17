'use client';

/**
 * ReadAloudButton — hover-toolbar button that calls TTS on the message content.
 *
 *   - First click: calls /api/audio/tts, caches the audioUrl on the message, starts playback
 *   - Subsequent clicks: toggles play/pause on the cached audio
 *   - Only one message can be read aloud at a time (managed via the store)
 */

import { useState } from 'react';
import { Volume2, Loader2 } from 'lucide-react';
import { useStore } from '@/lib/store';
import { tts } from '@/lib/api';

interface ReadAloudButtonProps {
  convoId: string;
  messageId: string;
  content: string;
}

export default function ReadAloudButton({ convoId, messageId, content }: ReadAloudButtonProps) {
  const updateMessage = useStore((s) => s.updateMessage);
  const setReadAloud = useStore((s) => s.setReadAloud);
  const readAloud = useStore((s) => s.readAloud);
  const messages = useStore((s) => (s.messagesByConversation[convoId] || []).find((m) => m.id === messageId));
  const [loading, setLoading] = useState(false);

  const isCurrent = readAloud?.messageId === messageId;
  const isPlaying = isCurrent && readAloud?.playing;

  const handleClick = async () => {
    // Already have audio cached → just toggle
    if (messages?.audio?.url) {
      if (isPlaying) {
        setReadAloud({ messageId, audioUrl: messages.audio.url, playing: false });
      } else {
        setReadAloud({ messageId, audioUrl: messages.audio.url, playing: true });
      }
      return;
    }
    // No audio cached → call TTS
    setLoading(true);
    try {
      const audioUrl = await tts(content);
      updateMessage(convoId, messageId, { audio: { url: audioUrl } });
      setReadAloud({ messageId, audioUrl, playing: true });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('TTS failed:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      title={isPlaying ? 'Pause read-aloud' : 'Read aloud'}
      aria-label={isPlaying ? 'Pause read-aloud' : 'Read aloud'}
      className="text-text-tertiary hover:bg-surface-active hover:text-text-primary flex h-7 w-7 items-center justify-center rounded-md disabled:opacity-50"
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : <Volume2 size={14} />}
    </button>
  );
}
