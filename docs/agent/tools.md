# Tool Catalogue — GLM Orchestrator Agent

> Anthropic-standard tool definitions (`name`, `description`, `input_schema`) for the 9
> tools the GLM orchestrator can call. Schema style follows Claude Code's per-tool
> contract: one-line purpose, "Key rules" section, parameter table, gotchas, and
> worked examples where behaviour is non-obvious.
>
> The runtime that executes these tools lives in `src/app/api/tools/route.ts`. This file
> is the **spec** the model sees; the runtime is the **implementation**. They must agree.

---

## Permission tiers

Every tool carries a `permission` field the safety layer consults before execution:

| Tier | Meaning | Examples | Approval |
|---|---|---|---|
| `read` | No side effects. Safe to call freely. | `web_search`, `read_url`, `list_files`, `search_knowledge_base`, `read_file`, `recall_memory` | auto |
| `write` | Modifies workspace state (files, memory, sandbox). Reversible. | `write_file`, `run_code_sandbox`, `create_note` | auto (logged) |
| `dangerous` | External or irreversible real-world action. | `send_email_with_approval` | **requires explicit user confirmation** |

`dangerous` tools are named with a `_with_approval` suffix as a defence-in-depth reminder
to the model. The runtime still gates them regardless of what the model calls them.

---

## Read tools

### `web_search`

**Purpose.** Search the public web for current information. Use for facts, news, prices,
regulations, or anything that changes after the model's training cutoff. Do **not** use
for private user data, internal workspace files, or anything `search_knowledge_base`
already indexes.

**Key rules.**
- Returns up to `max_results` result blocks, each with `url`, `name`, `snippet`.
- The model's knowledge may be stale — when in doubt, search.
- Always cite sources in your final reply. A claim without a source is a guess.
- Append a "Sources:" list with markdown hyperlinks to any reply that quotes search
  results. MANDATORY. Never skip.

**Schema.**
```json
{
  "type": "object",
  "properties": {
    "query":        { "type": "string",  "description": "Search query. Use English for best recall; Indonesian is supported." },
    "max_results":  { "type": "integer", "default": 5, "minimum": 1, "maximum": 10 }
  },
  "required": ["query"]
}
```

**Example.**
```json
{"tool":"web_search","args":{"query":"GLM-4.6 release date","max_results":5}}
```

---

### `read_url`

**Purpose.** Fetch and read the full content of a single web page. Use after `web_search`
to drill into a specific result, or when the user gives you a URL directly.

**Key rules.**
- HTML is converted to readable text/markdown before return.
- Read-only; no side effects.
- If the page is huge, prefer `web_search` first to find the right page, then `read_url`
  on a specific section anchor when possible.
- For pages behind login or paywalls, the tool will return an error — don't retry; tell
  the user.
- HTTP is auto-upgraded to HTTPS.

**Schema.**
```json
{
  "type": "object",
  "properties": {
    "url": { "type": "string", "description": "Fully-qualified URL, including scheme." }
  },
  "required": ["url"]
}
```

**Example.**
```json
{"tool":"read_url","args":{"url":"https://example.com/blog/introducing-glm"}}
```

---

### `list_files`

**Purpose.** List entries in a workspace directory. Use before modifying directory
structure, to verify a path exists, or to enumerate the contents of a folder.

**Key rules.**
- `path` defaults to `.` (the workspace root). Returns entry names with type
  (`file` / `dir`).
- `path` must be relative. Absolute paths and `..` segments are rejected.
- `workspaceId` is required — every list operation is scoped to exactly one
  workspace.
- Read-only; no side effects.

**Schema.**
```json
{
  "type": "object",
  "properties": {
    "workspaceId": { "type": "string", "description": "The workspace to operate in. If omitted, the conversation's active workspace is used." },
    "path":        { "type": "string", "default": ".", "description": "Relative directory path from workspace root. Defaults to the workspace root ('.')." }
  },
  "required": ["workspaceId"]
}
```

**Example.**
```json
{"tool":"list_files","args":{"workspaceId":"ws_abc123","path":"src/lib"}}
```

---

### `search_knowledge_base`

**Purpose.** Search the workspace knowledge base — documents the user has uploaded to
this project. Use **before** answering questions about uploaded files, project docs, or
anything that smells like "the user already gave me this".

**Key rules.**
- Ranking is lexical (BM25-style) over chunks. `top_k` controls how many chunks return.
- Always prefer this over `web_search` for content the user has already provided.
- If zero results, don't assume the doc doesn't exist — try one synonym query before
  giving up.

