#!/bin/bash
# verify-full-v2.sh — comprehensive E2E with proper wait for background generation.
set -u
cd /home/z/my-project

echo "=== 1. RESTART SERVER ==="
pkill -f "next" 2>/dev/null; pkill -f "keepalive" 2>/dev/null; sleep 2
rm -f db/custom.db-journal db/custom.db-wal db/custom.db-shm 2>/dev/null
chmod -R u+w db/ 2>/dev/null
setsid bash -c 'cd /home/z/my-project && exec bun keepalive.ts > /tmp/bimo-dev.log 2>&1' < /dev/null > /dev/null 2>&1 &
disown
for i in $(seq 1 25); do sleep 1; if curl -s --max-time 3 -o /dev/null http://localhost:3000/ 2>/dev/null; then echo "server up"; break; fi; done

COOKIE=$(curl -s --max-time 10 -c - http://localhost:3000/api/v1/me 2>/dev/null | grep pjr_dev_user | awk '{print $NF}')
H="Cookie: pjr_dev_user=$COOKIE"
echo "dev: $COOKIE"

echo "=== 2. ALL API ENDPOINTS ==="
PASS=0; FAIL=0
for ep in /api/v1/me /api/v1/subscriptions /api/v1/profile /api/v1/profile/activity \
          /api/v1/gamification /api/v1/gamification/hub /api/v1/gamification/quests \
          /api/v1/gamification/achievements /api/v1/gamification/leaderboard \
          /api/v1/gamification/leaderboard/periods /api/v1/gamification/league \
          /api/v1/gamification/celebrations /api/v1/folders /api/v1/documents \
          /api/v1/notes?limit=50 /api/v1/subjects; do
  CODE=$(curl -s --max-time 8 -o /dev/null -w "%{http_code}" -H "$H" "http://localhost:3000$ep" 2>&1)
  if [ "$CODE" = "200" ]; then PASS=$((PASS+1)); else FAIL=$((FAIL+1)); echo "  FAIL $ep → $CODE"; fi
done
echo "  $PASS pass, $FAIL fail"

echo "=== 3. NOTE VIA TEXT PROMPT + WAIT FOR COMPLETION ==="
GEN=$(curl -s --max-time 15 -H "$H" -X POST -H "Content-Type: application/json" -d '{"prompt":"Sistem Pencernaan Manusia"}' http://localhost:3000/api/v1/notes/generate 2>&1)
NOTE_ID=$(echo "$GEN" | bun -e "const d=await Bun.stdin.text();const j=JSON.parse(d);console.log(j.data?.id||'')" 2>/dev/null | tail -1)
echo "note_id: $NOTE_ID (processing...)"
# Poll until status is completed
for i in $(seq 1 30); do
  sleep 3
  STATUS=$(curl -s --max-time 5 -H "$H" "http://localhost:3000/api/v1/notes/$NOTE_ID" 2>/dev/null | bun -e "const d=await Bun.stdin.text();const j=JSON.parse(d);console.log(j.data?.status||'')" 2>/dev/null | tail -1)
  if [ "$STATUS" = "completed" ]; then echo "READY after ~$((i*3))s (status: completed)"; break; fi
  echo "  still $STATUS at $((i*3))s..."
done
CHAPTERS=$(curl -s --max-time 5 -H "$H" "http://localhost:3000/api/v1/notes/$NOTE_ID" 2>/dev/null | bun -e "const d=await Bun.stdin.text();const j=JSON.parse(d);console.log(j.data?.total_chapters||0)" 2>/dev/null | tail -1)
echo "chapters: $CHAPTERS"

echo "=== 4. FLASHCARDS GENERATE (note ready now) ==="
curl -s --max-time 60 -H "$H" -X POST -H "Content-Type: application/json" -d '{"count":5}' "http://localhost:3000/api/v1/notes/$NOTE_ID/flashcards" 2>&1 | head -c 200
echo ""

echo "=== 5. QUIZ GENERATE ==="
curl -s --max-time 60 -H "$H" -X POST -H "Content-Type: application/json" -d '{"count":3}' "http://localhost:3000/api/v1/notes/$NOTE_ID/quizzes" 2>&1 | head -c 200
echo ""

echo "=== 6. UPLOAD FLOW (with cookie on PUT) ==="
printf '# Sel\n\nSel adalah unit terkecil kehidupan.\n' > /tmp/test-upload.txt
PRESIGN=$(curl -s --max-time 8 -H "$H" -X POST -H "Content-Type: application/json" -d '{"filename":"test-upload.txt","content_type":"text/plain","size_bytes":49}' http://localhost:3000/api/v1/documents/presign 2>&1)
DOC_ID=$(echo "$PRESIGN" | bun -e "const d=await Bun.stdin.text();const j=JSON.parse(d);console.log(j.data?.document_id||'')" 2>/dev/null | tail -1)
UPLOAD_URL=$(echo "$PRESIGN" | bun -e "const d=await Bun.stdin.text();const j=JSON.parse(d);console.log(j.data?.upload_url||'')" 2>/dev/null | tail -1)
PUT_CODE=$(curl -s --max-time 10 -H "$H" -X PUT --data-binary @/tmp/test-upload.txt -o /dev/null -w "%{http_code}" "$UPLOAD_URL" 2>&1)
echo "PUT (with cookie): $PUT_CODE (doc $DOC_ID)"

echo "=== 7. PODCAST GENERATE (note ready) ==="
PODCAST=$(curl -s --max-time 120 -H "$H" -X POST -H "Content-Type: application/json" -d "{\"hosts\":[\"Pai\",\"Kiko\"],\"duration\":\"3\",\"language\":\"id\"}" "http://localhost:3000/api/v1/notes/$NOTE_ID/podcast" 2>&1)
SEGMENTS=$(echo "$PODCAST" | bun -e "const d=await Bun.stdin.text();const j=JSON.parse(d);console.log(j.data?.total_segments||0)" 2>/dev/null | tail -1)
echo "podcast segments: $SEGMENTS"

echo "=== 8. CLARIFY STREAM ==="
SESSION="clarify-$(date +%s)"
CHAT_RES=$(curl -s --max-time 25 -H "$H" -X POST -H "Content-Type: application/json" -d "{\"note_id\":\"$NOTE_ID\",\"session_id\":\"$SESSION\",\"message\":\"Apa itu pencernaan?\"}" http://localhost:3000/api/v1/chat/completions 2>&1)
echo "chat first delta: $(echo "$CHAT_RES" | head -c 60)"
CLARIFY_RES=$(curl -s --max-time 25 -H "$H" -X POST -H "Content-Type: application/json" -d "{\"session_id\":\"$SESSION\",\"mode\":\"shorter\"}" http://localhost:3000/api/v2/chat/clarify/stream 2>&1)
echo "clarify first delta: $(echo "$CLARIFY_RES" | head -c 60)"

echo "=== 9. GAMIFICATION STATE ==="
curl -s --max-time 8 -H "$H" http://localhost:3000/api/v1/gamification 2>&1 | head -c 200
echo ""

echo "=== 10. FOLDERS (create + list) ==="
curl -s --max-time 8 -H "$H" -X POST -H "Content-Type: application/json" -d '{"name":"Matematika"}' http://localhost:3000/api/v1/folders > /dev/null 2>&1
curl -s --max-time 8 -H "$H" http://localhost:3000/api/v1/folders 2>&1 | head -c 250
echo ""

echo "=== 11. PROFILE + ACTIVITY ==="
curl -s --max-time 8 -H "$H" http://localhost:3000/api/v1/profile 2>&1 | head -c 200
echo ""
curl -s --max-time 8 -H "$H" http://localhost:3000/api/v1/profile/activity 2>&1 | head -c 250
echo ""

echo "=== 12. DAILY GOAL + STREAK REPAIR ==="
curl -s --max-time 8 -H "$H" -X PUT -H "Content-Type: application/json" -d '{"minutes":45}' http://localhost:3000/api/v1/gamification/daily-goal 2>&1 | head -c 100
echo ""
curl -s --max-time 8 -H "$H" -X POST http://localhost:3000/api/v1/gamification/streak/repair 2>&1 | head -c 100
echo ""

echo "=== 13. CELEBRATIONS ACK ==="
curl -s --max-time 8 -H "$H" -X POST -H "Content-Type: application/json" -d '{"id":"test"}' http://localhost:3000/api/v1/gamification/celebrations/ack 2>&1 | head -c 100
echo ""

echo "=== 14. ERRORS ==="
tail -n 50 /tmp/bimo-dev.log 2>/dev/null | grep -iE "⨯|RangeError|500|column|Prisma.*error" | grep -v "GET /_next\|GET /api" | tail -10

echo "=== DONE ==="
