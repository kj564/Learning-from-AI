#!/bin/bash
# rea-full.sh — comprehensive RE of pelajarin.ai via REA.
# All in one process so Chrome CDP + Next server stay alive.
set -u
cd /home/z/my-project

EVID=docs/pelajarin-recon/capture

echo "=== 1. Ensure Chrome CDP on 9222 ==="
if ! curl -s --max-time 3 http://127.0.0.1:9222/json/version > /dev/null 2>&1; then
  echo "launching headless shell..."
  setsid bash -c 'exec /home/z/.cache/ms-playwright/chromium_headless_shell-1200/chrome-headless-shell-linux64/chrome-headless-shell --headless --remote-debugging-port=9222 --no-sandbox --disable-gpu --disable-dev-shm-usage --window-size=1280,800 about:blank' < /dev/null > /tmp/chrome-cdp.log 2>&1 &
  disown
  sleep 4
fi
curl -s http://127.0.0.1:9222/json/version 2>&1 | head -2

echo "=== 2. Navigate target to app.pelajarin.ai ==="
# Get the page target id
TARGET_ID=$(curl -s http://127.0.0.1:9222/json/list 2>/dev/null | bun -e "const d=await Bun.stdin.text();const j=JSON.parse(d);const t=j.find(x=>x.type==='page');console.log(t?.id||'')" 2>/dev/null | tail -1)
echo "target id: $TARGET_ID"

# Navigate via CDP (use Page.navigate on the target's WS)
# Simpler: use curl to the /json/new endpoint to open a new tab at the URL
curl -s --max-time 10 "http://127.0.0.1:9222/json/new?https://app.pelajarin.ai" > /dev/null 2>&1
sleep 8  # let the SPA + bundle load

echo "=== 3. List targets (find the app.pelajarin.ai tab) ==="
curl -s http://127.0.0.1:9222/json/list 2>/dev/null | bun -e "
const d = await Bun.stdin.text();
const j = JSON.parse(d);
j.forEach(t => console.log(t.type, t.url.slice(0,60), t.id));
" 2>&1 | head -8

APP_TARGET=$(curl -s http://127.0.0.1:9222/json/list 2>/dev/null | bun -e "
const d = await Bun.stdin.text();
const j = JSON.parse(d);
const t = j.find(x => x.url.includes('app.pelajarin.ai'));
console.log(t?.id || '');
" 2>/dev/null | tail -1)
echo "app target: $APP_TARGET"

if [ -z "$APP_TARGET" ]; then
  echo "ERROR: no app.pelajarin.ai target found"; exit 1
fi

echo "=== 4. REA analyze-web-bundle (endpoints view) ==="
npx rea-agents@latest analyze-web-bundle http://127.0.0.1:9222 "$APP_TARGET" \
  --allowed-origins '["https://app.pelajarin.ai","https://api.pelajarin.ai","https://pelajarin.ai"]' \
  --observation-ms 2000 \
  --detail summary --view endpoints \
  --evidence_output "$EVID/rea-app-endpoints-full.json" 2>&1 | tail -30

echo "=== 5. REA analyze-web-bundle (inferences view) ==="
npx rea-agents@latest analyze-web-bundle http://127.0.0.1:9222 "$APP_TARGET" \
  --allowed-origins '["https://app.pelajarin.ai","https://api.pelajarin.ai","https://pelajarin.ai"]' \
  --observation-ms 2000 \
  --detail summary --view inferences \
  --evidence_output "$EVID/rea-app-inferences-full.json" 2>&1 | tail -20

echo "=== 6. REA analyze-web-bundle (summary view) ==="
npx rea-agents@latest analyze-web-bundle http://127.0.0.1:9222 "$APP_TARGET" \
  --allowed-origins '["https://app.pelajarin.ai","https://api.pelajarin.ai","https://pelajarin.ai"]' \
  --observation-ms 2000 \
  --detail summary --view summary \
  --evidence_output "$EVID/rea-app-summary-full.json" 2>&1 | tail -15

echo "=== DONE ==="
