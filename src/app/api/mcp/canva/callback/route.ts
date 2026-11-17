/**
 * Canva MCP OAuth callback handler
 * Canva redirects here with ?code=xxx&state=xxx
 * This route is handled by the parent /api/mcp/canva route.ts GET handler.
 */
export { GET, POST } from '../route';
