#!/bin/bash
# pjr-rip.sh — rip HTML + JS + CSS dari setiap tab terautentikasi.
set -u
cd /home/z/my-project
EMAIL="levog98645@dsmspaces.com"; PASS="CWjw!fiY-UP3gq5"
NOTE_URL="https://app.pelajarin.ai/lesson/2c6a9c02-d6cf-4532-a84a-af05076e6aa2"
mkdir -p /tmp/pjr-rip/html /tmp/pjr-rip/js /tmp/pjr-rip/css

echo "=== 1. LOGIN ==="
rm -f /tmp/pjr-auth.txt
curl -s --max-time 10 -c /tmp/pjr-auth.txt -o /dev/null "https://auth.pelajarin.ai/" 2>&1
curl -s --max-time 15 -b /tmp/pjr-auth.txt -c /tmp/pjr-auth.txt -X POST "https://auth.pelajarin.ai/api/auth/login" -H "Content-Type: application/json" -H "X-Requested-With: XMLHttpRequest" -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" > /dev/null 2>&1
curl -sL --max-time 15 -b /tmp/pjr-auth.txt -c /tmp/pjr-auth.txt -o /dev/null "https://app.pelajarin.ai/auth/signin" 2>&1
SESSION=$(awk -F'\t' '$6=="_session"{print $7}' /tmp/pjr-auth.txt 2>/dev/null | head -1)
SIG=$(awk -F'\t' '$6=="_session.sig"{print $7}' /tmp/pjr-auth.txt 2>/dev/null | head -1)
CSRF=$(awk -F'\t' '$6=="auth_csrf"{print $7}' /tmp/pjr-auth.txt 2>/dev/null | head -1)
echo "session: ${SESSION:0:20}..."

echo "=== 2. CHROME ==="
pkill -f "remote-debugging-port=9222" 2>/dev/null; sleep 1
setsid bash -c 'exec /home/z/.cache/ms-playwright/chromium_headless_shell-1200/chrome-headless-shell-linux64/chrome-headless-shell --headless --remote-debugging-port=9222 --no-sandbox --disable-gpu --disable-dev-shm-usage --window-size=1280,800 https://auth.pelajarin.ai/' < /dev/null > /tmp/chrome-cdp.log 2>&1 &
disown
sleep 8
curl -s --max-time 5 http://127.0.0.1:9222/json/list > /tmp/targets.json 2>&1
WS=$(bun -e "const j=require('/tmp/targets.json');const t=j.find(x=>x.type==='page');console.log(t?.webSocketDebuggerUrl||'')" 2>&1 | tail -1)
echo "WS: ${WS:0:60}"

