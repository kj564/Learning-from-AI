#!/bin/bash
# pjr-deep-scrape.sh — deep scrape pelajarin.ai: full DOM tree + computed styles + network + all JS.
set -u
cd /home/z/my-project
EMAIL="levog98645@dsmspaces.com"; PASS="CWjw!fiY-UP3gq5"
NOTE_URL="https://app.pelajarin.ai/lesson/2c6a9c02-d6cf-4532-a84a-af05076e6aa2"
mkdir -p /tmp/pjr-deep/dom /tmp/pjr-deep/styles /tmp/pjr-deep/network /tmp/pjr-deep/js

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
cat > /tmp/pjr-deep-all.ts <<'SCRIPT'
const SESSION = process.env.SESSION!, SIG = process.env.SIG!, CSRF = process.env.CSRF!, WS = process.env.WS!, NOTE_URL = process.env.NOTE_URL!;
const ws = new WebSocket(WS);
let id = 0; const p = new Map();
function send(m: string, pr: any = {}) { return new Promise<any>((r) => { const i = ++id; p.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: pr })); }); }
ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data as string); if (m.id && p.has(m.id)) { p.get(m.id)!(m); p.delete(m.id); } });
ws.addEventListener('open', async () => {
  await send('Network.enable'); await send('Page.enable'); await send('Runtime.enable'); await send('DOM.enable');
  for (const [name, value] of [['_session', SESSION], ['_session.sig', SIG], ['auth_csrf', CSRF]]) {
    await send('Network.setCookie', { name, value, domain: 'auth.pelajarin.ai', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' });
  }
  console.log('cookies injected');

  // Collect network requests
  const networkRequests: any[] = [];
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data as string);
    if (m.method === 'Network.requestWillBeSent' && m.params?.request?.url?.includes('api.pelajarin.ai')) {
      networkRequests.push({ url: m.params.request.url, method: m.params.request.method, headers: m.params.request.headers });
    }
  });

  const tabs = ['belajar', 'catatan', 'mindmap', 'kuis', 'flashcard', 'sumber', 'chat', 'podcast', 'tempel'];
  for (const tab of tabs) {
    const url = `${NOTE_URL}?tab=${tab}`;
    console.log(`=== ${tab} ===`);
    networkRequests.length = 0;
    await send('Page.navigate', { url });
    await new Promise(r => setTimeout(r, 10000));
    // Dismiss onboarding
    await send('Runtime.evaluate', { expression: '[...document.querySelectorAll("button")].find(b => /next|skip|close|got it|lanjut|mulai|continue/i.test(b.textContent||""))?.click()' });
    await new Promise(r => setTimeout(r, 2000));
    await send('Runtime.evaluate', { expression: '[...document.querySelectorAll("button")].find(b => /next|skip|close|got it|lanjut|mulai|continue/i.test(b.textContent||""))?.click()' });
    await new Promise(r => setTimeout(r, 2000));

    // Capture deep DOM tree — walk every element in main content + get computed styles
    const domResult = await send('Runtime.evaluate', { expression: `(() => {
      const main = document.querySelector('main') || document.body;
      function walk(el, depth = 0) {
        if (depth > 8) return null;
        const cs = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const node = {
          tag: el.tagName.toLowerCase(),
          class: el.className?.toString?.()?.slice(0, 200) || '',
          text: (el.directText || el.textContent || '').trim().slice(0, 100),
          rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
          styles: {
            display: cs.display, position: cs.position, background: cs.backgroundColor?.slice(0, 80),
            color: cs.color, borderRadius: cs.borderRadius, padding: cs.padding, gap: cs.gap,
            fontSize: cs.fontSize, fontWeight: cs.fontWeight, fontFamily: cs.fontFamily?.slice(0, 80),
            border: cs.border?.slice(0, 80), boxShadow: cs.boxShadow?.slice(0, 80),
            gridTemplateColumns: cs.gridTemplateColumns, flex: cs.flex, flexDirection: cs.flexDirection,
            alignItems: cs.alignItems, justifyContent: cs.justifyContent, width: cs.width, height: cs.height,
          },
          attrs: {},
          children: [] as any[],
        };
        // Key attributes
        for (const a of ['href', 'src', 'alt', 'aria-label', 'data-tab', 'data-chapter', 'data-dot', 'data-journey-path', 'type', 'placeholder', 'role', 'value']) {
          if (el.getAttribute(a)) (node.attrs as any)[a] = el.getAttribute(a);
        }
        // Direct text only
        const directText = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(' ').slice(0, 100);
        if (directText) node.text = directText;
        // Walk children
        for (const child of el.children) {
          const childNode = walk(child, depth + 1);
          if (childNode) (node.children as any[]).push(childNode);
        }
        return node;
      }
      return JSON.stringify(walk(main));
    })()`, returnByValue: true, awaitPromise: true });
    await Bun.write(`/tmp/pjr-deep/dom/tab-${tab}.json`, domResult.result?.result?.value || '{}');
    console.log(`  DOM tree saved`);

    // Capture network requests for this tab
    await Bun.write(`/tmp/pjr-deep/network/tab-${tab}.json`, JSON.stringify(networkRequests, null, 2));
    console.log(`  network: ${networkRequests.length} API calls`);
  }

  // Download ALL JS bundles
  const jsUrls = new Set<string>();
  for (const tab of tabs) {
    const url = `${NOTE_URL}?tab=${tab}`;
    await send('Page.navigate', { url });
    await new Promise(r => setTimeout(r, 5000));
    const r = await send('Runtime.evaluate', { expression: '[...document.querySelectorAll("script[src], link[rel=modulepreload]")].map(e => e.src || e.href).join("\\n")', returnByValue: true });
    (r.result?.result?.value || '').split('\n').filter(Boolean).forEach((u: string) => jsUrls.add(u));
  }
  console.log(`\n=== downloading ${jsUrls.size} JS bundles ===`);
  let dl = 0;
  for (const url of jsUrls) {
    try {
      const name = new URL(url).pathname.split('/').pop() || 'script.js';
      const r = await fetch(url);
      if (r.ok) { await Bun.write(`/tmp/pjr-deep/js/${name}`, await r.arrayBuffer()); dl++; }
    } catch {}
  }
  console.log(`downloaded ${dl} JS bundles`);

  ws.close(); process.exit(0);
});
ws.addEventListener('error', (e: any) => { console.error('err', e.message); process.exit(1); });
SCRIPT
timeout 300 bun /tmp/pjr-deep-all.ts 2>&1 | tail -25
echo "=== DEEP SCRAPE FILES ==="
echo "--- DOM trees ---"
ls -la /tmp/pjr-deep/dom/ 2>/dev/null | head -12
echo "--- Network ---"
ls -la /tmp/pjr-deep/network/ 2>/dev/null
echo "--- JS ---"
ls /tmp/pjr-deep/js/ 2>/dev/null | wc -l
du -sh /tmp/pjr-deep/js/ 2>/dev/null
