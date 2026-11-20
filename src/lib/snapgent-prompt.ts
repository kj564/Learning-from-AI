/**
 * Snapgent system prompt — EXACT from snapgent-connector core/config.js
 * Non-Roblox (VS Code) branch, verbatim from buildSystemPrompt().
 * Commands: {"command":"tool_name","params":{...}} in fenced JSON blocks.
 */

export const SNAPGENT_SYS_MARKER = '⟦ZS-SYS⟧';
export const SNAPGENT_RESEND_MARKER = '⟦ZS-RE⟧';

export const SNAPGENT_TOOLS = [
  { name: 'get_workspace_info', desc: 'Get the active VS Code workspace name, path, and Git status.', args: '' },
  { name: 'get_project_info', desc: 'Inspect common project manifests and package scripts.', args: '' },
  { name: 'list_dir', desc: 'List files and folders in the workspace.', args: 'path?' },
  { name: 'list_tree', desc: 'List a bounded tree of workspace files and folders.', args: 'path?, max_depth?' },
  { name: 'find_files', desc: 'Find workspace files by glob pattern.', args: 'path?, pattern?' },
  { name: 'search_files', desc: 'Search text in workspace files.', args: 'path, query, file_pattern?, case_sensitive?' },
  { name: 'read_file', desc: 'Read a UTF-8 text file in the workspace.', args: 'path' },
  { name: 'read_files', desc: 'Read up to 50 workspace files.', args: 'paths' },
  { name: 'read_file_lines', desc: 'Read a bounded line range from a workspace file.', args: 'path, start_line?, end_line?' },
  { name: 'get_file_info', desc: 'Get size, type, extension, and modification time for a workspace path.', args: 'path' },
  { name: 'get_file_outline', desc: 'List class and function declarations from a source file.', args: 'path' },
  { name: 'create_file', desc: 'Create a new file without overwriting an existing file.', args: 'path, content?' },
  { name: 'write_file', desc: 'Write or replace a UTF-8 text file inside the workspace.', args: 'path, content' },
  { name: 'edit_file', desc: 'Replace an exact text snippet; by default the snippet must be unique.', args: 'path, old_text, new_text, replace_all?' },
  { name: 'create_directory', desc: 'Create a directory inside the workspace.', args: 'path' },
  { name: 'move_file', desc: 'Move a file inside the workspace without overwriting a destination.', args: 'source, destination' },
  { name: 'copy_file', desc: 'Copy a file inside the workspace without overwriting a destination.', args: 'source, destination' },
  { name: 'git_status', desc: 'Show the current Git branch and working-tree status.', args: '' },
  { name: 'git_diff', desc: 'Show unstaged Git changes, optionally for one workspace path.', args: 'path?' },
  { name: 'git_log', desc: 'Show recent Git commits.', args: 'limit?' },
  { name: 'git_branches', desc: 'List local Git branches.', args: '' },
  { name: 'run_command', desc: 'Run a command with the workspace as its working directory.', args: 'command, args?' },
  { name: 'run_project_script', desc: 'Run a named safe script (build, check, format, lint, test, typecheck) from package.json.', args: 'script' },
  { name: 'run_tests', desc: 'Run the workspace test script, pytest, or .NET tests when configured.', args: '' },
  { name: 'delete_file', desc: 'Delete one file inside the workspace; directories, the workspace root, and .git are refused.', args: 'path' },
  { name: 'apply_patch', desc: 'Apply several exact text replacements to one file.', args: 'path, edits' },
  { name: 'git_add', desc: 'Stage specific workspace paths; staging the whole workspace is refused.', args: 'paths' },
  { name: 'git_commit', desc: 'Commit the currently staged changes with a message.', args: 'message' },
];

// Virtual commands handled by our app (not real MCP tools)
export const SNAPGENT_VIRTUAL_TOOLS = [
  { name: 'list_commands', desc: 'List available VS Code commands with full parameter details.', args: 'server?' },
  { name: 'list_tools', desc: 'Same as list_commands.', args: 'server?' },
  { name: 'list_mcp_servers', desc: 'List connected MCP servers.', args: '' },
];

export function buildSnapgentPrompt(tools: typeof SNAPGENT_TOOLS = SNAPGENT_TOOLS): string {
  const BT = '```';
  const toolList = tools
    .map((t) => `  ${t.name}(${t.args}) - ${t.desc}`)
    .join('\n');

  return `${SNAPGENT_SYS_MARKER}

CONTEXT: snapgentV3 is a browser extension that sends your plain-text JSON commands to the user's selected MCP server through their local bridge. The selected target is VS Code (server id: vscode).

The extension reads commands from your normal reply text and runs them on that MCP server. Your own built-in tools, connectors, or code execution do not access the user's machine. For work on the selected target, write exactly one command per reply as a fenced JSON block:
${BT}json
{"command":"exact_tool_name","params":{"key":"value"}}
${BT}

At the start of the session, call \`list_commands\` with server "vscode" to get the exact available tools and parameter schemas. Use only names and parameters from that result. Do not assume tools are available. If the needed tool is missing or the server is offline, explain that clearly and do not claim the task is complete. Do not call tools on another server unless the user asks to switch targets.

Rules:
- Execute one command at a time and wait for its result before writing another.
- Put every command in a fenced JSON code block; do not use native function calls.
- Respect the user's requested workspace and file scope. Never perform broad or destructive changes without explicit confirmation.
- On errors, use the returned error to adjust the next command; do not silently claim success.
- When finished, summarize the completed work briefly.
- You are Z.ai (GLM); snapgentV3 carries out the commands on the selected target.

Available tools:
${toolList}

Also available (virtual):
  list_commands(server?) - list available VS Code commands with full parameter details
  list_tools(server?) - same as list_commands
  list_mcp_servers() - list connected MCP servers`;
}

