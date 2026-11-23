#!/bin/bash
# verify-generate.sh — test the text-prompt note generation flow.
set -u
cd /home/z/my-project

echo "=== 1. Restart server ==="
pkill -f "next" 2>/dev/null; pkill -f "keepalive" 2>/dev/null; sleep 2
rm -f db/custom.db-journal db/custom.db-wal db/custom.db-shm 2>/dev/null
chmod -R u+w db/ 2>/dev/null
setsid bash -c 'cd /home/z/my-project && exec bun keepalive.ts > /tmp/bimo-dev.log 2>&1' < /dev/null > /dev/null 2>&1 &
disown
for i in $(seq 1 25); do sleep 1; if curl -s --max-time 3 -o /dev/null http://localhost:3000/ 2>/dev/null; then echo "server up after ${i}s"; break; fi; done

echo "=== 2. Open browser fresh ==="
agent-browser close 2>/dev/null
agent-browser open http://localhost:3000/ 2>&1 | tail -1
sleep 5
agent-browser wait --load networkidle 2>&1 | tail -1
DEVUSER=$(agent-browser cookies 2>&1 | grep "pjr_dev_user=" | sed 's/.*=//')
echo "browser dev user: $DEVUSER"

echo "=== 3. Type a topic in the textarea + press Enter ==="
# Find the textarea ref
TA_REF=$(agent-browser snapshot -i 2>&1 | grep -oP 'textbox "What would you like to learn\?" \[ref=e\d+\]' | head -1 | grep -oP 'e\d+')
echo "textarea ref: $TA_REF"
agent-browser fill "@$TA_REF" "Fotosintesis" 2>&1 | tail -1
sleep 1
# Press Enter to trigger handleCreateNote (onKeyDown Enter + !shiftKey)
agent-browser press Enter 2>&1 | tail -1
sleep 3
agent-browser wait --load networkidle 2>&1 | tail -1

echo "=== 4. Check toast + new note ==="
agent-browser snapshot -c 2>&1 | grep -iE "Fotosintesis|materinya|gagal|processing|toast" | head -6

echo "=== 5. Wait for generation (up to 90s) ==="
for i in $(seq 1 18); do
  sleep 5
  SNAP=$(agent-browser snapshot -c 2>&1)
  if echo "$SNAP" | grep -qiE "Fotosintesis.*bab"; then
    echo "GENERATION DONE after ~$((i*5))s"
    break
  fi
  echo "still processing at $((i*5))s..."
done

echo "=== 6. Final dashboard state ==="
agent-browser snapshot -c 2>&1 | grep -iE "Fotosintesis|bab|chapters|processing" | head -6

echo "=== 7. Server log (generate flow) ==="
tail -n 20 /tmp/bimo-dev.log 2>/dev/null | grep -iE "notes/generate|background|completed|error|201|500" | tail -8

echo "=== DONE ==="
