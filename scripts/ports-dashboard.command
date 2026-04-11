#!/bin/bash
# Double-click shortcut for the Ports Console web dashboard.
#
# Behavior:
#   - Changes into the port-whisperer repo
#   - If the server is already listening on :7777, opens the browser at it
#   - Otherwise starts `ports serve` with --open
#
# When you close this Terminal window (Cmd+W or Cmd+Q) the server stops.
# To move it: drop this file on your Desktop, in ~/Applications/, or drag
# it into your Dock's right side (between downloads and trash).

set -e

REPO="/Users/aljosag/Desktop/_GITHUB/port-whisperer"
PORT=7777

cd "$REPO"

if lsof -iTCP:$PORT -sTCP:LISTEN -P -n >/dev/null 2>&1; then
  echo ""
  echo "  Ports Console is already running on :$PORT"
  echo "  Opening browser..."
  open "http://127.0.0.1:$PORT/"
  echo ""
  echo "  (The existing server keeps running — close its original terminal to stop.)"
  echo ""
  read -n 1 -s -r -p "  Press any key to close this window..."
  echo ""
  exit 0
fi

clear
cat <<'BANNER'

  ┌─────────────────────────────────────┐
  │  >_ TechSumo                        │
  │     PORTS CONSOLE                   │
  └─────────────────────────────────────┘

  Launching http://127.0.0.1:7777/
  Close this window or press Ctrl+C to stop.

BANNER

exec node src/index.js serve --port "$PORT" --open
