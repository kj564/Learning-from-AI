#!/bin/bash
# verify-bimo.sh — start server, seed note, set cookie, test Mindmap + Podcast tabs.
# All in one process so the server stays up for the whole verification.
set -u
cd /home/z/my-project

echo "=== 1. Kill old servers ==="
pkill -f "next" 2>/dev/null; pkill -f "keepalive" 2>/dev/null
sleep 2

echo "=== 2. Start server via setsid+keepalive ==="
setsid bash -c 'cd /home/z/my-project && exec bun keepalive.ts > /tmp/bimo-dev.log 2>&1' < /dev/null > /dev/null 2>&1 &
disown
for i in $(seq 1 25); do
  sleep 1
  if curl -s --max-time 3 -o /dev/null http://localhost:3000/ 2>/dev/null; then echo "server up after ${i}s"; break; fi
done

echo "=== 3. Seed note (prints dev userId) ==="
SEED_OUT=$(bun seed-note.ts 2>&1 | tail -3)
echo "$SEED_OUT"
DEVUSER=$(echo "$SEED_OUT" | grep -oP 'dev_[0-9a-f-]+' | head -1)
echo "extracted dev userId: $DEVUSER"

echo "=== 4. Open browser + set dev user cookie + reload ==="
agent-browser open http://localhost:3000/ 2>&1 | tail -1
sleep 3
# Set the cookie so the dashboard loads the seeded note
agent-browser cookies set bimo_dev_user "$DEVUSER" 2>&1 | tail -1
agent-browser reload 2>&1 | tail -1
sleep 4
agent-browser wait --load networkidle 2>&1 | tail -1

echo "=== 5. Dashboard snapshot — look for the note card ==="
agent-browser snapshot -i -c 2>&1 | grep -iE "fotosintesis|catatan|note|heading|Belum" | head -10

echo "=== 6. Click into the note (Fotosintesis card) ==="
agent-browser find text "Fotosintesis 101" click 2>&1 | tail -3
sleep 4
agent-browser wait --load networkidle 2>&1 | tail -1

echo "=== 7. Snapshot the note detail (belajar tab) ==="
agent-browser snapshot -i -c 2>&1 | head -30

echo "=== 8. Check console errors so far ==="
agent-browser errors 2>&1 | tail -10

echo "=== 9. Click Mindmap tab ==="
agent-browser find text "Mindmap" click 2>&1 | tail -2
sleep 5
agent-browser wait --load networkidle 2>&1 | tail -1
agent-browser screenshot /tmp/bimo-mindmap.png 2>&1 | tail -1
echo "--- Mindmap console errors ---"
agent-browser errors 2>&1 | tail -10

echo "=== 10. Click Podcast tab ==="
agent-browser find text "Podcast" click 2>&1 | tail -2
sleep 4
agent-browser wait --load networkidle 2>&1 | tail -1
agent-browser screenshot /tmp/bimo-podcast.png 2>&1 | tail -1
echo "--- Podcast console errors ---"
agent-browser errors 2>&1 | tail -10
echo "--- Podcast snapshot ---"
agent-browser snapshot -i -c 2>&1 | grep -iE "podcast|host|generate|pai|kiko|bolu|meli|create|pick" | head -15

echo "=== DONE ==="
