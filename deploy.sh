#!/bin/bash
set -e

echo "=============================="
echo " Centro Bus Predictor — Deploy"
echo "=============================="

read -s -p "SSH password for vpatel4@pi.cs.oswego.edu: " SSHPASS
echo ""
export SSHPASS

TARGET="vpatel4@pi.cs.oswego.edu"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "=== Building frontend ==="
cd "$SCRIPT_DIR"
npm run build 2>&1 | tail -5

echo ""
echo "=== Creating project tarball ==="
tar czf /tmp/centro-deploy.tar.gz \
  --exclude=node_modules \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  --exclude='.git' \
  --exclude='api/.env' \
  api/ backend/ build/ src/ public/ docs/centro-routes.json \
  package.json package-lock.json requirements.txt

echo "=== Copying files to server ==="
sshpass -e scp -o StrictHostKeyChecking=no -q \
  /tmp/centro-deploy.tar.gz \
  vpatel4@pi.cs.oswego.edu:~/centro-deploy.tar.gz

sshpass -e scp -o StrictHostKeyChecking=no -q \
  "$SCRIPT_DIR/deploy-server.sh" \
  vpatel4@pi.cs.oswego.edu:~/deploy-server.sh

echo "=== Running setup on server ==="
sshpass -e ssh -o StrictHostKeyChecking=no "$TARGET" "bash ~/deploy-server.sh"

echo ""
echo "=== Setting up SSH key for passwordless login ==="
ssh-keygen -t ed25519 -f ~/.ssh/pi_oswego -N "" -q 2>/dev/null || true
sshpass -e ssh -o StrictHostKeyChecking=no "$TARGET" "mkdir -p ~/.ssh && chmod 700 ~/.ssh"
sshpass -e ssh -o StrictHostKeyChecking=no "$TARGET" "echo '$(cat ~/.ssh/pi_oswego.pub)' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"

SSHPASS=""
echo ""
echo "=== SSH key installed — future logins won't need a password ==="
echo ""
echo "Quick commands:"
echo "  ssh vpatel4@pi.cs.oswego.edu"
echo "  curl http://pi.cs.oswego.edu:5001/api/v1/health"
echo ""
echo "Done."
