#!/bin/sh
set -e

echo "🚀 Starting Aimywhatsapp..."

# Run DB migrations
echo "🗃️ Running database migrations..."
cd apps/api && npx prisma migrate deploy && cd /app

# Start API server in background
echo "⚡ Starting API server..."
node apps/api/dist/server.js &
API_PID=$!

# Start Next.js in background
echo "🌐 Starting web server..."
cd apps/web && node_modules/.bin/next start -p 3000 &
WEB_PID=$!

echo "✅ Aimywhatsapp is running!"
echo "   Web:  http://0.0.0.0:3000"
echo "   API:  http://0.0.0.0:3001"

# Wait for either process to exit
wait $API_PID $WEB_PID