**Schema.**
```json
{
  "type": "object",
  "properties": {
    "query":  { "type": "string",  "description": "Natural-language query. Match the doc's vocabulary." },
    "top_k":  { "type": "integer", "default": 4, "minimum": 1, "maximum": 10 }
  },
  "required": ["query"]
}
```

**Example.**
```json
{"tool":"search_knowledge_base","args":{"query":"refund policy for digital goods","top_k":4}}
```

---

### `read_file`

**Purpose.** Read a UTF-8 text file from the workspace. The workspace root is
`/home/z/my-project`; paths are relative to it.

**Key rules.**
- `path` must be relative. Absolute paths and `..` segments are rejected (path-traversal
  guard).
- If the file doesn't exist, you get a 404 — that's a signal, not an error to retry.
- Reading a directory returns an error; use `list_files` instead.
- You **must** `read_file` a file before `write_file` or `edit_file` on it. The runtime
  doesn't enforce this, but the system prompt does. Editing a file you haven't read is a
  bug.

**Schema.**
```json
{
  "type": "object",
  "properties": {
    "workspaceId": { "type": "string", "description": "The workspace to operate in. If omitted, the conversation's active workspace is used." },
    "path":        { "type": "string", "description": "Relative file path from workspace root." }
  },
  "required": ["path"]
}
```

**Example.**
```json
{"tool":"read_file","args":{"path":"src/lib/agent-tools.ts"}}
```

---

## Write tools

### `write_file`

**Purpose.** Write or replace a file in the workspace. Creates parent directories
automatically.

**Key rules.**
- `path` must be relative to the workspace root. Absolute paths and `..` segments are
  rejected (path-traversal guard).
- Overwrites the existing file if one exists at the path. There is no append mode — to
  append, `read_file` first and write back the concatenation.
- Prefer `edit_file` (when available) for small changes — it sends only the diff. Use
  `write_file` for new files or complete rewrites.
- **NEVER create documentation files (`.md`) or README files unless the user explicitly
  asks.** This is the highest-noise action available to you.
- No emojis unless explicitly requested.
- If your write will create new directories, the runtime creates them; you don't need a
  separate `mkdir` call.

**Schema.**
```json
{
  "type": "object",
  "properties": {
    "workspaceId": { "type": "string", "description": "The workspace to operate in. If omitted, the conversation's active workspace is used." },
    "path":        { "type": "string", "description": "Relative file path. Absolute paths and `..` segments are rejected." },
    "content": { "type": "string", "description": "Full file content. Existing content is replaced." }
  },
  "required": ["path", "content"]
}
```

**Example.**
```json
{"tool":"write_file","args":{"path":"src/lib/new-helper.ts","content":"export const hello = () => 'hi';\n"}}
```

---

### `run_code_sandbox`

**Purpose.** Execute code in an isolated sandbox. Supports JavaScript, TypeScript,
Python, and Bash. Use to verify a snippet works, compute something, inspect data, or
run a quick script.

**Key rules.**
- 10-second timeout per call. Long-running code is killed.
- The sandbox is isolated: no network access to internal services, no write access to
  the workspace root, no `process.env` exfiltration. (See `safety_rules.md` §3.)
- For workspace build/test/lint/git, prefer `run_shell` (not in the core 8 but available).
  Use `run_code_sandbox` only for code you'd otherwise paste into a REPL.
- Output is truncated at 1 MB. If your script produces huge output, write it to a temp
  file and `read_file` it back in chunks.
- Don't run code that wasn't asked for. "While I'm here, let me just…" is a bug.

**Schema.**
```json
{
  "type": "object",
  "properties": {
    "workspaceId": { "type": "string", "description": "The workspace to operate in. If omitted, the conversation's active workspace is used." },
    "code":        { "type": "string", "description": "Code to execute." },
    "language": { "type": "string", "enum": ["javascript","typescript","python","bash"], "default": "javascript" }
  },
  "required": ["code"]
}
```

**Example.**
```json
{"tool":"run_code_sandbox","args":{"language":"typescript","code":"console.log(2+2);"}}
```

---

## Memory tools

### `create_note`

**Purpose.** Save a note to persistent cross-session memory. Use for user preferences,
project decisions, recurring error patterns, or source URLs worth remembering.

**Key rules.**
- Categories are closed-set: `preference`, `decision`, `finding`, `error_pattern`,
  `source`. Pick the closest one; don't invent new categories.
