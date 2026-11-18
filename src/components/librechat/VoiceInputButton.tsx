'use client';

/**
 * VoiceInputButton — mic button that records audio via MediaRecorder
 * and transcribes it via /api/audio/asr.
 *
 *   - Click to start recording
 *   - While recording: pulsing red dot + timer (max 30s)
 *   - Click again to stop → transcribe → append text to composer
 *   - Toast notification on success/failure
 */

import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { useStore } from '@/lib/store';
import { asr } from '@/lib/api';
import { toast } from 'sonner';

export default function VoiceInputButton() {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const setComposerText = useStore((s) => s.setComposerText);
  const setVoiceRecording = useStore((s) => s.setVoiceRecording);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = handleStop;
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
      setSeconds(0);
      setVoiceRecording({ isRecording: true, seconds: 0 });
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          const next = s + 1;
          setVoiceRecording({ isRecording: true, seconds: next });
          if (next >= 30) stop();
          return next;
        });
      }, 1000);
    } catch (e) {
      toast.error('Microphone access denied');
    }
  };

  const stop = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setRecording(false);
    setVoiceRecording(null);
  };

  const handleStop = async () => {
    setTranscribing(true);
    try {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      const arrayBuffer = await blob.arrayBuffer();
      // Convert to base64 in the browser (no Node Buffer)
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      const chunkSize = 0x8000; // 32 KB chunks to avoid call stack overflow
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)) as unknown as number[]);
      }
      const b64 = btoa(binary);

      const text = await asr(b64);
      if (text) {
        // setComposerText takes a string (not a function updater) — read current
        // value from the store directly to append correctly.
        const current = useStore.getState().composerText;
        setComposerText((current ? current + ' ' : '') + text);
        toast.success('Transcribed', { description: text.slice(0, 80) + (text.length > 80 ? '…' : '') });
      } else {
        toast.error('Could not transcribe audio');
      }
    } catch (e) {
      toast.error('Transcription failed', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setTranscribing(false);
    }
  };

  if (transcribing) {
    return (
      <button
        disabled
        title="Transcribing…"
        className="text-text-tertiary flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
      >
        <Loader2 size={18} className="animate-spin" />
      </button>
    );
  }

  if (recording) {
    return (
      <button
        onClick={stop}
        title={`Recording… ${seconds}s (click to stop)`}
        className="text-status-error flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
      >
        <span className="relative flex size-4 items-center justify-center">
          <span className="absolute inline-flex size-4 animate-ping rounded-full bg-red-500/60" />
          <Square size={14} fill="currentColor" className="relative" />
        </span>
        <span className="text-text-primary ms-1 text-xs tabular-nums">{seconds}s</span>
      </button>
    );
  }

  return (
    <button
      onClick={start}
      title="Voice input (click to record)"
      className="text-text-secondary hover:bg-surface-active hover:text-text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition"
    >
      <Mic size={18} />
    </button>
  );
}
