#!/bin/bash

# Metro Bundler Fix Script
# Resolves "Cannot read properties of undefined (reading 'v1')" error

set -e

echo "🔧 Fixing Metro Bundler..."

# Navigate to project directory
cd "$(dirname "$0")/.."

# Stop any running Metro processes
echo "📛 Stopping running Metro processes..."
pkill -f "expo start" || true
pkill -f "metro" || true

# Clear all caches
echo "🗑️  Clearing caches..."
rm -rf node_modules/.cache
rm -rf .expo
rm -rf .metro
rm -rf $TMPDIR/metro-* 2>/dev/null || true
rm -rf $TMPDIR/haste-map-* 2>/dev/null || true

# Clear watchman cache (if available)
if command -v watchman &> /dev/null; then
    echo "👁️  Clearing Watchman cache..."
    watchman watch-del-all || true
fi

# Reinstall dependencies
echo "📦 Reinstalling dependencies..."
rm -rf node_modules
pnpm install

# Clear Metro bundler cache
echo "🧹 Clearing Metro bundler cache..."
npx expo start --clear

echo "✅ Metro bundler fix complete!"
echo "🚀 You can now run 'pnpm dev' to start the development server"
