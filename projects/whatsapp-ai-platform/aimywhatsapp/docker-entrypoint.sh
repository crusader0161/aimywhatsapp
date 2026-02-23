#!/bin/sh
set -e

echo "🚀 Starting Aimywhatsapp..."

# Sync DB schema (using db push — works with or without migration history)
echo "🗃️ Syncing database schema..."
cd /app/apps/api && npx prisma db push --accept-data-loss
cd /app

# Start API server in background
echo "⚡ Starting API server on :3001..."
node /app/apps/api/dist/server.js &
API_PID=$!

# Start Next.js standalone server
echo "🌐 Starting web server on :3000..."
PORT=3000 HOSTNAME=0.0.0.0 node /app/apps/web/standalone/apps/web/server.js &
WEB_PID=$!

echo "✅ Aimywhatsapp is running!"
echo "   Web:  http://0.0.0.0:3000"
echo "   API:  http://0.0.0.0:3001"

# Wait for either process to exit
wait $API_PID $WEB_PID
