'use client';

/**
 * AudioMessageWidget — inline audio player for TTS read-aloud and voice messages.
 *
 *   - Play/Pause button
 *   - Progress bar
 *   - Duration display
 *   - Single instance at a time (controlled by the store's readAloud state)
 */

import { useEffect, useRef, useState } from 'react';
import { Play, Pause, Loader2 } from 'lucide-react';
import { useStore } from '@/lib/store';

interface AudioMessageWidgetProps {
  audioUrl: string;
  messageId: string;
  /** Title shown to the left of the player. */
  title?: string;
}

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function AudioMessageWidget({ audioUrl, messageId, title }: AudioMessageWidgetProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const readAloud = useStore((s) => s.readAloud);
  const setReadAloud = useStore((s) => s.setReadAloud);

  const isCurrent = readAloud?.messageId === messageId;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onLoaded = () => {
      setLoading(false);
      setDuration(audio.duration || 0);
    };
    const onTimeUpdate = () => setProgress(audio.currentTime);
    const onEnded = () => {
      setPlaying(false);
      setProgress(0);
      setReadAloud(null);
    };
    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
    };
  }, [messageId, setReadAloud]);

  // Respond to global stop (another message started playing)
  useEffect(() => {
    if (!isCurrent && playing) {
      audioRef.current?.pause();
      setPlaying(false);
    }
  }, [isCurrent, playing]);

  // Respond to global play/pause commands from ReadAloudButton
  useEffect(() => {
    if (isCurrent && readAloud?.playing && !playing) {
      // Start playback
      const audio = audioRef.current;
      if (audio) {
        audio.play().catch(() => { /* ignore */ });
        setPlaying(true);
      }
    } else if (isCurrent && !readAloud?.playing && playing) {
      // Pause playback
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        setPlaying(false);
      }
    }
  }, [isCurrent, readAloud?.playing, playing]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      setReadAloud(null);
    } else {
      // Stop any other playing audio
      if (readAloud && !isCurrent) {
        // The other audio will pause itself via the effect above
      }
      setReadAloud({ messageId, audioUrl, playing: true });
      audio.play().catch(() => {
        // ignore
      });
      setPlaying(true);
    }
  };

  return (
    <div className="bg-surface-active-alt border-border-light mt-2 flex items-center gap-2 rounded-lg border px-2 py-1.5">
      <button
        onClick={toggle}
        disabled={loading}
        aria-label={playing ? 'Pause' : 'Play'}
        className="bg-accent-primary text-text-inverted flex size-8 shrink-0 items-center justify-center rounded-full transition hover:bg-accent-primary-hover disabled:opacity-50"
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : playing ? <Pause size={14} /> : <Play size={14} className="ms-0.5" />}
      </button>
      <div className="min-w-0 flex-1">
        {title && <div className="text-text-tertiary truncate text-[11px]">{title}</div>}
        <div className="bg-surface-tertiary relative h-1.5 overflow-hidden rounded-full">
          <div
            className="bg-accent-primary absolute inset-y-0 start-0 rounded-full"
            style={{ width: `${duration > 0 ? (progress / duration) * 100 : 0}%` }}
          />
        </div>
      </div>
      <span className="text-text-tertiary shrink-0 text-[11px] tabular-nums">
        {fmt(progress)} / {fmt(duration)}
      </span>
      <audio ref={audioRef} src={audioUrl} preload="metadata" className="hidden" />
    </div>
  );
}
