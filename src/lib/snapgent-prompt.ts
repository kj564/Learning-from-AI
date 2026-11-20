/**
 * Snapgent system prompt — injected when the user enables snapgent mode.
 *
 * This tells the AI to output commands in snapgent format:
 *   {"command": "tool_name", "params": { ... }}
 *
 * The browser extension (or our built-in bridge client) detects these commands
 * in the AI's text output, forwards them to the local bridge, and feeds results
 * back.
 *
 * The 28 VS Code MCP tools are the same ones defined in vscode_mcp.py.
 */

export const SNAPGENT_TOOLS = [
  { name: 'get_workspace_info', desc: 'Get the active VS Code workspace name, path, and Git status.', args: '' },
  { name: 'get_project_info', desc: 'Inspect common project manifests and package scripts.', args: '' },
  { name: 'list_dir', desc: 'List files and folders in the workspace.', args: 'path' },
  { name: 'list_tree', desc: 'List a bounded tree of workspace files and folders.', args: 'path, max_depth' },
  { name: 'find_files', desc: 'Find workspace files by glob pattern.', args: 'path, pattern' },
  { name: 'search_files', desc: 'Search text in workspace files.', args: 'path, query, file_pattern, case_sensitive' },
  { name: 'read_file', desc: 'Read a UTF-8 text file in the workspace.', args: 'path' },
  { name: 'read_files', desc: 'Read up to 50 workspace files.', args: 'paths' },
  { name: 'read_file_lines', desc: 'Read a bounded line range from a workspace file.', args: 'path, start_line, end_line' },
  { name: 'get_file_info', desc: 'Get size, type, extension, and modification time for a workspace path.', args: 'path' },
  { name: 'get_file_outline', desc: 'List class and function declarations from a source file.', args: 'path' },
  { name: 'create_file', desc: 'Create a new file without overwriting an existing file.', args: 'path, content' },
  { name: 'write_file', desc: 'Write or replace a UTF-8 text file inside the workspace.', args: 'path, content' },
  { name: 'edit_file', desc: 'Replace an exact text snippet; by default the snippet must be unique.', args: 'path, old_text, new_text, replace_all' },
  { name: 'create_directory', desc: 'Create a directory inside the workspace.', args: 'path' },
  { name: 'move_file', desc: 'Move a file inside the workspace without overwriting a destination.', args: 'source, destination' },
  { name: 'copy_file', desc: 'Copy a file inside the workspace without overwriting a destination.', args: 'source, destination' },
  { name: 'git_status', desc: 'Show the current Git branch and working-tree status.', args: '' },
  { name: 'git_diff', desc: 'Show unstaged Git changes, optionally for one workspace path.', args: 'path' },
  { name: 'git_log', desc: 'Show recent Git commits.', args: 'limit' },
  { name: 'git_branches', desc: 'List local Git branches.', args: '' },
  { name: 'run_command', desc: 'Run a command with the workspace as its working directory.', args: 'command, args' },
  { name: 'run_project_script', desc: 'Run a named safe script (build, check, format, lint, test, typecheck) from package.json.', args: 'script' },
  { name: 'run_tests', desc: 'Run the workspace test script, pytest, or .NET tests when configured.', args: '' },
  { name: 'delete_file', desc: 'Delete one file inside the workspace; directories, the workspace root, and .git are refused.', args: 'path' },
  { name: 'apply_patch', desc: 'Apply several exact text replacements to one file.', args: 'path, edits' },
  { name: 'git_add', desc: 'Stage specific workspace paths; staging the whole workspace is refused.', args: 'paths' },
  { name: 'git_commit', desc: 'Commit the currently staged changes with a message.', args: 'message' },
];

