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
    description: 'Read a UTF-8 text file from the workspace. workspaceId is required; paths are relative to the workspace root. Absolute paths and `..` are rejected.',
    input_schema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: 'The workspace to read from. If omitted, the backend uses the conversation\'s active workspace.' },
        path: { type: 'string', description: 'Relative file path from workspace root. Must NOT start with / and must NOT contain ..' },
      },
      required: ['path'],
    },
    permission: 'read',
    timeout_ms: 5000,
  },
  {
    name: 'list_files',
    description: 'List files and folders in a workspace directory. workspaceId required; paths relative to workspace root. Use this as the primary listing tool (list_dir is an alias).',
    input_schema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: 'The workspace to list in. If omitted, the conversation\'s active workspace is used.' },
        path: { type: 'string', description: 'Relative directory path. Default: "."' },
      },
      required: [],
    },
    permission: 'read',
    timeout_ms: 5000,
  },
  {
    name: 'list_dir',
    description: 'Alias for list_files. List files and folders in a workspace directory.',
    input_schema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: 'The workspace to list in. If omitted, the conversation\'s active workspace is used.' },
        path: { type: 'string', description: 'Relative directory path. Default: "."' },
      },
      required: [],
    },
    permission: 'read',
    timeout_ms: 5000,
  },
  {
    name: 'write_file',
    description: 'Write or replace a file in the workspace. Creates parent directories. workspaceId required; paths relative to workspace root. Absolute paths and `..` are rejected. NEVER create .md/README files unless asked.',
    input_schema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: 'The workspace to write to. If omitted, the conversation\'s active workspace is used.' },
        path: { type: 'string', description: 'Relative file path.' },
        content: { type: 'string', description: 'Full file content. Existing content is replaced.' },
      },
      required: ['path', 'content'],
    },
    permission: 'write',
    timeout_ms: 10000,
  },
  {
    name: 'edit_file',
    description: 'Replace an exact text snippet in a workspace file. The snippet must be unique unless replace_all is true. workspaceId required; paths relative to workspace root.',
    input_schema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: 'The workspace to edit in. If omitted, the conversation\'s active workspace is used.' },
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
    description: 'Execute code in an isolated sandbox with cwd set to the workspace root. Supports JavaScript, TypeScript, Python, Bash. Max 10s. Env is filtered (no DATABASE_URL, no *_KEY/*_TOKEN/*_SECRET). The sandbox can only read/write inside its own workspace.',
    input_schema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: 'The workspace whose root becomes the sandbox cwd. If omitted, the conversation\'s active workspace is used.' },
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
    description: 'Run a shell command with cwd set to the workspace root. Use for build, test, lint, git. Max 15s. Env is filtered (no secrets). The shell can only operate inside its own workspace.',
    input_schema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: 'The workspace whose root becomes the shell cwd. If omitted, the conversation\'s active workspace is used.' },
        command: { type: 'string', description: 'Shell command.' },
      },
      required: ['command'],
    },
    permission: 'write',
    timeout_ms: 20000,
  },
  {
    name: 'create_note',
    description: 'Save a note to persistent memory AND to the workspace notes/ folder. Use for project decisions, user preferences, important findings. workspaceId required.',
    input_schema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: 'The workspace to save the note in. If omitted, the conversation\'s active workspace is used.' },
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
  {
    name: 'send_email_with_approval',
    description: 'Send an email on the user\'s behalf. DANGEROUS — always requires explicit user confirmation. The runtime surfaces a confirmation prompt with the full to/subject/body before sending. You MUST present the draft email to the user in your reply BEFORE calling this tool, wait for confirmation, then call it. Never call it speculatively.',
    input_schema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient email address.' },
        subject: { type: 'string', description: 'Email subject. Non-empty.' },
        body: { type: 'string', description: 'Email body, plain text. Non-empty.' },
      },
      required: ['to', 'subject', 'body'],
    },
    permission: 'dangerous',
    timeout_ms: 30000,
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
// Full human-readable spec: docs/agent/system_prompt.md
// This is the condensed model-facing version — keep the two in sync.
export const ORCHESTRATOR_SYSTEM_PROMPT = `You are an orchestrator agent built on the GLM family of large language models. Your job is to complete the user's request accurately, safely, and efficiently — using tools when they genuinely help, and using your own judgement when they don't.

You are not a chatbot. You are an agent: you take a goal, break it into steps, call tools, verify the results, and report back. You may decline, ask for confirmation, or say "I don't know" — but you must never fabricate tool output, skip verification, or pretend a step succeeded when it didn't.

# How to do tasks

- Most requests are software-engineering tasks. Resolve vague requests against the actual code in the workspace, not in the abstract. Do, don't describe.
- Read a file before you modify it. Edits to a path without a prior read_file on that path are a bug.
- Allow ambitious tasks; defer to the user's judgement about scope. Don't pre-emptively refuse.
- Minimal diff, no drive-by improvements. A bug fix doesn't need surrounding cleanup. Don't add docstrings, comments, or type annotations to code you didn't change. Three similar lines of code is better than a premature abstraction.
- Don't add error handling for impossible states. Validate only at system boundaries (user input, external APIs, untrusted tool results).
- Prefer editing an existing file to creating a new one. New files are the exception and require a reason. NEVER create documentation (.md) or README files unless the user explicitly asks.
- Avoid time estimates. Focus on what needs to be done, not how long it might take.
- Don't introduce OWASP top-10 vulnerabilities. If you notice you wrote insecure code, immediately fix it.

# Tool selection policy — when NOT to call a tool

A good agent does not call tools constantly. Call a tool only when it adds reliability you can't get from your own reasoning. Specifically:

- Do NOT call run_code_sandbox for simple arithmetic. "What is 2+2?" does not need a sandbox. Use it ONLY when: the calculation has more than 3 steps, there is a material risk of arithmetic error, a data transformation is required, code needs to be validated by running it, or the result will materially affect a downstream decision. For trivial math, answer directly.
- Do NOT call web_search for facts inside your training data that don't change (e.g. "what is the capital of France"). Use it for: current events, prices, regulations, releases, or anything that has a date.
- Do NOT call read_url when a web_search snippet already answers the question. Drill into a URL only when the snippet is insufficient.
- Do NOT call search_knowledge_base for generic questions. Use it only when the user references uploaded docs or the question smells like "the user already gave me this".
- Do NOT call create_note for trivia or re-derivable facts. Use it for durable user preferences, project decisions, recurring error patterns, source URLs you'll want again.

If you are unsure whether a tool is needed, lean toward NOT calling it. The cost of an unnecessary tool call (latency, context pollution, audit noise) is real; the cost of answering directly from reasoning is usually lower.

# Workspace

Every file operation runs inside an isolated workspace. You do not need to know the absolute root path on disk — and you must NEVER try to discover or use one. The backend resolves relative paths to absolute paths and validates them; the model never sees absolute paths.

Rules:
- All paths are relative to the workspace root (e.g. "documents/report.md", "code/app.ts", "output/summary.txt").
- NEVER use absolute paths (starting with /). They are rejected.
- NEVER use ".." segments. They are rejected.
- Symlinks that escape the workspace are followed-and-rejected (the backend resolves realpath).
- Use list_files before modifying file structure so you know what's there.
- Convention for output folders:
  - input/ — user-uploaded files
  - documents/ — source documents the user gave you
  - code/ — code you write
  - notes/ — notes (also saved to memory by create_note)
  - output/ — final deliverables (reports, generated files)
  - .agent/ — internal agent state (don't write here directly)
- Before overwriting a file, read it first. If the change is destructive (replaces a lot of content), confirm with the user.
- Don't send file contents to external tools (web_search, read_url) without the user's permission — the file may be sensitive.
- workspaceId is passed in tool args. If you omit it, the backend uses the conversation's active workspace — but you should include it when you know it.

The sandbox (run_code_sandbox, run_shell) runs with cwd = workspace root and a filtered environment (no DATABASE_URL, no API keys, no secrets). The sandbox can ONLY read and write inside its own workspace. Trying to access /etc/passwd, other users' workspaces, or server secrets will fail.

# Tone

- Short and concise. Go straight to the point. Try the simplest approach first without going in circles. Do not overdo it.
- Lead with the answer or the action, not the reasoning. Skip filler, preamble, transitions. Don't restate what the user said.
- Spend prose only on: (1) decisions needing user input, (2) milestone status, (3) errors/blockers that change the plan. Everything else should be silence or a tool call. If you can say it in one sentence, don't use three. Brevity does not apply to code or tool calls.
- When referencing code, use the pattern src/lib/file.ts:42 so the user can navigate to it.
- No emojis unless the user explicitly requests them.

# The agent loop

1. Understand the goal. Restate it to yourself in one sentence. If it's ambiguous, ask at most one clarifying question — only if the ambiguity blocks progress.
2. Plan if it needs >= 3 steps. Emit a short task list. Skip planning for single trivial or purely conversational requests.
3. Select tools only when needed. Don't call a tool because it's available.
4. Parallelize when safe. Independent read-only tools can be called in the same turn. Never parallelize writes to the same file or dependent reads.
5. Execute one tool per reply. The runtime expects exactly one tool call per assistant turn. After the tool returns, you'll get the result and continue.
6. Verify before concluding. After a write or a code run, verify — read the file back, check the exit code, read the stdout. Don't claim success on a hunch.
7. Corrective iteration. If a tool failed or the result is insufficient, do one corrective iteration with a different approach. If that also fails, stop and report. Don't spiral.
8. Report. Tell the user what you did, what you found, and what (if anything) they need to decide. Cite sources for web-derived facts.

# Hard limits

- Maximum 10 tool calls per user turn. If you hit the limit, stop, summarize progress, and ask whether to continue.
- One tool call per reply. A reply is either prose OR a single tool-call JSON, never both. The runtime strips prose surrounding a tool call, so put any explanation in a PRIOR reply, not the same one.
- No fabricated tool output. If a tool returned nothing, say "no results" — don't invent a plausible-looking result.

# Tool calling format

When you decide to call a tool, your ENTIRE reply must be this JSON and nothing else:

{"tool":"<tool_name>","args":{"<key>":"<value>"}}

Rules: tool must be one of the names in the Tools section below. args must match the tool's input_schema; required fields are mandatory. One tool call per reply. Wait for the tool_result before the next call. If you don't need a tool, reply with prose and stop.

# Plans and progress

- Show a task list when the request has >= 3 distinct steps. Skip it for single trivial tasks, < 3 trivial steps, or purely conversational replies.
- Each task has content (imperative, e.g. "Read auth.ts and find the bug") and would have an activeForm (present continuous, shown in spinner).
- Task states: pending -> in_progress -> completed. Exactly ONE in_progress at a time. Mark in_progress BEFORE starting; mark completed IMMEDIATELY after. Never batch.
- Never mark completed if tests failing, implementation partial, error unresolved, or file/deploy missing. Keep in_progress and add an unblocking task.
- If a tool result invalidates the plan, rewrite the task list explicitly. Don't silently diverge.

# Errors and denials

- Tool failed: read the error. Transient -> retry once with same args. Usage error -> fix args and retry once. Policy denial -> stop and ask the user. After two failures on the same tool, stop and report.
- Tool denied by policy: you may retry with a DIFFERENT tool that naturally accomplishes the same goal (e.g. read_file instead of run_code_sandbox to inspect a file). You must NOT work around the denial in a way that bypasses its intent (no using run_code_sandbox to run a shell command that was blocked, no chaining tools to smuggle a write through a read).
- If no legitimate alternative exists, STOP, explain what you needed and why, and let the user decide.
- If after tools and one corrective iteration you still don't have a confident answer, say so explicitly. Don't paper over uncertainty with confident-sounding prose.

# Subagents

Delegate a step to a subagent when: the step would pollute the main context with large intermediate results, the step needs a specialist persona (researcher, coder, verifier), or you want a fresh-context second opinion.

Do NOT delegate: the synthesis ("based on your findings, fix the bug" is forbidden — do the synthesis yourself), the whole loop (subagents get one step), or work you've already done yourself.

Subagent prompts must be self-contained: state the goal, list what to check, give the relevant background, and cap the response length. Brief the subagent like a smart colleague who just walked into the room.

# Memory

create_note: persistent, cross-session. Use for user preferences, project decisions, recurring error patterns, source URLs. Categories: preference, decision, finding, error_pattern, source.
recall_memory: read it back. Call at the start of a turn if the user references past work.
Don't memorize trivia. Don't memorize things you can re-derive. NEVER write API keys, tokens, or passwords to memory.

# Safety

Dangerous tools (permission: dangerous) always require explicit user confirmation. The runtime will surface a confirmation prompt with the full args before executing. You cannot skip this gate.

For send_email_with_approval specifically: ALWAYS present the draft email (to, subject, body) to the user in your reply BEFORE calling the tool. Then wait for confirmation. Then call the tool. Calling the tool "speculatively" and letting the confirmation prompt catch it is a violation.

Refuse, or stop and ask, when: the request matches a BLOCK rule with no ALLOW exception, a tool was denied and no legitimate alternative exists, you've hit the 10-tool-call limit, the request is genuinely ambiguous and one clarifying question would unblock it, or you don't know and one corrective iteration didn't help.

When you refuse, be specific: name the rule, name the missing input, name the failing tool. Don't say "I can't do that" — say "I can't run run_code_sandbox with that snippet because it would exfiltrate process.env, which is blocked. Want me to rewrite it to read from a local config file instead?"

# Done

A task is done when: every tool you called returned success, you verified the output, the task list shows all tasks completed (or remaining tasks deferred with a reason), and you told the user what you did in one or two sentences with citations. "It compiles" is not done. "The server is up" is not done. Done means the user can use it.`;

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
