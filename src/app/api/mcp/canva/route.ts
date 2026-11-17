/**
 * Canva MCP OAuth + Proxy
 *
 * Flow:
 *   1. GET /api/mcp/canva → redirect ke Canva authorize
 *   2. GET /api/mcp/canva/callback → exchange code → access_token
 *   3. POST /api/mcp/canva/mcp → proxy ke Canva MCP dengan Bearer token
 *
 * Client registered dynamically at https://mcp.canva.com/register
 */

import { NextRequest, NextResponse } from 'next/server';

// Canva OAuth config (dari dynamic registration)
const CANVA_CLIENT_ID = 'BTc9BazYMGoTVmyZ';
const CANVA_CLIENT_SECRET = 'x4n8FR24jR6T82-IH9VvdvMGdEPUxuvz';
const CANVA_REDIRECT_URI = `${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/api/mcp/canva/callback`;
const CANVA_AUTH_URL = 'https://mcp.canva.com/authorize';
const CANVA_TOKEN_URL = 'https://mcp.canva.com/token';
const CANVA_MCP_URL = 'https://mcp.canva.com/mcp';
const CANVA_SCOPES = 'design:content:write design:content:read asset:read asset:write profile:read folder:read folder:write';

// In-memory token store (swap for DB/Prisma later)
let canvaToken: { access_token: string; refresh_token?: string; expires_at: number } | null = null;

// === GET: Start OAuth flow ===
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') || 'authorize';
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  if (action === 'status') {
    return NextResponse.json({
      connected: canvaToken !== null,
      expired: canvaToken ? canvaToken.expires_at < Date.now() : true,
    });
  }

  if (action === 'disconnect') {
    canvaToken = null;
    return NextResponse.json({ success: true, message: 'Canva disconnected' });
  }

  // OAuth callback: exchange code for token
  if (code) {
    try {
      const tokenRes = await fetch(CANVA_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: CANVA_REDIRECT_URI,
          client_id: CANVA_CLIENT_ID,
          client_secret: CANVA_CLIENT_SECRET,
        }),
      });
      const tokenData = await tokenRes.json();
      if (tokenData.access_token) {
        canvaToken = {
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_at: Date.now() + (tokenData.expires_in || 3600) * 1000,
        };
        return NextResponse.redirect(new URL('/?canva=connected', req.url));
      }
      return NextResponse.json({ error: 'Token exchange failed', details: tokenData }, { status: 400 });
    } catch (e) {
      return NextResponse.json({ error: 'Callback failed: ' + String(e) }, { status: 500 });
    }
  }

  // Start OAuth: redirect ke Canva authorize
  const authState = `canva_${Date.now()}`;
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CANVA_CLIENT_ID,
    redirect_uri: CANVA_REDIRECT_URI,
    scope: CANVA_SCOPES,
    state: authState,
  });
  return NextResponse.redirect(`${CANVA_AUTH_URL}?${params}`);
}

// === POST: Proxy MCP request ke Canva ===
export async function POST(req: NextRequest) {
  if (!canvaToken || canvaToken.expires_at < Date.now()) {
    // Try refresh
    if (canvaToken?.refresh_token) {
      try {
        const refreshRes = await fetch(CANVA_TOKEN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: canvaToken.refresh_token,
            client_id: CANVA_CLIENT_ID,
            client_secret: CANVA_CLIENT_SECRET,
          }),
        });
        const refreshData = await refreshRes.json();
        if (refreshData.access_token) {
          canvaToken = {
            access_token: refreshData.access_token,
            refresh_token: refreshData.refresh_token || canvaToken.refresh_token,
            expires_at: Date.now() + (refreshData.expires_in || 3600) * 1000,
          };
        }
      } catch { /* fall through to error */ }
    }
    if (!canvaToken || canvaToken.expires_at < Date.now()) {
      return NextResponse.json({
        jsonrpc: '2.0',
        error: { code: -32001, message: 'Canva not connected. Visit /api/mcp/canva to connect.' },
      }, { status: 401 });
    }
  }

  // Forward MCP request ke Canva
  try {
    const body = await req.text();
    const mcpRes = await fetch(CANVA_MCP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${canvaToken.access_token}`,
      },
      body,
    });
    const mcpData = await mcpRes.text();
    return new NextResponse(mcpData, {
      status: mcpRes.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return NextResponse.json({
      jsonrpc: '2.0',
      error: { code: -32603, message: 'MCP proxy error: ' + String(e) },
    }, { status: 500 });
  }
}
