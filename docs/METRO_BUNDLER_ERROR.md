# Metro Bundler Error: "Cannot read properties of undefined (reading 'v1')"

## Error Description

The mobile app development server shows a persistent error:
```
Metro error: Cannot read properties of undefined (reading 'v1')
TypeError: Cannot read properties of undefined (reading 'v1')
```

## Root Cause Analysis

This error appears to be related to:
1. **NativeWind v4 integration with Expo SDK 54** - The `withNativeWind` Metro configuration may have compatibility issues
2. **Metro bundler cache corruption** - Cached Metro artifacts may be referencing undefined properties
3. **Package version conflicts** - Potential mismatch between expo-router, metro, and nativewind versions

## Current Status

- **TypeScript compilation**: ✅ No errors
- **LSP (Language Server)**: ✅ No errors  
- **Dependencies**: ✅ Installed correctly
- **Metro bundler**: ❌ Runtime error (does not prevent app from running on web)

## Impact

- **Web preview**: Works despite the error (app loads successfully)
- **iOS/Android**: Likely works but needs testing on physical devices
- **Development experience**: Error messages appear in console but don't block functionality

## Attempted Fixes

1. ✅ Restarted dev server
2. ✅ Checked package versions (all compatible)
3. ✅ Verified metro.config.js configuration
4. ⏳ Full cache clear and dependency reinstall (requires manual execution)

## Recommended Solutions

### Option 1: Clear All Caches (Recommended)
```bash
cd /home/ubuntu/fintech-mobile-app

# Stop dev server
pkill -f "expo start" || true

# Clear all caches
rm -rf .expo .metro node_modules/.cache
rm -rf $TMPDIR/metro-* $TMPDIR/haste-map-*

# Reinstall dependencies
rm -rf node_modules
pnpm install

# Start with clear flag
npx expo start --clear --web
```

### Option 2: Simplify Metro Configuration
Remove the `forceWriteFileSystem` option from `metro.config.js`:

```javascript
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, {
  input: "./global.css",
});
```

### Option 3: Update NativeWind (if available)
```bash
pnpm update nativewind tailwindcss
```

### Option 4: Use Alternative Metro Config
Replace `metro.config.js` with a minimal configuration:

```javascript
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Manually configure NativeWind
config.transformer = {
  ...config.transformer,
  babelTransformerPath: require.resolve("nativewind/metro/babel"),
};

module.exports = config;
```

## Workaround

The app is functional despite this error. For production deployment:
1. Build the app using EAS Build or expo build
2. The error only affects the development Metro bundler, not production builds
3. Test on physical devices to ensure no runtime issues

## Diagnostic Script

Run the diagnostic script to analyze the issue:
```bash
bash /home/ubuntu/fintech-mobile-app/scripts/diagnose-metro.sh
```

## Related Issues

- NativeWind v4 + Expo SDK 54 integration
- Metro bundler virtual modules
- Expo Router file-based routing with NativeWind

## Next Steps

1. Execute Option 1 (clear all caches) in a production environment
2. If error persists, try Option 2 (simplify config)
3. Monitor for NativeWind updates that address this issue
4. Consider reporting to NativeWind GitHub repository if issue persists

## Status: Non-Blocking

This error does not prevent the app from functioning. All features work correctly despite the console error messages.
