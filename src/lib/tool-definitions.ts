/**
 * Anthropic-format tool definitions (from skills/claude-api/shared/tool-use-concepts.md)
 *
 * The Anthropic tool-use API exposes tools to the model as structured objects:
 *   { name, description, input_schema: { type: "object", properties, required } }
 *
 * The model returns a `tool_use` block:
 *   { type: "tool_use", id: "toolu_...", name, input: {...} }
 *
 * And expects a `tool_result` block in the next user turn:
 *   { type: "tool_result", tool_use_id: "toolu_...", content: "..." }
 *
 * This file is the single source of truth for tool schemas used by:
 *   - /api/chat (system prompt tool listing)
 *   - /api/chat/stream (SSE streaming, tool_use + tool_result events)
 *   - /api/tools (executor)
 *
 * Inspired by:
 *   - bolt.diy: file_write, file_read, file_list, code_run, shell_run, npm_install, web_search
 *   - Onyx: knowledge_search, assistant_use, list_assistants
 */

export interface ToolSchema {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, { type: string; description: string; items?: { type: string }; enum?: string[] }>;
    required: string[];
  };
}

export const TOOL_DEFINITIONS: ToolSchema[] = [
  // === File system (bolt.diy-inspired) ===
  {
    name: 'file_write',
    description:
      'Write content to a file in the workspace. Creates parent directories automatically. ' +
      'Use this to create or overwrite source files, configs, markdown, or any text document. ' +
      'Path is relative to the workspace root (e.g. "src/components/Button.tsx").',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative file path from workspace root.' },
        content: { type: 'string', description: 'Full file content to write.' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'file_read',
    description:
      'Read the contents of a file from the workspace. Returns the file content as a string. ' +
      'Use this to inspect existing code, configs, or docs before modifying them.',
    input_schema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Relative file path from workspace root.' } },
      required: ['path'],
    },
  },
  {
    name: 'file_list',
    description:
      'List the contents of a directory in the workspace. Returns an array of {name, type}. ' +
      'Use this to explore project structure or find files.',
    input_schema: {
      type: 'object',
      properties: {
        dir: { type: 'string', description: 'Relative directory path from workspace root. Default: "."' },
      },
      required: [],
    },
  },
  {
    name: 'file_delete',
    description: 'Delete a file from the workspace. Use sparingly — confirm intent with the user first.',
    input_schema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Relative file path from workspace root.' } },
      required: ['path'],
    },
  },

  // === Code execution (bolt.diy-inspired) ===
  {
    name: 'code_run',
    description:
      'Execute code in a sandbox. Supports JavaScript, TypeScript, Python, and Bash. ' +
      'Use this to test code, run scripts, validate output, or compute results. ' +
      'Output (stdout/stderr) is returned. Max 10s timeout.',
    input_schema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'The code to execute.' },
        language: {
          type: 'string',
          description: 'Language/runtime to use.',
          enum: ['javascript', 'typescript', 'python', 'bash'],
        },
      },
      required: ['code'],
    },
  },
  {
    name: 'shell_run',
    description:
      'Execute a shell command in the workspace. Use for build, test, lint, git, or any CLI task. ' +
      'Output (stdout + stderr) is returned. Max 15s timeout. Avoid destructive commands (rm -rf /).',
    input_schema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Shell command to execute.' },
        cwd: { type: 'string', description: 'Working directory relative to workspace root. Default: "."' },
      },
      required: ['command'],
    },
  },
  {
    name: 'npm_install',
    description:
      'Install npm packages into the workspace via bun add. Pass package names (with optional versions, e.g. "react@19"). ' +
      'Use this when the user asks to add a dependency.',
    input_schema: {
      type: 'object',
      properties: {
        packages: {
          type: 'array',
          items: { type: 'string' },
          description: 'Package names to install, e.g. ["lucide-react", "zustand@5"].',
        },
      },
      required: ['packages'],
    },
  },

  // === Web + knowledge (Onyx-inspired) ===
  {
    name: 'web_search',
    description:
      'Search the web for current information. Returns a synthesized answer to the query. ' +
      'Use this for facts, current events, or anything not in your training data.',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Search query.' } },
      required: ['query'],
    },
  },
  {
    name: 'knowledge_search',
    description:
      'Search the workspace knowledge base for relevant documents. Returns matching snippets. ' +
      'Use this BEFORE answering questions about documents the user has uploaded to the knowledge base.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural-language query to search the knowledge base.' },
        topK: { type: 'number', description: 'Max number of snippets to return. Default: 4.' },
      },
      required: ['query'],
    },
  },

  // === Project scaffold ===
  {
    name: 'project_create',
    description:
      'Scaffold a new project (Next.js by default) inside the workspace. Use this when the user asks to "create a new project" or "scaffold an app".',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Project directory name (kebab-case).' },
        type: { type: 'string', description: 'Project type', enum: ['nextjs'] },
      },
      required: ['name'],
    },
  },

  // === Canva MCP proxy ===
  {
    name: 'canva_mcp',
    description:
      'Proxy a call to the Canva MCP server (design creation, asset upload, etc.). ' +
      'Use this when the user wants to create Canva designs or assets.',
    input_schema: {
      type: 'object',
      properties: {
        mcpRequest: { type: 'string', description: 'JSON-stringified Canva MCP request payload.' },
      },
      required: ['mcpRequest'],
    },
  },
];

/** Build the system-prompt paragraph listing tools available to the AI, in Anthropic style. */
export function toolsToSystemPrompt(tools: ToolSchema[] = TOOL_DEFINITIONS): string {
  const list = tools.map((t) => {
    const params = Object.entries(t.input_schema.properties)
      .map(([k, v]) => {
        const req = t.input_schema.required.includes(k) ? ' (required)' : '';
        return `    - ${k} (${v.type})${req}: ${v.description}`;
      })
      .join('\n');
    return `### ${t.name}\n${t.description}\n  Params:\n${params || '    (none)'}`;
  }).join('\n\n');
  return `\n\n# Tools\n\nYou have access to the following tools. To call a tool, respond with ONLY this JSON format and nothing else:\n\n{"tool":"<tool_name>","args":{<params>}}\n\nAfter a tool call executes, its result will be fed back as a user message — continue the conversation normally.\n\nAvailable tools:\n\n${list}\n\nWhen the user asks you to create, modify, run, or look something up, USE the appropriate tool instead of just describing what you would do. Do not produce text-only responses for actionable requests.`;
}

/** Quick lookup by name. */
export const TOOL_BY_NAME = Object.fromEntries(
  TOOL_DEFINITIONS.map((t) => [t.name, t] as const)
) as Record<string, ToolSchema>;
