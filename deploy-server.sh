#!/bin/bash
set -e

APP_DIR="$HOME/centro-bus-predictor"

echo "=== Setting up project directory ==="
mkdir -p "$APP_DIR"
cd "$APP_DIR"

echo "=== Extracting application ==="
tar xzf "$HOME/centro-deploy.tar.gz" -C "$APP_DIR"

echo "=== Installing Python dependencies ==="
pip3 install --user -r api/requirements.txt 2>&1 | tail -5

echo "=== Installing Node dependencies ==="
npm ci 2>&1 | tail -5

echo "=== Building frontend ==="
npm run build 2>&1 | tail -10

echo "=== Stopping existing Flask process ==="
pkill -f "python3? .*(backend/src/main/app.py|app.py|-m api.src.app)" || true
sleep 2

echo "=== Starting Flask server ==="
cd "$APP_DIR"
nohup python3 -m api.src.app > "$APP_DIR/server.log" 2>&1 &
FLASK_PID=$!
echo "Flask PID: $FLASK_PID"

sleep 4

echo "=== Checking health ==="
HTTP_CODE=$(curl -s -o /tmp/health-check.html -w "%{http_code}" http://localhost:5001/api/v1/health 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
  echo " — Server is healthy (HTTP $HTTP_CODE)"
else
  echo " — WARNING: Health check returned HTTP $HTTP_CODE"
  tail -20 "$APP_DIR/server.log"
fi

echo ""
echo "=== Done ==="
echo "App: http://pi.cs.oswego.edu:5001"
echo "API: http://pi.cs.oswego.edu:5001/api/v1/health"
