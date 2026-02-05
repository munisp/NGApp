#!/bin/bash

# Metro Bundler Diagnostic Script
# Diagnoses and fixes "Cannot read properties of undefined (reading 'v1')" error

set -e

echo "🔍 Metro Bundler Diagnostic Tool"
echo "================================"
echo ""

cd "$(dirname "$0")/.."

# Function to print colored output
print_info() {
    echo -e "\033[0;34m[INFO]\033[0m $1"
}

print_success() {
    echo -e "\033[0;32m[SUCCESS]\033[0m $1"
}

print_error() {
    echo -e "\033[0;31m[ERROR]\033[0m $1"
}

print_warning() {
    echo -e "\033[1;33m[WARNING]\033[0m $1"
}

# Step 1: Check Node and npm versions
print_info "Checking Node.js and package manager versions..."
node --version
pnpm --version || npm --version

# Step 2: Check Expo version
print_info "Checking Expo SDK version..."
grep '"expo"' package.json

# Step 3: Check for conflicting packages
print_info "Checking for potential package conflicts..."
if grep -q '"metro"' package.json; then
    print_warning "Found direct metro dependency - this might conflict with Expo's metro"
fi

# Step 4: Check metro.config.js
print_info "Checking metro.config.js..."
if [ -f "metro.config.js" ]; then
    cat metro.config.js
else
    print_error "metro.config.js not found!"
fi

# Step 5: Check for node_modules issues
print_info "Checking node_modules..."
if [ ! -d "node_modules" ]; then
    print_error "node_modules directory not found!"
elif [ ! -d "node_modules/expo" ]; then
    print_error "expo package not installed!"
else
    print_success "node_modules appears to be installed"
fi

# Step 6: Check for cache directories
print_info "Checking cache directories..."
[ -d ".expo" ] && echo "  .expo cache exists" || echo "  .expo cache: not found"
[ -d ".metro" ] && echo "  .metro cache exists" || echo "  .metro cache: not found"
[ -d "node_modules/.cache" ] && echo "  node_modules/.cache exists" || echo "  node_modules/.cache: not found"

# Step 7: Attempt to identify the error
print_info "Analyzing error pattern..."
print_warning "Error: 'Cannot read properties of undefined (reading v1)'"
print_info "This error typically occurs when:"
print_info "  1. Metro bundler cache is corrupted"
print_info "  2. NativeWind configuration has issues"
print_info "  3. Package version mismatch"
print_info "  4. node_modules is incomplete or corrupted"

echo ""
print_info "Recommended fixes:"
echo "  1. Clear all caches: rm -rf .expo .metro node_modules/.cache"
echo "  2. Reinstall dependencies: rm -rf node_modules && pnpm install"
echo "  3. Start with --clear flag: npx expo start --clear"
echo "  4. Check metro.config.js for NativeWind configuration issues"

echo ""
read -p "Would you like to apply the recommended fixes? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_info "Applying fixes..."
    
    # Stop any running processes
    print_info "Stopping running Metro processes..."
    pkill -f "expo start" || true
    pkill -f "metro" || true
    
    # Clear caches
    print_info "Clearing caches..."
    rm -rf .expo .metro node_modules/.cache
    rm -rf $TMPDIR/metro-* 2>/dev/null || true
    rm -rf $TMPDIR/haste-map-* 2>/dev/null || true
    
    # Reinstall dependencies
    print_info "Reinstalling dependencies..."
    rm -rf node_modules
    pnpm install
    
    print_success "Fixes applied!"
    print_info "Now try running: pnpm dev"
else
    print_info "Skipping fixes"
fi
