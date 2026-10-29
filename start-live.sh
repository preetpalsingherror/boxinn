#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

echo "===================================================="
echo "🥊 Starting BOX INN Live Server & Public Tunnel..."
echo "===================================================="

# 1. Start PostgreSQL if not already running
mkdir -p /tmp/boxinn_pg
if ! /usr/lib/postgresql/18/bin/pg_isready -h /tmp/boxinn_pg -p 5432 >/dev/null 2>&1; then
  echo "▶ Starting PostgreSQL 18 daemon..."
  nohup /usr/lib/postgresql/18/bin/postgres -D .local/share/boxinn_pg -p 5432 -k /tmp/boxinn_pg > /tmp/boxinn_pg.log 2>&1 &
  sleep 2
else
  echo "✔ PostgreSQL is already running."
fi

# 2. Start Next.js production server if not already listening on 3000
if ! ss -tln | grep -q ':3000 '; then
  echo "▶ Starting Next.js production server on port 3000..."
  nohup npm run start > /tmp/boxinn_next.log 2>&1 &
  sleep 2
else
  echo "✔ Next.js production server is already running on port 3000."
fi

# 3. Ensure cloudflared binary exists
if [ ! -f .local/bin/cloudflared ]; then
  echo "▶ Downloading cloudflared..."
  mkdir -p .local/bin
  curl -sL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o .local/bin/cloudflared
  chmod +x .local/bin/cloudflared
fi

# 4. Restart Cloudflare tunnel and print the new URL
pkill -f "cloudflared tunnel" >/dev/null 2>&1 || true
echo "▶ Launching Cloudflare Public HTTPS Tunnel..."
nohup .local/bin/cloudflared tunnel --url http://localhost:3000 > /tmp/boxinn_tunnel.log 2>&1 &

echo "⏳ Waiting for public HTTPS link..."
for i in {1..15}; do
  URL=$(grep -o 'https://[-a-z0-9]*\.trycloudflare\.com' /tmp/boxinn_tunnel.log | head -n 1 || true)
  if [ -n "$URL" ]; then
    echo ""
    echo "===================================================="
    echo "✅ LIVE PUBLIC LINK READY:"
    echo "🔗 $URL"
    echo "===================================================="
    echo "⚠️  IMPORTANT: Keep your laptop awake and connected to Wi-Fi/Hotspot"
    echo "    while showing this link at the gym!"
    exit 0
  fi
  sleep 1
done

echo "Check /tmp/boxinn_tunnel.log for tunnel URL."
