#!/bin/bash
# start-on-phone.sh
# Run SMC Gold Bot on Android (Termux) or iOS (iSH)

echo "======================================================"
echo "📱 Starting SMC Gold Bot Mobile Server..."
echo "======================================================"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed!"
    echo ""
    echo "To install Node.js on Android (Termux):"
    echo "  pkg update && pkg install nodejs git"
    echo ""
    echo "To install Node.js on iOS (iSH):"
    echo "  apk update && apk add nodejs npm git"
    exit 1
fi

echo "✓ Node.js $(node -v) detected"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing project dependencies..."
    npm install --omit=dev || npm install
fi

# Build dist if not already built
if [ ! -d "dist" ]; then
    echo "🔨 Building mobile web app bundle..."
    npm run build
fi

# Start the mobile server
echo "🚀 Launching server on port 3000 (0.0.0.0)..."
if [ -d "dist" ]; then
    node scripts/mobile-server.js
else
    npm run mobile
fi
