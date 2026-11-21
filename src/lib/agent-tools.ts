/**
 * Agent tools — Anthropic-standard tool definitions.
 *
 * Each tool has: name, description, input_schema, permission tier, examples.
 * Tools are grouped by subagent: orchestrator, researcher, coder, file_analyst, writer.
 *
 * Permission tiers:
 *   read     — safe, no side effects (search, read, list)
 *   write    — modifies state (create, edit, delete files; send)
 *   dangerous — external actions (email, payment, delete production data)
 */

export type PermissionTier = 'read' | 'write' | 'dangerous';

export interface AgentTool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
  permission: PermissionTier;
  timeout_ms: number;
  examples?: { input: Record<string, unknown>; output: string }[];
}

// === ORCHESTRATOR TOOLS (available to all) ===

export const ORCHESTRATOR_TOOLS: AgentTool[] = [
  {
    name: 'web_search',
    description: 'Search the web for current information. Use for facts, news, prices, regulations, or topics that can change. Do NOT use for private user data.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query in English or Indonesian.' },
        max_results: { type: 'integer', default: 5, minimum: 1, maximum: 10 },
      },
      required: ['query'],
    },
    permission: 'read',
    timeout_ms: 15000,
    examples: [
      { input: { query: 'GLM-4.6 release date' }, output: '{"results":[{"url":"...","name":"...","snippet":"..."}]}' },
    ],
  },
  {
    name: 'read_url',
    description: 'Read the full content of a web page. Use after web_search to get details from a specific result.',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The URL to read.' },
      },
      required: ['url'],
    },
    permission: 'read',
    timeout_ms: 20000,
  },
  {
    name: 'search_knowledge_base',
    description: 'Search the workspace knowledge base for uploaded documents. Use BEFORE answering questions about documents the user has uploaded.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural-language query.' },
        top_k: { type: 'integer', default: 4, minimum: 1, maximum: 10 },
      },
      required: ['query'],
    },
    permission: 'read',
    timeout_ms: 5000,
  },
  {
    name: 'read_file',
    description: 'Read a UTF-8 text file from the workspace.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative file path from workspace root.' },
      },
      required: ['path'],
    },
    permission: 'read',
    timeout_ms: 5000,
  },
  {
    name: 'list_dir',
    description: 'List files and folders in a directory.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative directory path. Default: "."' },
      },
      required: [],
    },
    permission: 'read',
    timeout_ms: 5000,
  },
  {
    name: 'write_file',
    description: 'Write or replace a file in the workspace. Creates parent directories.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative file path.' },
        content: { type: 'string', description: 'Full file content.' },
      },
      required: ['path', 'content'],
    },
    permission: 'write',
    timeout_ms: 10000,
  },
  {
    name: 'edit_file',
    description: 'Replace an exact text snippet in a file. The snippet must be unique unless replace_all is true.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative file path.' },
        old_text: { type: 'string', description: 'Exact text to find.' },
        new_text: { type: 'string', description: 'Replacement text.' },
        replace_all: { type: 'boolean', default: false },
      },
      required: ['path', 'old_text', 'new_text'],
    },
    permission: 'write',
    timeout_ms: 10000,
  },
  {
    name: 'run_code_sandbox',
    description: 'Execute code in an isolated sandbox. Supports JavaScript, TypeScript, Python, and Bash. Max 10s timeout.',
    input_schema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Code to execute.' },
        language: { type: 'string', enum: ['javascript', 'typescript', 'python', 'bash'] },
      },
      required: ['code'],
    },
    permission: 'write',
    timeout_ms: 15000,
  },
  {
    name: 'run_shell',
    description: 'Run a shell command in the workspace. Use for build, test, lint, git. Max 15s timeout.',
    input_schema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Shell command.' },
      },
      required: ['command'],
    },
    permission: 'write',
    timeout_ms: 20000,
  },
  {
    name: 'create_note',
    description: 'Save a note to persistent memory. Use for project decisions, user preferences, or important findings.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Note title.' },
        content: { type: 'string', description: 'Note content.' },
        category: { type: 'string', enum: ['preference', 'decision', 'finding', 'error_pattern', 'source'], description: 'Memory category.' },
      },
      required: ['title', 'content', 'category'],
    },
    permission: 'write',
    timeout_ms: 5000,
  },
  {
    name: 'recall_memory',
    description: 'Recall notes from persistent memory. Use to check user preferences, past decisions, or learned patterns.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'What to recall.' },
      },
      required: ['query'],
    },
    permission: 'read',
    timeout_ms: 5000,
  },
];

