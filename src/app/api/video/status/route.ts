/**
 * GET /api/video/status?taskId=<id>
 *
 * Polls the SDK's async.result.query for a video generation task.
 * Returns { status, videoUrl? } — videoUrl is set when status === 'SUCCESS'.
 */

import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

export async function GET(req: NextRequest) {
  try {
    const taskId = new URL(req.url).searchParams.get('taskId');
    if (!taskId) return NextResponse.json({ error: 'taskId required' }, { status: 400 });

    const zai = await ZAI.create();
    const result: any = await zai.async.result.query(taskId);

    // The SDK returns video_result: [{url}], video_url, or url — handle all
    const videoUrl =
      result?.video_result?.[0]?.url ||
      result?.video_url ||
      result?.url ||
      result?.video ||
      null;

    return NextResponse.json({
      success: true,
      taskId,
      status: result?.task_status || 'PROCESSING',
      videoUrl,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
