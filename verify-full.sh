#!/bin/bash
# verify-full.sh — comprehensive E2E test of every Bimo feature.
# All in one process so the server stays up. Fix anything that breaks.
set -u
cd /home/z/my-project

echo "=== 1. RESTART SERVER CLEAN ==="
pkill -f "next" 2>/dev/null; pkill -f "keepalive" 2>/dev/null; sleep 2
rm -f db/custom.db-journal db/custom.db-wal db/custom.db-shm 2>/dev/null
chmod -R u+w db/ 2>/dev/null
setsid bash -c 'cd /home/z/my-project && exec bun keepalive.ts > /tmp/bimo-dev.log 2>&1' < /dev/null > /dev/null 2>&1 &
disown
for i in $(seq 1 25); do sleep 1; if curl -s --max-time 3 -o /dev/null http://localhost:3000/ 2>/dev/null; then echo "server up after ${i}s"; break; fi; done

# Get a fresh dev user cookie
COOKIE=$(curl -s --max-time 10 -c - http://localhost:3000/api/v1/me 2>/dev/null | grep pjr_dev_user | awk '{print $NF}')
H="Cookie: pjr_dev_user=$COOKIE"
echo "dev user: $COOKIE"

echo ""
echo "=== 2. API HEALTH (all endpoints) ==="
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
echo "  API: $PASS pass, $FAIL fail"

echo ""
echo "=== 3. FOLDERS CREATE ==="
curl -s --max-time 8 -H "$H" -X POST -H "Content-Type: application/json" -d '{"name":"IPA","color":"#3f8f01"}' http://localhost:3000/api/v1/folders 2>&1 | head -c 150
echo ""

echo "=== 4. NOTE CREATE VIA TEXT PROMPT (/notes/generate) ==="
GEN=$(curl -s --max-time 15 -H "$H" -X POST -H "Content-Type: application/json" -d '{"prompt":"Sistem Pencernaan"}' http://localhost:3000/api/v1/notes/generate 2>&1)
echo "$GEN" | head -c 200
NOTE_ID=$(echo "$GEN" | bun -e "const d=await Bun.stdin.text();const j=JSON.parse(d);console.log(j.data?.id||'')" 2>/dev/null | tail -1)
echo "note_id: $NOTE_ID"

echo "=== 5. NOTE UPLOAD FLOW (presign → PUT → /notes) ==="
printf '# Sel\n\nSel adalah unit terkecil kehidupan.\n' > /tmp/test-upload.txt
PRESIGN=$(curl -s --max-time 8 -H "$H" -X POST -H "Content-Type: application/json" -d '{"filename":"test-upload.txt","content_type":"text/plain","size_bytes":49}' http://localhost:3000/api/v1/documents/presign 2>&1)
DOC_ID=$(echo "$PRESIGN" | bun -e "const d=await Bun.stdin.text();const j=JSON.parse(d);console.log(j.data?.document_id||'')" 2>/dev/null | tail -1)
UPLOAD_URL=$(echo "$PRESIGN" | bun -e "const d=await Bun.stdin.text();const j=JSON.parse(d);console.log(j.data?.upload_url||'')" 2>/dev/null | tail -1)
PUT_CODE=$(curl -s --max-time 10 -X PUT --data-binary @/tmp/test-upload.txt -o /dev/null -w "%{http_code}" "$UPLOAD_URL" 2>&1)
echo "presign→PUT: $PUT_CODE (doc $DOC_ID)"

echo "=== 6. TRACK EVENTS (XP + streak) ==="
for evt in note_created quiz_passed flashcard_reviewed chat_session daily_login; do
  curl -s --max-time 5 -H "$H" -X POST -H "Content-Type: application/json" -d "{\"event_name\":\"$evt\"}" http://localhost:3000/api/v1/analytics/track > /dev/null 2>&1
done
echo "tracked 5 events"

echo "=== 7. HEARTBEAT (10 min) ==="
curl -s --max-time 8 -H "$H" -X POST -H "Content-Type: application/json" -d '{"minutes":10}' http://localhost:3000/api/v1/gamification/study/heartbeat 2>&1 | head -c 150
echo ""

echo "=== 8. GAMIFICATION STATE (after XP) ==="
curl -s --max-time 8 -H "$H" http://localhost:3000/api/v1/gamification 2>&1 | head -c 250
echo ""

echo "=== 9. CELEBRATIONS (should have pending) ==="
curl -s --max-time 8 -H "$H" http://localhost:3000/api/v1/gamification/celebrations 2>&1 | head -c 250
echo ""

echo "=== 10. CLARIFY STREAM (needs a chat session + message first) ==="
# Create a chat session + message via chat completions
SESSION="clarify-test-$(date +%s)"
CHAT_RES=$(curl -s --max-time 25 -H "$H" -X POST -H "Content-Type: application/json" -d "{\"note_id\":\"$NOTE_ID\",\"session_id\":\"$SESSION\",\"message\":\"Apa itu pencernaan?\"}" http://localhost:3000/api/v1/chat/completions 2>&1)
echo "chat first delta: $(echo "$CHAT_RES" | head -c 80)"
# Now clarify
CLARIFY_RES=$(curl -s --max-time 25 -H "$H" -X POST -H "Content-Type: application/json" -d "{\"session_id\":\"$SESSION\",\"mode\":\"shorter\"}" http://localhost:3000/api/v2/chat/clarify/stream 2>&1)
echo "clarify first delta: $(echo "$CLARIFY_RES" | head -c 80)"

echo "=== 11. PODCAST GENERATE (note_id + 2 hosts) ==="
PODCAST=$(curl -s --max-time 120 -H "$H" -X POST -H "Content-Type: application/json" -d "{\"hosts\":[\"Pai\",\"Kiko\"],\"duration\":\"3\",\"language\":\"id\"}" "http://localhost:3000/api/v1/notes/$NOTE_ID/podcast" 2>&1)
echo "podcast segments: $(echo "$PODCAST" | bun -e "const d=await Bun.stdin.text();const j=JSON.parse(d);console.log(j.data?.total_segments||0)" 2>/dev/null | tail -1)"

echo "=== 12. FLASHCARDS GENERATE ==="
curl -s --max-time 60 -H "$H" -X POST -H "Content-Type: application/json" -d '{"count":5}' "http://localhost:3000/api/v1/notes/$NOTE_ID/flashcards" 2>&1 | head -c 150
echo ""

echo "=== 13. QUIZ GENERATE ==="
curl -s --max-time 60 -H "$H" -X POST -H "Content-Type: application/json" -d '{"count":3}' "http://localhost:3000/api/v1/notes/$NOTE_ID/quizzes" 2>&1 | head -c 150
echo ""

echo "=== 14. SERVER ERRORS ==="
tail -n 40 /tmp/bimo-dev.log 2>/dev/null | grep -iE "⨯|error|500|RangeError|failed" | grep -v "GET /_next" | tail -12

echo "=== DONE (API tests) ==="
