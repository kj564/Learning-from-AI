#!/bin/bash
# pjr-tabs-capture.sh — capture all 9 authenticated tabs + download 3D island assets.
set -u
cd /home/z/my-project
EMAIL="levog98645@dsmspaces.com"; PASS="CWjw!fiY-UP3gq5"
NOTE_URL="https://app.pelajarin.ai/lesson/2c6a9c02-d6cf-4532-a84a-af05076e6aa2"
mkdir -p /tmp/pjr-capture /tmp/pjr-assets

echo "=== 1. LOGIN ==="
rm -f /tmp/pjr-auth.txt
curl -s --max-time 10 -c /tmp/pjr-auth.txt -o /dev/null "https://auth.pelajarin.ai/" 2>&1
curl -s --max-time 15 -b /tmp/pjr-auth.txt -c /tmp/pjr-auth.txt -X POST "https://auth.pelajarin.ai/api/auth/login" -H "Content-Type: application/json" -H "X-Requested-With: XMLHttpRequest" -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" > /dev/null 2>&1
curl -sL --max-time 15 -b /tmp/pjr-auth.txt -c /tmp/pjr-auth.txt -o /dev/null "https://app.pelajarin.ai/auth/signin" 2>&1
SESSION=$(awk -F'\t' '$6=="_session"{print $7}' /tmp/pjr-auth.txt 2>/dev/null | head -1)
SIG=$(awk -F'\t' '$6=="_session.sig"{print $7}' /tmp/pjr-auth.txt 2>/dev/null | head -1)
CSRF=$(awk -F'\t' '$6=="auth_csrf"{print $7}' /tmp/pjr-auth.txt 2>/dev/null | head -1)

echo "=== 2. CHROME ==="
pkill -f "remote-debugging-port=9222" 2>/dev/null; sleep 1
setsid bash -c 'exec /home/z/.cache/ms-playwright/chromium_headless_shell-1200/chrome-headless-shell-linux64/chrome-headless-shell --headless --remote-debugging-port=9222 --no-sandbox --disable-gpu --disable-dev-shm-usage --window-size=1280,800 https://auth.pelajarin.ai/' < /dev/null > /tmp/chrome-cdp.log 2>&1 &
disown
sleep 8
curl -s --max-time 5 http://127.0.0.1:9222/json/list > /tmp/targets.json 2>&1
WS=$(bun -e "const j=require('/tmp/targets.json');const t=j.find(x=>x.type==='page');console.log(t?.webSocketDebuggerUrl||'')" 2>&1 | tail -1)
echo "WS: ${WS:0:60}"

export SESSION SIG CSRF WS NOTE_URL
cat > /tmp/pjr-tabs.ts <<'SCRIPT'
const SESSION = process.env.SESSION!;
const SIG = process.env.SIG!;
const CSRF = process.env.CSRF!;
const WS = process.env.WS!;
const NOTE_URL = process.env.NOTE_URL!;
const ws = new WebSocket(WS);
let id = 0; const p = new Map();
function send(m: string, pr: any = {}) { return new Promise<any>((r) => { const i = ++id; p.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: pr })); }); }
ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data as string); if (m.id && p.has(m.id)) { p.get(m.id)!(m); p.delete(m.id); } });
ws.addEventListener('open', async () => {
  await send('Network.enable'); await send('Page.enable'); await send('Runtime.enable');
  for (const [name, value] of [['_session', SESSION], ['_session.sig', SIG], ['auth_csrf', CSRF]]) {
    await send('Network.setCookie', { name, value, domain: 'auth.pelajarin.ai', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' });
  }
  console.log('cookies injected');

  // Navigate to note detail with each tab
  const tabs = ['belajar', 'catatan', 'mindmap', 'kuis', 'flashcard', 'sumber', 'chat', 'podcast', 'tempel'];
  const allAssets = new Set<string>();

  for (const tab of tabs) {
    const url = `${NOTE_URL}?tab=${tab}`;
    console.log(`=== ${tab} ===`);
    await send('Page.navigate', { url });
    await new Promise(r => setTimeout(r, 8000));

    // Screenshot
    await send('Page.captureScreenshot', { format: 'png' }).then((s: any) =>
      Bun.write(`/tmp/pjr-capture/tab-${tab}-auth.png`, Buffer.from(s.result.data, 'base64')));
    console.log(`  screenshot saved`);

    // Capture URL + title + body text snippet
    let r = await send('Runtime.evaluate', { expression: 'location.href+"|||"+document.title+"|||"+document.body.textContent.slice(0,300)', returnByValue: true });
    console.log(`  content:`, r.result?.result?.value?.slice(0, 120));

    // Collect all asset URLs (images, CSS, fonts, background images)
    r = await send('Runtime.evaluate', { expression: `(() => {
      const urls = new Set();
      document.querySelectorAll('img[src]').forEach(i => urls.add(i.src));
      document.querySelectorAll('link[rel=stylesheet]').forEach(l => urls.add(l.href));
      document.querySelectorAll('link[rel=preload][as=font]').forEach(l => urls.add(l.href));
      document.querySelectorAll('source[src]').forEach(s => urls.add(s.src));
      document.querySelectorAll('*').forEach(e => {
        const bg = getComputedStyle(e).backgroundImage;
        if (bg && bg !== 'none') {
          const m = bg.matchAll(/url\\(["']?([^"')]+)["']?\\)/g);
          for (const match of m) {
            try { urls.add(new URL(match[1], location.href).href); } catch {}
          }
        }
      });
      return JSON.stringify([...urls]);
    })()`, returnByValue: true });
    const urls: string[] = JSON.parse(r.result?.result?.value || '[]');
    urls.forEach(u => allAssets.add(u));
    console.log(`  assets found: ${urls.length}`);
  }

  console.log(`\n=== TOTAL UNIQUE ASSETS: ${allAssets.size} ===`);

  // Download all assets
  let dlCount = 0;
  for (const url of allAssets) {
    if (url.startsWith('data:')) continue;
    try {
      const u = new URL(url);
      const name = u.pathname.split('/').pop() || 'asset';
      const ext = name.split('.').pop() || 'bin';
      const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 100) || `asset-${dlCount}.${ext}`;
      const r = await fetch(url);
      if (r.ok) {
        const buf = await r.arrayBuffer();
        await Bun.write(`/tmp/pjr-assets/${safeName}`, buf);
        dlCount++;
      }
    } catch {}
  }
  console.log(`downloaded ${dlCount} assets`);

  // Save asset list
  await Bun.write('/tmp/pjr-capture/asset-list.json', JSON.stringify([...allAssets], null, 2));

  ws.close(); process.exit(0);
});
ws.addEventListener('error', (e: any) => { console.error('err', e.message); process.exit(1); });
SCRIPT
timeout 180 bun /tmp/pjr-tabs.ts 2>&1 | tail -30
echo "=== CAPTURED ==="
ls -la /tmp/pjr-capture/ 2>/dev/null
echo "=== ASSETS ==="
ls /tmp/pjr-assets/ 2>/dev/null | wc -l
du -sh /tmp/pjr-assets/ 2>/dev/null