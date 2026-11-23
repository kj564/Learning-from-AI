#!/bin/bash
# pjr-full-capture.sh — login + capture ALL authenticated tabs + download assets.
set -u
cd /home/z/my-project
EMAIL="levog98645@dsmspaces.com"; PASS="CWjw!fiY-UP3gq5"
mkdir -p /tmp/pjr-capture

echo "=== 1. LOGIN ==="
rm -f /tmp/pjr-auth.txt
curl -s --max-time 10 -c /tmp/pjr-auth.txt -o /dev/null "https://auth.pelajarin.ai/" 2>&1
curl -s --max-time 15 -b /tmp/pjr-auth.txt -c /tmp/pjr-auth.txt -X POST "https://auth.pelajarin.ai/api/auth/login" -H "Content-Type: application/json" -H "X-Requested-With: XMLHttpRequest" -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" 2>&1 | head -c 80
echo ""
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

export SESSION SIG CSRF WS
cat > /tmp/pjr-full.ts <<'SCRIPT'
const SESSION = process.env.SESSION!;
const SIG = process.env.SIG!;
const CSRF = process.env.CSRF!;
const WS = process.env.WS!;
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

  // Navigate to dashboard
  await send('Page.navigate', { url: 'https://app.pelajarin.ai/auth/signin' });
  await new Promise(r => setTimeout(r, 15000));
  let r = await send('Runtime.evaluate', { expression: 'location.href', returnByValue: true });
  console.log('dashboard url:', r.result?.result?.value);

  // Screenshot dashboard
  await send('Page.captureScreenshot', { format: 'png' }).then((s: any) => Bun.write('/tmp/pjr-capture/dashboard.png', Buffer.from(s.result.data, 'base64')));
  console.log('dashboard screenshot saved');

  // Capture full dashboard HTML + all asset URLs
  r = await send('Runtime.evaluate', { expression: `(() => {
    const out = { html: document.documentElement.outerHTML.slice(0, 50000), title: document.title,
      stylesheets: [...document.querySelectorAll('link[rel=stylesheet]')].map(l => l.href),
      images: [...document.querySelectorAll('img[src]')].map(i => i.src),
      fonts: [...document.querySelectorAll('link[rel=preload][as=font]')].map(l => l.href),
      allLinks: [...document.querySelectorAll('link[href]')].map(l => ({rel:l.rel,href:l.href})),
      scripts: [...document.querySelectorAll('script[src]')].map(s => s.src),
    };
    return JSON.stringify(out);
  })()`, returnByValue: true });
  const dashInfo = JSON.parse(r.result?.result?.value || '{}');
  await Bun.write('/tmp/pjr-capture/dashboard-info.json', JSON.stringify(dashInfo, null, 2));
  console.log('dashboard info saved — stylesheets:', dashInfo.stylesheets?.length, 'images:', dashInfo.images?.length);

  // Find the note card + click into it
  r = await send('Runtime.evaluate', { expression: `(() => {
    const cards = [...document.querySelectorAll('a[href], button')].filter(e => /Pangan|Fotosintesis|note|catatan/i.test(e.textContent||''));
    return JSON.stringify(cards.slice(0,5).map(e => ({tag:e.tagName, text:(e.textContent||'').slice(0,60), href:e.getAttribute('href')})));
  })()`, returnByValue: true });
  console.log('note cards found:', r.result?.result?.value);

  // Find note links
  r = await send('Runtime.evaluate', { expression: `[...document.querySelectorAll('a[href*="/note"], a[href*="/dashboard/"], a[href*="/n/"]')].map(a => a.href).slice(0,5).join(',')`, returnByValue: true });
  const noteLinks = (r.result?.result?.value || '').split(',').filter(Boolean);
  console.log('note links:', noteLinks);

  // Navigate to the first note detail
  if (noteLinks.length > 0) {
    await send('Page.navigate', { url: noteLinks[0] });
    await new Promise(r => setTimeout(r, 10000));
    r = await send('Runtime.evaluate', { expression: 'location.href+"|||"+document.title', returnByValue: true });
    console.log('note detail:', r.result?.result?.value);

    // Find the note ID from URL to navigate to each tab
    r = await send('Runtime.evaluate', { expression: 'location.href', returnByValue: true });
    const noteUrl = r.result?.result?.value;
    const noteId = noteUrl?.match(/note\/([^/?#]+)/)?.[1] || noteUrl?.match(/n\/([^/?#]+)/)?.[1] || '';
    console.log('noteId:', noteId);

    // Screenshot each tab
    const tabs = ['belajar', 'catatan', 'mindmap', 'kuis', 'flashcard', 'sumber', 'chat', 'podcast', 'tempel'];
    for (const tab of tabs) {
      const tabUrl = `${noteUrl.split('?')[0]}?tab=${tab}`;
      await send('Page.navigate', { url: tabUrl });
      await new Promise(r => setTimeout(r, 6000));
      await send('Page.captureScreenshot', { format: 'png' }).then((s: any) => Bun.write(`/tmp/pjr-capture/tab-${tab}.png`, Buffer.from(s.result.data, 'base64')));
      r = await send('Runtime.evaluate', { expression: 'location.href+"|||"+document.title+"|||"+document.body.textContent.slice(0,200)', returnByValue: true });
      console.log(`tab ${tab}:`, r.result?.result?.value?.slice(0, 120));
    }

    // Capture all tab assets (images, CSS, fonts from the loaded page)
    r = await send('Runtime.evaluate', { expression: `(() => {
      const out = { images: [...document.querySelectorAll('img[src]')].map(i => i.src),
        stylesheets: [...document.querySelectorAll('link[rel=stylesheet]')].map(l => l.href),
        fonts: [...document.querySelectorAll('link[rel=preload][as=font]')].map(l => l.href),
        bgImages: [...document.querySelectorAll('*')].map(e => getComputedStyle(e).backgroundImage).filter(b => b && b !== 'none').slice(0, 50),
      };
      return JSON.stringify(out);
    })()`, returnByValue: true });
    const tabAssets = JSON.parse(r.result?.result?.value || '{}');
    await Bun.write('/tmp/pjr-capture/tab-assets.json', JSON.stringify(tabAssets, null, 2));
    console.log('tab assets — images:', tabAssets.images?.length, 'bgImages:', tabAssets.bgImages?.length);
  }

  ws.close(); process.exit(0);
});
ws.addEventListener('error', (e: any) => { console.error('err', e.message); process.exit(1); });
SCRIPT
timeout 180 bun /tmp/pjr-full.ts 2>&1 | tail -25
echo "=== CAPTURED FILES ==="
ls -la /tmp/pjr-capture/ 2>/dev/null