'use client';

/**
 * VideoMessageWidget — inline video player for AI-generated videos.
 *
 * Polls /api/video/status?taskId=... every 5s until status === SUCCESS,
 * then renders a <video> element with the returned URL.
 *
 * While PROCESSING: shows an animated gradient placeholder with the prompt.
 * On FAIL: shows an error.
 * On SUCCESS: shows the video with controls + download button.
 */

import { useEffect, useState, useRef } from 'react';
import { Film, Loader2, Download, AlertTriangle } from 'lucide-react';

interface VideoMessageWidgetProps {
  taskId: string;
  prompt: string;
}

export default function VideoMessageWidget({ taskId, prompt }: VideoMessageWidgetProps) {
  const [status, setStatus] = useState<'PROCESSING' | 'SUCCESS' | 'FAIL'>('PROCESSING');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [polls, setPolls] = useState(0);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const startedAt = Date.now();
    const MAX_POLLS = 60; // ~5 min at 5s intervals, then give up
    let pollCount = 0;

    const poll = async () => {
      if (cancelledRef.current) return;
      if (pollCount >= MAX_POLLS) {
        setStatus('FAIL');
        return;
      }
      pollCount++;
      try {
        const res = await fetch(`/api/video/status?taskId=${encodeURIComponent(taskId)}`);
        const data = await res.json();
        if (cancelledRef.current) return;
        setStatus(data.status);
        if (data.status === 'SUCCESS' && data.videoUrl) {
          setVideoUrl(data.videoUrl);
          return; // stop polling
        }
        if (data.status === 'FAIL') return;
        setPolls((p) => p + 1);
        timer = setTimeout(poll, 5000);
      } catch {
        if (cancelledRef.current) return;
        setPolls((p) => p + 1);
        timer = setTimeout(poll, 10000); // back off on error
      }
    };

    poll();

    return () => {
      cancelledRef.current = true;
      if (timer) clearTimeout(timer);
    };
  }, [taskId]);

  const download = async () => {
    if (!videoUrl) return;
    try {
      const res = await fetch(videoUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${prompt.slice(0, 40).replace(/[^a-z0-9]+/gi, '_') || 'video'}.mp4`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      // ignore
    }
  };

  if (status === 'FAIL') {
    return (
      <div className="border-status-error/40 bg-status-error/10 text-status-error flex items-center gap-2 rounded-lg border p-3 text-sm">
        <AlertTriangle size={16} /> Video generation failed
      </div>
    );
  }

  if (status === 'SUCCESS' && videoUrl) {
    return (
      <div className="group border-border-light relative overflow-hidden rounded-xl border">
        <video src={videoUrl} controls className="w-full" />
        <div className="absolute end-2 top-2 opacity-0 transition group-hover:opacity-100">
          <button
            onClick={download}
            title="Download video"
            className="bg-surface-overlay/80 text-text-inverted rounded-full p-1.5 hover:bg-surface-overlay"
          >
            <Download size={14} />
          </button>
        </div>
      </div>
    );
  }

  // PROCESSING
  return (
    <div className="border-border-light bg-surface-code relative aspect-video w-full max-w-md overflow-hidden rounded-xl border">
      <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-surface-active via-surface-tertiary to-surface-active" />
      <div className="text-text-tertiary absolute inset-0 flex flex-col items-center justify-center gap-2 text-xs">
        <Film size={20} />
        <div className="flex items-center gap-1.5">
          <Loader2 size={12} className="animate-spin" />
          <span>Generating video…</span>
        </div>
        <span className="text-text-tertiary mt-1 max-w-xs px-4 text-center line-clamp-2">{prompt}</span>
      </div>
    </div>
  );
}
