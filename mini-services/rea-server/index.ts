/**
 * REA MCP Server — runs rea-agents as HTTP MCP server on port 9849.
 * Auto-restarts on file changes (--hot).
 */
import { spawn } from 'child_process';

const PORT = 9849;
const child = spawn('npx', ['rea-agents@latest', 'mcp', '--http', `--port=${PORT}`], {
  stdio: 'inherit',
  cwd: process.cwd(),
});

child.on('exit', (code) => {
  console.log(`REA MCP server exited with code ${code}`);
  process.exit(code || 0);
});

process.on('SIGTERM', () => { child.kill('SIGTERM'); process.exit(0); });
process.on('SIGINT', () => { child.kill('SIGINT'); process.exit(0); });