/** Extract snapgent command from AI text — handles fenced code blocks. */
export function extractSnapgentCommand(text: string): { command: string; params: Record<string, unknown> } | null {
  if (!text) return null;

  // 1. Check for fenced ```json blocks containing commands
  const fenceRe = /```(?:json)?\s*\n([\s\S]*?)```/g;
  let match;
  while ((match = fenceRe.exec(text)) !== null) {
    const block = match[1].trim();
    const cmd = tryParseCommand(block);
    if (cmd) return cmd;
  }

  // 2. Check for bare {"command":"..."} or {"tool":"..."} objects anywhere
  const cmd = tryParseCommand(text.trim());
  if (cmd) return cmd;

  // 3. Balanced-brace scan
  return findCommandInText(text);
}

function tryParseCommand(jsonStr: string): { command: string; params: Record<string, unknown> } | null {
  try {
    const parsed = JSON.parse(jsonStr);
    if (!parsed || typeof parsed !== 'object') return null;
    const name = parsed.command || parsed.tool || parsed.name;
    if (!name || typeof name !== 'string') return null;
    const params = parsed.params || parsed.arguments || parsed.args || {};
    if (typeof params !== 'object') return null;
    return { command: name, params };
  } catch {
    return null;
  }
}

function findCommandInText(text: string): { command: string; params: Record<string, unknown> } | null {
  let i = 0;
  while (i < text.length) {
    if (text[i] !== '{') { i++; continue; }
    let depth = 0, inStr = false, escape = false;
    for (let j = i; j < text.length; j++) {
      const c = text[j];
      if (inStr) {
        if (escape) escape = false;
        else if (c === '\\') escape = true;
        else if (c === '"') inStr = false;
      } else {
        if (c === '"') inStr = true;
        else if (c === '{') depth++;
        else if (c === '}') {
          depth--;
          if (depth === 0) {
            const json = text.slice(i, j + 1);
            const cmd = tryParseCommand(json);
            if (cmd) return cmd;
            break;
          }
        }
      }
    }
    i++;
  }
  return null;
}

/** Strip the command JSON from visible text. */
export function stripSnapgentCommand(text: string): string {
  // Remove fenced code blocks containing commands
  const fenceRe = /```(?:json)?\s*\n\{[\s\S]*?"command"[\s\S]*?\}\s*```/g;
  let result = text.replace(fenceRe, '');

  // Remove bare JSON objects with command/tool key
  const cmd = extractSnapgentCommand(result);
  if (cmd) {
    // Find and remove the JSON object
    let i = 0;
    while (i < result.length) {
      if (result[i] !== '{') { i++; continue; }
      let depth = 0, inStr = false, escape = false;
      for (let j = i; j < result.length; j++) {
        const c = result[j];
        if (inStr) {
          if (escape) escape = false;
          else if (c === '\\') escape = true;
          else if (c === '"') inStr = false;
        } else {
          if (c === '"') inStr = true;
          else if (c === '{') depth++;
          else if (c === '}') {
            depth--;
            if (depth === 0) {
              const json = result.slice(i, j + 1);
              try {
                const parsed = JSON.parse(json);
                if (parsed.command || parsed.tool) {
                  result = result.slice(0, i) + result.slice(j + 1);
                  break;
                }
              } catch {}
              break;
            }
          }
        }
      }
      i++;
    }
  }

  return result.trim();
}

/** Check if text contains a snapgent command signature. */
export function hasCommandSignature(text: string): boolean {
  if (!text) return false;
  return /"(?:command|tool)"\s*:\s*"/.test(text) ||
    /###\s*lua/i.test(text) ||
    /###mcp_tool###/i.test(text);
}

/** Tool category → icon + color (from config.js toolCategory). */
export function toolCategory(name: string): { color: string; label: string } {
  const n = (name || '').includes('/') ? name.split('/').pop() : (name || '');
  if (/^(get_workspace_info|get_project_info|list_dir|list_tree|find_files|search_files|read_file|read_files|read_file_lines|get_file_info|get_file_outline|list_commands|list_tools|list_mcp_servers)$/.test(n))
    return { color: 'text-blue-400', label: 'read' };
  if (/^(create_file|write_file|edit_file|create_directory|move_file|copy_file|delete_file|apply_patch|git_add|git_commit)$/.test(n))
    return { color: 'text-green-400', label: 'edit' };
  if (/^(git_status|git_diff|git_log|git_branches)$/.test(n))
    return { color: 'text-orange-400', label: 'git' };
  if (/^(run_command|run_project_script|run_tests)$/.test(n))
    return { color: 'text-amber-400', label: 'run' };
  return { color: 'text-zinc-400', label: 'tool' };
}

/** Format list_commands output (what the AI sees when it calls list_commands). */
export function formatListCommands(tools: typeof SNAPGENT_TOOLS): string {
  const lines = tools.map((t) => {
    const params = t.args || '';
    return `${t.name}(${params}) - ${t.desc}`;
  });
  return `Output of 'list_commands':\nVS Code commands (${tools.length}):\n\n${lines.join('\n')}`;
}
