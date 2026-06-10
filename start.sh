#!/usr/bin/env bash
# Start the AI Lead Bundle site locally.
# Requires Python 3 (pre-installed on macOS).

set -e
cd "$(dirname "$0")/aileadbundle.com"

PORT="${1:-8080}"

if lsof -i ":$PORT" >/dev/null 2>&1; then
  echo "Port $PORT is already in use. Try: ./start.sh 3456"
  exit 1
fi

echo "Starting server at http://localhost:$PORT"
echo "Press Ctrl+C to stop."
python3 serve.py "$PORT"