// === ALL TOOLS (for the orchestrator) ===
export const ALL_TOOLS = ORCHESTRATOR_TOOLS;

// === SUBAGENT DEFINITIONS ===
export interface Subagent {
  name: string;
  description: string;
  tools: string[]; // tool names this subagent can use
  system_prompt: string;
}

export const SUBAGENTS: Subagent[] = [
  {
    name: 'researcher',
    description: 'Research the web and validate sources. Use for fact-checking, news, comparisons.',
    tools: ['web_search', 'read_url', 'recall_memory'],
    system_prompt: 'You are a researcher subagent. Your job is to find accurate, current information. Always cite sources. If sources conflict, report both. Do not fabricate data.',
  },
  {
    name: 'file_analyst',
    description: 'Read and analyze files in the workspace. Use for code review, document analysis.',
    tools: ['read_file', 'list_dir', 'search_knowledge_base', 'edit_file'],
    system_prompt: 'You are a file analyst subagent. Read files carefully, report structure, issues, and patterns. Suggest improvements but do not make changes without confirmation.',
  },
  {
    name: 'coder',
    description: 'Write, review, and test code. Use for implementation, debugging, refactoring.',
    tools: ['read_file', 'write_file', 'edit_file', 'run_code_sandbox', 'run_shell', 'list_dir'],
    system_prompt: 'You are a coder subagent. Write clean, tested code. Always run code to verify it works. Report what you created and any errors encountered.',
  },
  {
    name: 'writer',
    description: 'Write reports, emails, documentation, and content. Use for content creation.',
    tools: ['write_file', 'read_file', 'web_search', 'recall_memory', 'create_note'],
    system_prompt: 'You are a writer subagent. Write clear, concise content. Check facts with web_search if needed. Save key decisions to memory.',
  },
];

// === ORCHESTRATOR SYSTEM PROMPT (Anthropic-standard) ===
export const ORCHESTRATOR_SYSTEM_PROMPT = `You are an orchestrator agent.

Goal: Complete the user's request accurately, safely, and efficiently.

Process:
1. Identify the user's final goal.
2. Make a brief plan if the task needs more than one step.
3. Select tools only when truly needed.
4. Run independent tools in parallel when safe.
5. Verify results before concluding.
6. If results are insufficient, do one corrective iteration.
7. Explain steps taken and sources used.
8. For write, delete, send, payment, or sensitive access — ask user confirmation first.

Limitations:
- Maximum 10 tool calls per task.
- Do not fabricate tool data.
- Do not execute code directly; use the sandbox.
- Do not send user data to external tools without permission.
- If a tool fails, report the error and offer an alternative.

Tool calling format: respond with ONLY this JSON, nothing else:
{"tool":"tool_name","args":{"key":"value"}}

One tool call per reply. Wait for the result before the next call.`;

// === GUARDRAILS ===
export const GUARDRAILS = {
  MAX_STEPS: 10,
  TIMEOUT_PER_TOOL_MS: 30000,
  RETRY_COUNT: 2,
  RETRY_DELAY_MS: 1000,
  COST_CEILING_TOKENS: 50000,
  PARALLEL_TOOL_USE: true,
  REQUIRE_APPROVAL: ['send_email', 'delete_file', 'git_commit', 'run_shell'] as string[],
};

/** Build the tools section of the system prompt. */
export function toolsToSystemPrompt(tools: AgentTool[] = ALL_TOOLS): string {
  const list = tools.map((t) => {
    const params = Object.entries(t.input_schema.properties)
      .map(([k, v]: [string, any]) => {
        const req = t.input_schema.required.includes(k) ? ' (required)' : '';
        return `    - ${k} (${v.type})${req}: ${v.description}`;
      })
      .join('\n');
    return `### ${t.name}\n${t.description}\n  Permission: ${t.permission}\n  Params:\n${params || '    (none)'}`;
  }).join('\n\n');
  return `\n\n# Tools\n\n${list}\n\nTo call a tool, respond with ONLY this JSON format:\n{"tool":"<tool_name>","args":{<params>}}\n\nAfter the tool runs, its result will be sent back. Continue the conversation normally.`;
}
