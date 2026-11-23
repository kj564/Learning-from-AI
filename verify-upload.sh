#!/bin/bash
# verify-upload.sh — full upload flow test, all in one process so server stays up.
set -u
cd /home/z/my-project

echo "=== 1. Kill old + start server ==="
pkill -f "next" 2>/dev/null; pkill -f "keepalive" 2>/dev/null; sleep 2
rm -f db/custom.db-journal db/custom.db-wal db/custom.db-shm 2>/dev/null
chmod -R u+w db/ 2>/dev/null
setsid bash -c 'cd /home/z/my-project && exec bun keepalive.ts > /tmp/bimo-dev.log 2>&1' < /dev/null > /dev/null 2>&1 &
disown
for i in $(seq 1 25); do sleep 1; if curl -s --max-time 3 -o /dev/null http://localhost:3000/ 2>/dev/null; then echo "server up after ${i}s"; break; fi; done

# Make test file
printf '# Materi Sel\n\nSel adalah unit terkecil kehidupan. Ada membran, sitoplasma, dan inti.\n\n## Fungsi Sel\n\nSel berfungsi untuk metabolisme dan reproduksi.\n' > /tmp/test-materi.txt

echo "=== 2. Close any stale browser + open fresh ==="
agent-browser close 2>/dev/null
agent-browser open http://localhost:3000/ 2>&1 | tail -1
sleep 5
agent-browser wait --load networkidle 2>&1 | tail -1

echo "=== 3. Get browser cookie + seed note ==="
DEVUSER=$(agent-browser cookies 2>&1 | grep "pjr_dev_user=" | sed 's/.*=//')
echo "browser dev user: $DEVUSER"
bun seed-note.ts "$DEVUSER" 2>&1 | tail -1
agent-browser reload 2>&1 | tail -1
sleep 4
agent-browser wait --load networkidle 2>&1 | tail -1

echo "=== 4. Snapshot to find upload controls ==="
agent-browser snapshot -i -c 2>&1 | grep -iE "upload|record|youtube|textbox" | head -6

echo "=== 5. Click Upload button (this triggers the hidden file input) ==="
# Find the Upload button ref
UP_REF=$(agent-browser snapshot -i 2>&1 | grep -oP 'button "Upload" \[ref=e\d+\]' | head -1 | grep -oP 'e\d+')
echo "Upload button ref: $UP_REF"
# Click upload button — this opens the file picker, but agent-browser upload fills the input directly
# Instead, find the hidden file input by ref via eval
FILE_REF=$(agent-browser snapshot -i 2>&1 | grep -iE 'file|input.*type' | head -3)
echo "file input search: $FILE_REF"

echo "=== 6. Upload file via the hidden input ==="
# Use agent-browser's upload command on the file input
# The input is hidden but agent-browser can target it via CSS selector
agent-browser find first "input[type=file]" upload /tmp/test-materi.txt 2>&1 | tail -3
sleep 3
agent-browser wait --load networkidle 2>&1 | tail -1

echo "=== 7. Check toast + dashboard for new note ==="
agent-browser snapshot -c 2>&1 | grep -iE "Materi Sel|materi|catatan dibuat|gagal|error|toast|processing" | head -8

echo "=== 8. Console errors ==="
agent-browser errors 2>&1 | tail -8

echo "=== 9. Server log: presign + upload + note ==="
tail -n 20 /tmp/bimo-dev.log 2>/dev/null | grep -iE "POST /api/v1/documents|POST /api/v1/notes|error|500|201|background" | tail -10

echo "=== DONE ==="