export function buildSnapgentPrompt(tools: typeof SNAPGENT_TOOLS = SNAPGENT_TOOLS): string {
  const toolList = tools
    .map((t) => `  ${t.name}(${t.args}) - ${t.desc}`)
    .join('\n');

  return `\n\n# snapgentV3 — VS Code Agent Mode

You are connected to the user's VS Code workspace through snapgentV3. You can read, write, and edit files, run commands, and manage Git — all through snapgentV3 commands.

## How to call tools

When you need to use a tool, output a SINGLE command as a JSON object in plain text, exactly like this:

{"command": "tool_name", "params": {"key": "value"}}

Rules:
- ONE command per reply. Wait for the result before sending the next.
- The JSON must be a single valid object. You may add a short note before or after it.
- Use "command" as the key (not "tool", "toolName", "name", or "action").
- Put all arguments inside "params".
- After the command runs, you will receive the result as "Output of 'tool_name':" — read it and continue.

## Available tools

${toolList}

## Tips

- Start with \`get_workspace_info\` to understand the project.
- Use \`list_dir\` or \`list_tree\` to explore the file structure.
- Use \`search_files\` to find code by content.
- Use \`read_file\` to read a file before editing it.
- Use \`write_file\` to create or replace files.
- Use \`edit_file\` for surgical replacements (old_text → new_text).
- Use \`run_command\` to run shell commands (npm, python, git, etc.).
- Use \`git_status\` and \`git_diff\` before committing.
- After all changes, summarize what you did.`;
}

/**
 * Extract snapgent commands from AI text output.
 * Finds `{"command": "...", "params": {...}}` JSON objects.
 * Uses balanced-brace scanning (handles nested objects in params).
 */
export function extractSnapgentCommand(text: string): { command: string; params: Record<string, unknown> } | null {
  // Quick check: does the text contain a command key?
  if (!/"command"\s*:\s*"/.test(text) && !/"tool"\s*:\s*"/.test(text)) return null;

  // Try strict parse first (entire trimmed text is the JSON)
  try {
    const trimmed = text.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      const parsed = JSON.parse(trimmed);
      const name = parsed.command || parsed.tool;
      if (name && typeof name === 'string') {
        return { command: name, params: parsed.params || parsed.arguments || parsed.args || {} };
      }
    }
  } catch { /* */ }

  // Balanced-brace scan
  let i = 0;
  while (i < text.length) {
    if (text[i] !== '{') { i++; continue; }
    let depth = 0;
    let inStr = false;
    let escape = false;
    let j = i;
    for (; j < text.length; j++) {
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
            try {
              const parsed = JSON.parse(json);
              if (parsed && typeof parsed === 'object' && typeof (parsed.command || parsed.tool) === 'string') {
                return {
                  command: parsed.command || parsed.tool,
                  params: parsed.params || parsed.arguments || parsed.args || {},
                };
              }
            } catch { /* */ }
            break;
          }
        }
      }
    }
    i++;
  }
  return null;
}

/**
 * Strip the snapgent command JSON from visible text (so the user sees
 * prose + a tool card, not raw JSON).
 */
export function stripSnapgentCommand(text: string): { visible: string; command: string; params: Record<string, unknown> } | null {
  const cmd = extractSnapgentCommand(text);
  if (!cmd) return null;

  // Find and remove the JSON block from the text
  let visible = text;
  try {
    const trimmed = text.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      visible = '';
    } else {
      // Find the JSON block and remove it
      const jsonStr = JSON.stringify(cmd);
      const idx = text.indexOf(jsonStr);
      if (idx >= 0) {
        visible = (text.slice(0, idx) + text.slice(idx + jsonStr.length)).trim();
      } else {
        // Fallback: find the { that starts the command
        let i = 0;
        while (i < text.length) {
          if (text[i] === '{') {
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
                    visible = (text.slice(0, i) + text.slice(j + 1)).trim();
                    break;
                  }
                }
              }
            }
            break;
          }
          i++;
        }
      }
    }
  } catch { /* */ }
  return { visible, command: cmd.command, params: cmd.params };
}
