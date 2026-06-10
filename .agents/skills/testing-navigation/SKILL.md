---
name: testing-payment-switch-navigation
description: Test PWA sidebar, search, breadcrumbs, admin dashboard navigation, and sidebar collapse/expand. Use when verifying navigation UI changes across client and admin apps.
---

# Testing Payment Switch Navigation

## Prerequisites

- Node.js installed
- Repo cloned at the working directory

## Devin Secrets Needed

None — the admin dashboard uses demo/demo credentials in development mode.

## Starting Dev Servers

### PWA Client (Vite)
```bash
cd <repo-root>
npx vite
```
- Default port: 5173 (may shift to 5174+ if port is in use)
- Check terminal output for actual port

### Admin Dashboard (Next.js)
```bash
cd <repo-root>/admin-dashboard
npx next dev -p 3002
```
- Use port 3002 to avoid conflicts with other services on 3000/3001
- If port is in use, kill old processes: `fuser -k 3002/tcp`

## What Can Be Tested in Browser

| Component | URL | Notes |
|-----------|-----|-------|
| PWA AppShell sidebar | `http://localhost:5173/dashboard` | Global sidebar on non-module pages |
| PWA module pages | `http://localhost:5173/domestic-payments` | Should show own ModuleLayout, NOT AppShell |
| PWA breadcrumbs | `http://localhost:5173/settings/2fa` | Shows Home > Settings > 2fa |
| PWA search | Search input in sidebar | Type to filter nav items |
| PWA collapse | Collapse button or Ctrl+B | Icon-only rail mode |
| Admin sidebar | `http://localhost:3002` | Login: demo/demo |
| Admin search | Search input above nav | Filters 47+ items |

## What CANNOT Be Runtime Tested

- **React Native mobile app** — requires Expo/simulator (not available on standard VMs)
- **Flutter mobile app** — requires Flutter SDK/emulator (not available on standard VMs)
- These should be code-reviewed only

## Test Procedure

### 1. PWA AppShell Sidebar
- Navigate to `/dashboard`
- Verify sidebar visible with "Payment Switch" logo, 25+ nav items in 6 sections
- Verify "Dashboard" is highlighted (blue background)
- Verify footer shows keyboard shortcut hints

### 2. Module Page Isolation
- Navigate to `/domestic-payments` (or any module route)
- Verify AppShell sidebar is NOT shown
- Verify page's own ModuleLayout sidebar is shown instead
- Verify breadcrumbs still appear above content

### 3. Sidebar Search
- On `/dashboard`, click the search input (or try Ctrl+K)
- Type "settlement" — should filter to 1 item
- Verify X clear button appears
- Clear and verify all items return

### 4. Breadcrumbs
- Navigate to `/settings/2fa`
- Verify breadcrumb: Home > Settings > 2fa
- Verify "Home" links to `/`, "Settings" links to `/settings`

### 5. Admin Sidebar Search
- Navigate to admin dashboard, log in with demo/demo
- Search "fraud" — should show "Fraud & Risk"
- Search nonsense text — should show "No items match" message

### 6. Sidebar Collapse/Expand
- On `/dashboard`, click the collapse button (or Ctrl+B)
- Verify sidebar collapses to icon-only rail
- Verify tooltip titles appear on each icon
- Click expand (or Ctrl+B again) — verify full sidebar returns

## Known Issues & Workarounds

- **Browser automation `press_key` for Ctrl+B/Ctrl+K** might be intermittent. Use the button/input click as fallback — they wire to the same handlers.
- **Port conflicts**: Vite may shift ports if 5173 is busy. Always check terminal output for actual port.
- **Admin port**: Use explicit `-p 3002` flag to avoid conflicts with other Next.js or Node processes.
- **Demo login**: Only works when `NODE_ENV !== 'production'`. The admin page auto-generates demo credentials in dev mode.
- **Module routes** that have their own sidebar: `/outbound-remittance`, `/inbound-remittance`, `/domestic-payments`, `/card-processing`, `/government-payments`, `/trade-payments`, `/open-banking`, `/middleware`. AppShell correctly excludes these.

## Tips

- Maximize browser window before recording for clearer screenshots
- Save screenshots to a dedicated directory (e.g., `~/screenshots/`) with descriptive names
- When testing search, verify both positive matches AND the "no results" empty state
- The sidebar has ~25 items in PWA and 47+ in admin — scrolling may be needed to see all sections