- Don't memorize things you can re-derive (e.g. "the package.json has 312 dependencies").
- Don't memorize secrets. Never write API keys, tokens, passwords, or PII to memory.
- One note per fact. Don't bundle unrelated observations into a single note.
- Notes are searchable via `recall_memory`. Title them the way your future self would
  search: *"User prefers tabs over spaces"* beats *"coding style"*.

**Schema.**
```json
{
  "type": "object",
  "properties": {
    "workspaceId": { "type": "string", "description": "The workspace to operate in. If omitted, the conversation's active workspace is used." },
    "title":       { "type": "string", "description": "Short, searchable title." },
    "content":  { "type": "string", "description": "The fact or decision, in 1–3 sentences." },
    "category": { "type": "string", "enum": ["preference","decision","finding","error_pattern","source"] }
  },
  "required": ["title","content","category"]
}
```

**Example.**
```json
{"tool":"create_note","args":{"title":"User prefers tabs over spaces","content":"In all generated code, use tabs, not spaces.","category":"preference"}}
```

### `recall_memory` (companion, not in the core 9 but paired with `create_note`)

**Purpose.** Recall notes from persistent memory. Use at the start of a turn when the
user references past work, or when you suspect a stored preference applies.

**Schema.**
```json
{
  "type": "object",
  "properties": {
    "query": { "type": "string", "description": "What to recall." }
  },
  "required": ["query"]
}
```

---

## Dangerous tools

### `send_email_with_approval`

**Purpose.** Send an email on the user's behalf. Sends real bytes to real recipients —
this is the highest-blast-radius tool in the catalog.

**Key rules.**
- **Always requires explicit user confirmation.** The runtime will surface a
  confirmation prompt to the user with the full `to`, `subject`, and `body` before
  sending. The model never gets to skip this step.
- The model must present the draft email to the user in its reply *before* calling the
  tool, so the user can confirm or edit. Do not call the tool "speculatively" and let the
  prompt catch it — show the draft first.
- One recipient per call. For multiple recipients, call the tool once per recipient, or
  use a `cc`/`bcc` field if the runtime supports it (currently it does not — call
  sequentially).
- Don't send emails the user didn't ask for. Don't send marketing, bulk, or automated
  emails without an explicit instruction.
- Don't include attachments via this tool — it's plain-text only.
- Subject must be non-empty. Body must be non-empty. `to` must be a valid email
  address (basic syntax check).

**Schema.**
```json
{
  "type": "object",
  "properties": {
    "to":      { "type": "string", "description": "Recipient email address." },
    "subject": { "type": "string", "description": "Email subject. Non-empty." },
    "body":    { "type": "string", "description": "Email body, plain text. Non-empty." }
  },
  "required": ["to","subject","body"]
}
```

**Example.** (the reply that *precedes* the tool call)
```
I'll send this email. Here's the draft:

  To: alice@example.com
  Subject: Q3 roadmap review
  Body:
    Hi Alice, attached is the Q3 roadmap for your review.
    Could you confirm by Friday? Thanks, <user name>

Confirm and I'll send it.
```
…and then, after the user confirms:
```json
{"tool":"send_email_with_approval","args":{"to":"alice@example.com","subject":"Q3 roadmap review","body":"Hi Alice, …"}}
```

---

## Tool-set summary

| # | Tool | Permission | Tier purpose | workspaceId |
|---|---|---|---|---|
| 1 | `web_search` | read | external current facts | — |
| 2 | `read_url` | read | drill into one URL | — |
| 3 | `list_files` | read | list workspace contents | required |
| 4 | `search_knowledge_base` | read | user's uploaded docs | — |
| 5 | `read_file` | read | workspace file | optional |
| 6 | `write_file` | write | create/replace file | optional |
| 7 | `run_code_sandbox` | write | verify a snippet | optional |
| 8 | `create_note` | write | persistent memory | optional |
| 9 | `send_email_with_approval` | dangerous | real-world send (gated) | — |

`workspaceId` is auto-injected from the conversation's active workspace when omitted by
the model. `list_files` is the only tool that requires it explicitly.

Plus one paired read for memory: `recall_memory` (read tier, used with `create_note`).

> **Runtime extras** (not in the model's advertised 9, but available to the orchestrator
> if explicitly granted): `list_dir`, `edit_file`, `run_shell`. They follow the same
> schema style. See `src/lib/agent-tools.ts` for their definitions.