export SESSION SIG CSRF WS NOTE_URL
cat > /tmp/pjr-rip-all.ts <<'SCRIPT'
const SESSION = process.env.SESSION!, SIG = process.env.SIG!, CSRF = process.env.CSRF!, WS = process.env.WS!, NOTE_URL = process.env.NOTE_URL!;
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

  // Capture dashboard first
  await send('Page.navigate', { url: 'https://app.pelajarin.ai/auth/signin' });
  await new Promise(r => setTimeout(r, 15000));
  let r = await send('Runtime.evaluate', { expression: 'location.href', returnByValue: true });
  console.log('dashboard url:', r.result?.result?.value);

  // Save dashboard HTML
  r = await send('Runtime.evaluate', { expression: 'document.documentElement.outerHTML', returnByValue: true });
  await Bun.write('/tmp/pjr-rip/html/dashboard.html', r.result?.result?.value || '');
  console.log('dashboard HTML saved:', (r.result?.result?.value || '').length, 'chars');

  // Collect ALL script + CSS URLs from dashboard
  r = await send('Runtime.evaluate', { expression: `(() => {
    const scripts = [...document.querySelectorAll('script[src]')].map(s => s.src);
    const styles = [...document.querySelectorAll('link[rel=stylesheet]')].map(l => l.href);
    const modules = [...document.querySelectorAll('link[rel=modulepreload]')].map(l => l.href);
    return JSON.stringify({scripts, styles, modules});
  })()`, returnByValue: true });
  const urls = JSON.parse(r.result?.result?.value || '{}');
  console.log('dashboard scripts:', urls.scripts?.length, 'styles:', urls.styles?.length, 'modules:', urls.modules?.length);

  // Navigate to each tab and capture HTML
  const tabs = ['belajar', 'catatan', 'mindmap', 'kuis', 'flashcard', 'sumber', 'chat', 'podcast', 'tempel'];
  const allJsUrls = new Set<string>();
  const allCssUrls = new Set<string>();

  for (const tab of tabs) {
    const url = `${NOTE_URL}?tab=${tab}`;
    console.log(`=== ${tab} ===`);
    await send('Page.navigate', { url });
    await new Promise(r => setTimeout(r, 8000));

    // Dismiss onboarding modal
    await send('Runtime.evaluate', { expression: '[...document.querySelectorAll("button")].find(b => /next|skip|close|got it|lanjut|mulai|continue/i.test(b.textContent||""))?.click()', returnByValue: true });
    await new Promise(r => setTimeout(r, 1500));
    await send('Runtime.evaluate', { expression: '[...document.querySelectorAll("button")].find(b => /next|skip|close|got it|lanjut|mulai|continue/i.test(b.textContent||""))?.click()', returnByValue: true });
    await new Promise(r => setTimeout(r, 1500));

    // Save full HTML
    r = await send('Runtime.evaluate', { expression: 'document.documentElement.outerHTML', returnByValue: true });
    await Bun.write(`/tmp/pjr-rip/html/tab-${tab}.html`, r.result?.result?.value || '');
    console.log(`  HTML: ${(r.result?.result?.value || '').length} chars`);

    // Collect all JS + CSS URLs
    r = await send('Runtime.evaluate', { expression: `(() => {
      const scripts = [...document.querySelectorAll('script[src]')].map(s => s.src);
      const styles = [...document.querySelectorAll('link[rel=stylesheet]')].map(l => l.href);
      const modules = [...document.querySelectorAll('link[rel=modulepreload]')].map(l => l.href);
      return JSON.stringify({scripts, styles, modules});
    })()`, returnByValue: true });
    const tu = JSON.parse(r.result?.result?.value || '{}');
    tu.scripts?.forEach((u: string) => allJsUrls.add(u));
    tu.styles?.forEach((u: string) => allCssUrls.add(u));
    tu.modules?.forEach((u: string) => allJsUrls.add(u));
    console.log(`  scripts: ${tu.scripts?.length} styles: ${tu.styles?.length} modules: ${tu.modules?.length}`);
  }

  console.log(`\n=== UNIQUE JS: ${allJsUrls.size} CSS: ${allCssUrls.size} ===`);

  // Download all JS bundles
  let dlCount = 0;
  for (const url of allJsUrls) {
    try {
      const u = new URL(url);
      const name = u.pathname.split('/').pop() || 'script.js';
      const r = await fetch(url);
      if (r.ok) {
        const buf = await r.arrayBuffer();
        await Bun.write(`/tmp/pjr-rip/js/${name}`, buf);
        dlCount++;
      }
    } catch {}
  }
  console.log(`downloaded ${dlCount} JS bundles`);

  // Download all CSS
  for (const url of allCssUrls) {
    try {
      const u = new URL(url);
      const name = u.pathname.split('/').pop() || 'style.css';
      const r = await fetch(url);
      if (r.ok) {
        const buf = await r.arrayBuffer();
        await Bun.write(`/tmp/pjr-rip/css/${name}`, buf);
      }
    } catch {}
  }
  console.log(`downloaded CSS files`);

  // Save URL lists
  await Bun.write('/tmp/pjr-rip/js-urls.json', JSON.stringify([...allJsUrls], null, 2));
  await Bun.write('/tmp/pjr-rip/css-urls.json', JSON.stringify([...allCssUrls], null, 2));

  ws.close(); process.exit(0);
});
ws.addEventListener('error', (e: any) => { console.error('err', e.message); process.exit(1); });
SCRIPT
timeout 200 bun /tmp/pjr-rip-all.ts 2>&1 | tail -30
echo "=== CAPTURED FILES ==="
echo "--- HTML ---"
ls -la /tmp/pjr-rip/html/ 2>/dev/null
echo "--- JS ---"
ls /tmp/pjr-rip/js/ 2>/dev/null | wc -l
du -sh /tmp/pjr-rip/js/ 2>/dev/null
echo "--- CSS ---"
ls /tmp/pjr-rip/css/ 2>/dev/null | wc -l
du -sh /tmp/pjr-rip/css/ 2>/dev/null
