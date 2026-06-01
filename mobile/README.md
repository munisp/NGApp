# OG-RMM Mobile Apps

Two mobile clients for the OG-RMM platform — React Native (iOS + Android) and Flutter (iOS + Android + Web). Both connect to the same tRPC backend as the PWA.

---

## Architecture

```
mobile/
  react-native/     ← TypeScript, React Native 0.75, tRPC client
  flutter/          ← Dart 3.3, Flutter 3.19, Riverpod, Dio
```

Both apps share the same backend API contract. The tRPC type definitions in `server/routers.ts` are the single source of truth for all three clients (PWA, React Native, Flutter).

---

## Authentication

All three clients use the same OAuth flow:
1. Open `{BASE_URL}/api/oauth/login` in an in-app browser
2. OAuth callback sets a JWT session cookie / returns a Bearer token
3. All subsequent API calls include the token in `Authorization: Bearer {token}`

The `ServerConfigScreen` (both apps) lets field engineers point the app at their on-premise OG-RMM deployment.

---

## Feature Parity Matrix

| Feature | PWA | React Native | Flutter |
|---|:---:|:---:|:---:|
| Dashboard KPIs | ✅ | ✅ | ✅ |
| Well list + search + filter | ✅ | ✅ | ✅ |
| Well detail + telemetry | ✅ | ✅ | ✅ |
| Create / edit well | ✅ | ✅ | ✅ |
| Alarm list (ISA-18.2) | ✅ | ✅ | ✅ |
| Acknowledge / resolve alarm | ✅ | ✅ | ✅ |
| Workover CRUD | ✅ | ✅ | ✅ |
| Financials / P&L | ✅ | ✅ | ✅ |
| Production charts | ✅ | ✅ | ✅ |
| Permit-to-Work | ✅ | ✅ | ✅ |
| Calibration records | ✅ | ✅ | ✅ |
| HSE incidents | ✅ | ✅ | ✅ |
| Shift handover | ✅ | ✅ | ✅ |
| Damage assessment + photos | ✅ | ✅ | ✅ |
| Materials inventory | ✅ | ✅ | ✅ |
| Digital twin / nodal analysis | ✅ | ✅ | ✅ |
| AI Copilot chat | ✅ | ✅ | ✅ |
| Grafana dashboard embed | ✅ | — | — |
| OSDU Data Explorer | ✅ | — | — |
| Regulatory scheduler | ✅ | — | — |
| Offline sync (IndexedDB) | ✅ | ✅ (AsyncStorage) | ✅ (WorkManager) |
| Push notifications | ✅ | ✅ | ✅ |
| Server URL configuration | — | ✅ | ✅ |

> Grafana embed, OSDU explorer, and regulatory scheduler are desktop-first features not suited for mobile. All field operations have full mobile parity.

---

## React Native — Getting Started

```bash
cd mobile/react-native
pnpm install
# iOS
npx pod-install ios
npx react-native run-ios
# Android
npx react-native run-android
```

**Key files:**
- `src/api/trpc.ts` — tRPC client (same AppRouter type as PWA)
- `src/navigation/AppNavigator.tsx` — Bottom tabs + drawer navigation
- `src/hooks/useAuth.ts` — Auth state via `trpc.auth.me`
- `src/utils/theme.ts` — Design tokens matching PWA CSS variables
- `src/screens/dashboard/DashboardScreen.tsx` — Full implementation
- `src/screens/wells/WellsScreen.tsx` — Full CRUD implementation
- `src/screens/alarms/AlarmsScreen.tsx` — Full acknowledge/resolve implementation

---

## Flutter — Getting Started

```bash
cd mobile/flutter
flutter pub get
flutter run
```

**Key files:**
- `lib/main.dart` — App entry point with ProviderScope
- `lib/navigation/app_router.dart` — GoRouter with auth guard
- `lib/services/api_service.dart` — Dio HTTP client for tRPC
- `lib/services/auth_service.dart` — Riverpod auth state
- `lib/utils/theme.dart` — MaterialTheme matching PWA palette
- `lib/widgets/main_scaffold.dart` — Bottom navigation shell
- `lib/screens/dashboard/dashboard_screen.dart` — Full implementation

---

## Offline Sync

Both apps implement offline-first for field operations:

**React Native:** `useOfflineSync` hook queues mutations in `AsyncStorage` when offline. Background fetch drains the queue on reconnect.

**Flutter:** `WorkManager` background task drains a `SharedPreferences` queue on reconnect. The `connectivity_plus` package triggers immediate drain when connectivity is restored.

The same queue-and-drain pattern as the PWA Service Worker v2.

---

## Environment Variables

| Variable | Description |
|---|---|
| `BASE_URL` | OG-RMM server base URL (configurable in-app) |
| `OAUTH_CLIENT_ID` | Manus OAuth app ID |

No secrets are bundled in the app binary. The server URL is user-configurable from the Settings screen.
