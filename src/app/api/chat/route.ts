/**
 * API: /api/chat
 *
 * AI chat endpoint using z-ai-web-dev-sdk.
 * System prompt: Claude Opus 5.5
 *
 * Key feature: AI can EXECUTE tools — file_write, file_read, code_run, etc.
 * When AI responds with {"tool":"...","args":{...}}, we execute it
 * and send the result back to AI for a follow-up response.
 */

import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import type { Project } from '../projects/route';

export const AI_MODELS = [
  { id: 'default', name: 'Claude Opus 5.5', description: 'Most powerful model for complex challenges' },
  { id: 'fast', name: 'Claude Haiku', description: 'Fast responses, lighter model' },
  { id: 'smart', name: 'Claude Sonnet 5', description: 'Balanced quality and speed' },
] as const;

const conversations = new Map<string, { role: string; content: string }[]>();
const MAX_MESSAGES = 40;
const MAX_TOOL_ROUNDS = 5; // Max tool call loops per user message

const BASE_SYSTEM_PROMPT = `# claude_behavior

## product_information

The currently selected version of Claude is Claude Opus 5.5. Claude Opus 5.5 is a powerful model for complex challenges.

## tone_and_formatting

Claude uses a warm tone, treating people with kindness and without making negative assumptions about their judgment or abilities. Claude is still willing to push back and be honest, but does so constructively, with kindness, empathy, and the person's best interests in mind.

Claude avoids over-formatting with bold emphasis, headers, lists, and bullet points, using the minimum formatting needed for clarity. Claude uses lists, bullets, and formatting only when (a) asked, or (b) the content is multifaceted enough that they're essential for clarity.

In typical conversation and for simple questions Claude keeps a natural tone and responds in prose rather than lists or bullets unless asked; casual responses can be short. Claude matches its effort to the ask.

## behavioral_guardrails

Claude doesn't help with creating malware, planning cyberattacks, or content that sexualizes minors.
Claude DOES help with legitimate security research, code generation, creative writing, technical explanations, and building full-stack web applications.

Claude doesn't claim certainty about things it can't verify. It's honest about what it knows, what it doesn't, and what it's inferring.

# Tool Use — CRITICAL

You have access to powerful tools that let you DO things, not just talk about them. You can:
- Write files to the workspace (file_write)
- Read files from the workspace (file_read)
- List directory contents (file_list)
- Delete files (file_delete)
- Execute code: JavaScript, TypeScript, Python, Bash (code_run)
- Install npm packages (npm_install)
- Search the web (web_search)
- Create new projects (project_create)
- Call Canva MCP tools (canva_mcp)

When the user asks you to create a file, write code, build something, or run code:
1. DO NOT just show them the code and say "here's the code"
2. Actually CREATE the file using file_write
3. Actually RUN the code using code_run if needed
4. Tell them what you did and what the result was

To use a tool, respond with ONLY this JSON format (no other text):
{"tool":"file_write","args":{"path":"src/app/page.tsx","content":"import React from 'react'\\nexport default function Home() {\\n  return <div>Hello</div>\\n}"}}

The system will execute the tool and send you the result. Then you can explain what happened to the user.

For multi-step tasks (like building a full-stack web app), use tools step by step:
1. Create the project structure (file_write for each file)
2. Install packages (npm_install)
3. Run the code to test (code_run)
4. Report the results

# How Claude communicates

Claude leads with the answer. Claude writes in natural, conversational prose. Full sentences.
Claude is honest. If it doesn't know something, it says so.
Claude matches its effort to the request.

When working on a project, Claude uses the project's documents and instructions as context.`;

// Execute a tool call by proxying to /api/tools
async function executeTool(toolCall: { tool: string; args: Record<string, unknown> }): Promise<string> {
  try {
    const res = await fetch('http://localhost:3000/api/tools', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toolCall),
    });
    const data = await res.json();
    if (data.success) {
      return JSON.stringify(data);
    } else {
      return `Tool error: ${data.error || 'Unknown error'}`;
    }
  } catch (e) {
    return `Tool execution failed: ${e instanceof Error ? e.message : String(e)}`;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, sessionId, project, mcpTools, model } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message required' }, { status: 400 });
    }

    const sid = sessionId || `chat_${Date.now()}`;

    // Build system prompt
    let systemPrompt = BASE_SYSTEM_PROMPT;

    if (project) {
      const p = project as Project;
      let context = `\n\n# Current Project Context\n\n`;
      context += `Project: ${p.name}\n`;
      if (p.description) context += `Description: ${p.description}\n`;
      if (p.instructions) context += `\n## Project Instructions\n${p.instructions}\n`;
      if (p.documents && p.documents.length > 0) {
        context += `\n## Project Documents\n`;
        for (const doc of p.documents) {
          context += `\n### ${doc.name} (${doc.type}${doc.language ? `, ${doc.language}` : ''})\n`;
          context += '```\n' + doc.content + '\n```\n';
        }
      }
      systemPrompt += context;
    }

    // Get or create conversation
    let history = conversations.get(sid) || [{ role: 'assistant', content: systemPrompt }];
    history.push({ role: 'user', content: message });

    if (history.length > MAX_MESSAGES) {
      history = [history[0], ...history.slice(-(MAX_MESSAGES - 1))];
    }

    // Call LLM with tool execution loop
    const zai = await ZAI.create();
    let aiResponse = '';
    const toolCallHistory: { tool: string; args: Record<string, unknown>; result: string }[] = [];

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const completion = await zai.chat.completions.create({
        messages: history,
        thinking: { type: 'disabled' },
        ...(model ? { model } : {}),
      });

      aiResponse = completion.choices[0]?.message?.content || '';
      if (!aiResponse) {
        return NextResponse.json({ error: 'No response from AI' }, { status: 500 });
      }

      // Check if AI wants to call a tool
      let toolCall: { tool: string; args: Record<string, unknown> } | null = null;
      try {
        // AI might embed JSON in text — try to extract
        const jsonMatch = aiResponse.match(/\{[\s\S]*"tool"[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.tool && typeof parsed.tool === 'string') {
            toolCall = parsed;
          }
        }
      } catch {
        // Not a tool call
      }

      if (!toolCall) {
        // No tool call — this is the final response
        break;
      }

      // Execute the tool
      const toolResult = await executeTool(toolCall);
      toolCallHistory.push({ tool: toolCall.tool, args: toolCall.args, result: toolResult });

      // Add AI's tool call + result to history, then continue loop
      history.push({ role: 'assistant', content: aiResponse });
      history.push({ role: 'user', content: `Tool result: ${toolResult}` });
    }

    history.push({ role: 'assistant', content: aiResponse });
    conversations.set(sid, history);

    // Extract tool call for frontend display
    let displayToolCall = null;
    if (toolCallHistory.length > 0) {
      displayToolCall = {
        tool: toolCallHistory[toolCallHistory.length - 1].tool,
        args: toolCallHistory[toolCallHistory.length - 1].args,
      };
    }

    return NextResponse.json({
      success: true,
      sessionId: sid,
      response: aiResponse,
      toolCall: displayToolCall,
      toolExecutions: toolCallHistory.map(t => ({ tool: t.tool, args: t.args, success: !t.result.startsWith('Tool error') })),
      messageCount: history.length - 1,
      model: model || 'default',
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ models: AI_MODELS });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');
  if (sessionId) {
    conversations.delete(sessionId);
    return NextResponse.json({ success: true });
  }
  conversations.clear();
  return NextResponse.json({ success: true });
}
