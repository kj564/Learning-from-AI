#!/bin/bash
# pjr-auth-capture.sh — login + inject cookies + capture authenticated dashboard.
# All in one process so Chrome stays alive.
set -u
cd /home/z/my-project
EMAIL="levog98645@dsmspaces.com"
PASS="CWjw!fiY-UP3gq5"

echo "=== 1. Fresh login ==="
rm -f /tmp/pjr-auth.txt
curl -s --max-time 10 -c /tmp/pjr-auth.txt -o /dev/null "https://auth.pelajarin.ai/" 2>&1
curl -s --max-time 15 -b /tmp/pjr-auth.txt -c /tmp/pjr-auth.txt \
  -X POST "https://auth.pelajarin.ai/api/auth/login" \
  -H "Content-Type: application/json" -H "X-Requested-With: XMLHttpRequest" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" 2>&1 | head -c 150
echo ""
# Trigger OIDC to get _session cookie
curl -sL --max-time 15 -b /tmp/pjr-auth.txt -c /tmp/pjr-auth.txt -o /dev/null "https://app.pelajarin.ai/auth/signin" 2>&1
SESSION=$(awk -F'\t' '$6=="_session"{print $7}' /tmp/pjr-auth.txt 2>/dev/null | head -1)
SIG=$(awk -F'\t' '$6=="_session.sig"{print $7}' /tmp/pjr-auth.txt 2>/dev/null | head -1)
CSRF=$(awk -F'\t' '$6=="auth_csrf"{print $7}' /tmp/pjr-auth.txt 2>/dev/null | head -1)
echo "session: ${SESSION:0:20}... sig: ${SIG:0:20}..."

echo "=== 2. Launch Chrome ==="
pkill -f "remote-debugging-port=9222" 2>/dev/null; sleep 1
setsid bash -c 'exec /home/z/.cache/ms-playwright/chromium_headless_shell-1200/chrome-headless-shell-linux64/chrome-headless-shell --headless --remote-debugging-port=9222 --no-sandbox --disable-gpu --disable-dev-shm-usage --window-size=1280,800 https://auth.pelajarin.ai/' < /dev/null > /tmp/chrome-cdp.log 2>&1 &
disown
sleep 8
curl -s --max-time 5 http://127.0.0.1:9222/json/list > /tmp/targets.json 2>&1
WS=$(bun -e "const j=require('/tmp/targets.json');const t=j.find(x=>x.type==='page');console.log(t?.webSocketDebuggerUrl||'')" 2>&1 | tail -1)
echo "WS: ${WS:0:60}"

echo "=== 3. Inject cookies + navigate + capture ==="
export SESSION SIG CSRF WS
cat > /tmp/pjr-capture.ts <<'SCRIPT'
const SESSION = process.env.SESSION!;
const SIG = process.env.SIG!;
const CSRF = process.env.CSRF!;
const WS = process.env.WS!;
const ws = new WebSocket(WS);
let id = 0; const p = new Map();
function send(m: string, pr: any = {}) { return new Promise<any>((r) => { const i = ++id; p.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: pr })); }); }
ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data as string); if (m.id && p.has(m.id)) { p.get(m.id)!(m); p.delete(m.id); } });
ws.addEventListener('open', async () => {
  await send('Network.enable');
  await send('Page.enable');
  await send('Runtime.enable');
  for (const [name, value] of [['_session', SESSION], ['_session.sig', SIG], ['auth_csrf', CSRF]]) {
    await send('Network.setCookie', { name, value, domain: 'auth.pelajarin.ai', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' });
  }
  console.log('cookies injected');
  await send('Page.navigate', { url: 'https://app.pelajarin.ai/auth/signin' });
  await new Promise(r => setTimeout(r, 20000));
  const r = await send('Runtime.evaluate', { expression: 'document.title+"|||"+location.href+"|||"+document.body.textContent.slice(0,300)', returnByValue: true });
  console.log('AFTER NAV:', r.result?.result?.value || 'no result');
  // Screenshot
  await send('Page.captureScreenshot', { format: 'png' }).then((shot: any) => {
    Bun.write('/tmp/pjr-dashboard-auth.png', Buffer.from(shot.result.data, 'base64'));
    console.log('saved screenshot');
  });
  // Full HTML
  const html = await send('Runtime.evaluate', { expression: 'document.documentElement.outerHTML', returnByValue: true });
  await Bun.write('/tmp/pjr-dashboard-auth.html', html.result?.result?.value || '');
  console.log('saved HTML:', (html.result?.result?.value || '').length, 'chars');
  ws.close(); process.exit(0);
});
ws.addEventListener('error', (e: any) => { console.error('err', e.message); process.exit(1); });
SCRIPT
timeout 50 bun /tmp/pjr-capture.ts 2>&1 | tail -8
echo "=== DONE ==="
