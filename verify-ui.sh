#!/bin/bash
# verify-ui.sh — comprehensive UI E2E test via Agent Browser.
set -u
cd /home/z/my-project

echo "=== 1. OPEN BROWSER + LOAD DASHBOARD ==="
agent-browser close 2>/dev/null
agent-browser open http://localhost:3000/ 2>&1 | tail -1
sleep 5
agent-browser wait --load networkidle 2>&1 | tail -1
DEVUSER=$(agent-browser cookies 2>&1 | grep "pjr_dev_user=" | sed 's/.*=//')
echo "dev: $DEVUSER"

# Seed a note for testing (background gen takes ~15s)
bun seed-note.ts "$DEVUSER" 2>&1 | tail -1
agent-browser reload 2>&1 | tail -1; sleep 4
agent-browser wait --load networkidle 2>&1 | tail -1

echo "=== 2. ONBOARDING MODAL (should appear, clear first) ==="
agent-browser storage local clear 2>&1 | tail -1
agent-browser reload 2>&1 | tail -1; sleep 5
agent-browser wait --load networkidle 2>&1 | tail -1
sleep 2
ONBOARD=$(agent-browser snapshot -c 2>&1 | grep -ciE "hai aku bimo|upload materi|gratis selamanya|lanjut|lewati")
echo "onboarding visible: $ONBOARD"
if [ "$ONBOARD" -gt 0 ]; then echo "PASS: onboarding shows"; else echo "FAIL: no onboarding"; fi
agent-browser press Escape 2>&1 | tail -1; sleep 1

echo "=== 3. DASHBOARD ELEMENTS ==="
agent-browser snapshot -c 2>&1 | grep -iE "what do you want|mascot|notes|all folders|all|documents|slides|audio|youtube|grid|fotosintesis|streak|level|upgrade|become" | head -15

echo "=== 4. PRICING MODAL (click Upgrade) ==="
UP_REF=$(agent-browser snapshot -i 2>&1 | grep -oP 'button "Upgrade" \[ref=e\d+\]' | head -1 | grep -oP 'e\d+')
agent-browser click "@$UP_REF" 2>&1 | tail -1; sleep 2
PRICING=$(agent-browser snapshot -c 2>&1 | grep -ciE "pilih plan|free|pro|rp20|rp240|gratis selamanya|popular|bulanan|tahunan|upgrade ke pro|mulai gratis")
echo "pricing visible: $PRICING"
if [ "$PRICING" -gt 5 ]; then echo "PASS: pricing modal"; else echo "FAIL: pricing"; fi
agent-browser press Escape 2>&1 | tail -1; sleep 1

echo "=== 5. GAMIFICATION HUB (click Streak) ==="
STREAK_REF=$(agent-browser snapshot -i 2>&1 | grep -oP 'button "Streak \d+" \[ref=e\d+\]' | head -1 | grep -oP 'e\d+')
agent-browser click "@$STREAK_REF" 2>&1 | tail -1; sleep 3
HUB=$(agent-browser snapshot -c 2>&1 | grep -ciE "level|quest harian|leaderboard|achievement|total xp|xp ke level")
echo "hub visible: $HUB"
if [ "$HUB" -gt 2 ]; then echo "PASS: gamification hub"; else echo "FAIL: hub"; fi
echo "=== HUB TABS ==="
agent-browser snapshot -c 2>&1 | grep -iE "quest harian|leaderboard|achievement" | head -3
# Click each tab
for tab in "Quest Harian" "Leaderboard" "Achievements"; do
  agent-browser find role button click --name "$tab" 2>&1 | tail -1; sleep 1
  echo "  tab '$tab' content:"
  agent-browser snapshot -c 2>&1 | grep -iE "selesaikan|review|chat|kuis|flashcard|rank|xp|badge|bronze|silver|gold|obrolan|catatan pertama" | head -4
done
agent-browser press Escape 2>&1 | tail -1; sleep 1

echo "=== 6. FOLDER DROPDOWN ==="
FOLDER_REF=$(agent-browser snapshot -i 2>&1 | grep -oP 'button "All folders" \[ref=e\d+\]' | head -1 | grep -oP 'e\d+')
agent-browser click "@$FOLDER_REF" 2>&1 | tail -1; sleep 1
agent-browser snapshot -c 2>&1 | grep -iE "all folders|folder baru|matematika|ipa" | head -4
agent-browser press Escape 2>&1 | tail -1; sleep 1

echo "=== 7. CLICK INTO NOTE ==="
agent-browser scroll down 300 2>&1 | tail -1
NOTE_REF=$(agent-browser snapshot -i 2>&1 | grep -oP 'button "PDF Fotosintesis[^"]*" \[ref=e\d+\]' | head -1 | grep -oP 'e\d+')
agent-browser click "@$NOTE_REF" 2>&1 | tail -1; sleep 4
agent-browser wait --load networkidle 2>&1 | tail -1
echo "=== NOTE DETAIL TABS (9) ==="
agent-browser snapshot -c 2>&1 | grep -iE "^.*(learn|notes|mindmap|quiz|flashcards|sources|ask ai|podcast|sticky)" | head -10

echo "=== 8. TEST EACH TAB ==="
for tab in "Learn" "Notes" "Mindmap" "Quiz" "Flashcards" "Sources" "Ask AI" "Podcast" "Sticky"; do
  echo "--- $tab ---"
  agent-browser find role button click --name "$tab" 2>&1 | tail -1; sleep 3
  agent-browser wait --load networkidle 2>&1 | tail -1
  agent-browser errors 2>&1 | tail -2
  agent-browser snapshot -c 2>&1 | grep -iE "heading|chapter|flashcard|quiz|podcast|pai|kiko|create|sticky|text|mindmap|catatan" | head -4
done

echo "=== 9. CHAT TAB: SEND + CLARIFY ==="
agent-browser find role button click --name "Ask AI" 2>&1 | tail -1; sleep 3
CHAT_TA=$(agent-browser snapshot -i 2>&1 | grep -oP 'textbox "Ask anything[^"]*" \[ref=e\d+\]' | head -1 | grep -oP 'e\d+')
agent-browser fill "@$CHAT_TA" "Jelaskan fotosintesis" 2>&1 | tail -1; sleep 1
agent-browser press Enter 2>&1 | tail -1
echo "waiting 15s for chat..."
sleep 15
CLARIFY=$(agent-browser snapshot -c 2>&1 | grep -ciE "jelaskan ulang|lebih ringkas|lebih detail|dengan contoh")
echo "clarify buttons: $CLARIFY"
if [ "$CLARIFY" -ge 4 ]; then echo "PASS: clarify buttons appear"; else echo "FAIL: no clarify"; fi

echo "=== 10. FINAL ERROR CHECK ==="
agent-browser errors 2>&1 | tail -8
echo "=== CONSOLE ==="
agent-browser console 2>&1 | grep -iE "error|fail|warn" | grep -v "DevTools\|HMR\|Fast Refresh" | tail -6

echo "=== DONE ==="
