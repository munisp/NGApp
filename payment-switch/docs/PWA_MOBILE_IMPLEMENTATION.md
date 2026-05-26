# PWA and Mobile UI/UX Implementation Guide

This document describes the Progressive Web App (PWA) and mobile-optimized UI/UX implementation for all 30 user journeys.

## PWA Features Implemented

### 1. App Manifest

**Location:** `/client/public/manifest.json`

**Features:**
- Installable on mobile and desktop
- Standalone display mode
- Custom app icons (72x72 to 512x512)
- App shortcuts for quick access
- Screenshots for app stores

**Shortcuts:**
- Dashboard - Quick access to merchant dashboard
- Analytics - View analytics directly
- Onboarding - Start participant onboarding

### 2. Service Worker

**Technology:** Workbox (via vite-plugin-pwa)

**Caching Strategies:**
- **NetworkFirst** for API calls (5-minute cache)
- **CacheFirst** for CDN assets (24-hour cache)
- **Precaching** for app shell (HTML, CSS, JS)

**Offline Support:**
- App shell loads offline
- Cached API responses available
- Queue actions when offline, sync when online

### 3. Install Prompt

**Component:** `PWAInstallPrompt.tsx`

**Features:**
- Automatic prompt after user engagement
- Dismissible for 7 days
- Detects if already installed
- Beautiful card UI with install button

### 4. Push Notifications

**Use Cases:**
- Payment status updates
- Merchant application approvals
- Compliance alerts
- Fraud detection warnings
- Settlement notifications

**Implementation:**
```typescript
// Request permission
const permission = await Notification.requestPermission();

// Subscribe to push
const subscription = await registration.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: VAPID_PUBLIC_KEY
});

// Send to backend
await trpc.notifications.subscribe.mutate({ subscription });
```

## Mobile-Optimized Components

### 1. Payment Status Tracker

**Component:** `PaymentStatusTracker.tsx`

**Features:**
- Real-time status updates (3-second polling)
- Visual timeline with icons
- Large touch targets
- Retry and download actions
- Responsive design for all screen sizes

**User Stories Supported:**
- US-006: Process Card Payment
- US-011: Download Receipt
- US-014: Retry Failed Payment
- US-024: Payment Status Tracking

### 2. Mobile Navigation

**Pattern:** Bottom navigation for mobile, sidebar for desktop

**Implementation:**
```typescript
// Responsive navigation
const isMobile = useMediaQuery("(max-width: 768px)");

return isMobile ? (
  <BottomNavigation items={navItems} />
) : (
  <SidebarNavigation items={navItems} />
);
```

**Navigation Items:**
- Home
- Dashboard
- Analytics
- Onboarding
- Settings

### 3. Touch-Optimized Forms

**Features:**
- Large input fields (min 44x44px)
- Clear error messages
- Auto-focus on first field
- Keyboard-aware scrolling
- Haptic feedback on actions

**Example: Payment Form**
```typescript
<form className="space-y-4">
  <input
    type="text"
    className="h-12 text-lg" // Large touch target
    autoFocus
    inputMode="numeric" // Mobile-optimized keyboard
  />
  <Button className="h-12 w-full text-lg">
    Pay Now
  </Button>
</form>
```

### 4. Swipe Gestures

**Use Cases:**
- Swipe to refresh transaction list
- Swipe to delete saved payment methods
- Swipe between analytics tabs

**Implementation:**
```typescript
import { useSwipeable } from "react-swipeable";

const handlers = useSwipeable({
  onSwipedLeft: () => nextTab(),
  onSwipedRight: () => prevTab(),
  onSwipedDown: () => refresh(),
});

<div {...handlers}>
  {content}
</div>
```

### 5. Pull-to-Refresh

**Component:** `PullToRefresh.tsx`

**Features:**
- Visual feedback during pull
- Smooth animations
- Configurable threshold
- Works on all scrollable containers

**Usage:**
```typescript
<PullToRefresh onRefresh={async () => {
  await refetchData();
}}>
  <TransactionList />
</PullToRefresh>
```

### 6. Mobile Analytics Dashboard

**Features:**
- Simplified charts for small screens
- Swipeable metric cards
- Collapsible sections
- Export to mobile-friendly formats

**Responsive Breakpoints:**
- Mobile: < 768px - Single column, stacked charts
- Tablet: 768px - 1024px - Two columns, medium charts
- Desktop: > 1024px - Full dashboard layout

### 7. QR Code Scanner

**Component:** `QRCodeScanner.tsx`

**Features:**
- Camera access for QR scanning
- Fallback to file upload
- Real-time validation
- Auto-submit on scan

**User Stories Supported:**
- US-013: QR Code Payment

**Implementation:**
```typescript
import { Html5QrcodeScanner } from "html5-qrcode";

const scanner = new Html5QrcodeScanner("reader", {
  fps: 10,
  qrbox: 250
});

scanner.render(onScanSuccess, onScanError);
```

### 8. Biometric Authentication

**Features:**
- Face ID / Touch ID support
- Fallback to PIN
- Secure credential storage
- Quick re-authentication

**Implementation:**
```typescript
// Check availability
const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();

// Register biometric
const credential = await navigator.credentials.create({
  publicKey: {
    challenge: new Uint8Array(32),
    rp: { name: "Payment Switch" },
    user: {
      id: new Uint8Array(16),
      name: user.email,
      displayName: user.name
    },
    pubKeyCredParams: [{ alg: -7, type: "public-key" }],
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      userVerification: "required"
    }
  }
});

// Authenticate
const assertion = await navigator.credentials.get({
  publicKey: {
    challenge: new Uint8Array(32),
    allowCredentials: [{ id: credential.rawId, type: "public-key" }],
    userVerification: "required"
  }
});
```

## Offline Capabilities

### 1. Offline Queue

**Purpose:** Queue actions when offline, sync when online

**Implementation:**
```typescript
// Queue action
if (!navigator.onLine) {
  await offlineQueue.add({
    type: "payment",
    data: paymentData,
    timestamp: Date.now()
  });
  showToast("Payment queued. Will process when online.");
  return;
}

// Sync when online
window.addEventListener("online", async () => {
  const queue = await offlineQueue.getAll();
  for (const item of queue) {
    await processQueuedItem(item);
    await offlineQueue.remove(item.id);
  }
});
```

### 2. Offline Data Access

**Cached Data:**
- Recent transactions (last 100)
- Merchant settings
- Analytics data (last 7 days)
- Payment methods

**Storage:**
- IndexedDB for structured data
- Cache API for API responses
- LocalStorage for preferences

### 3. Background Sync

**Use Cases:**
- Upload documents when online
- Submit forms
- Send analytics events

**Implementation:**
```typescript
// Register sync
await registration.sync.register("upload-documents");

// Handle sync event
self.addEventListener("sync", (event) => {
  if (event.tag === "upload-documents") {
    event.waitUntil(uploadPendingDocuments());
  }
});
```

## Performance Optimizations

### 1. Code Splitting

**Routes:**
```typescript
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Onboarding = lazy(() => import("./pages/Onboarding"));

<Suspense fallback={<LoadingSpinner />}>
  <Routes>
    <Route path="/dashboard" element={<Dashboard />} />
    <Route path="/analytics" element={<Analytics />} />
    <Route path="/onboarding" element={<Onboarding />} />
  </Routes>
</Suspense>
```

### 2. Image Optimization

**Techniques:**
- WebP format with JPEG fallback
- Responsive images with srcset
- Lazy loading below fold
- Blur placeholder while loading

```typescript
<img
  src="/images/hero.webp"
  srcSet="/images/hero-320.webp 320w,
          /images/hero-640.webp 640w,
          /images/hero-1280.webp 1280w"
  sizes="(max-width: 768px) 100vw, 50vw"
  loading="lazy"
  alt="Hero image"
/>
```

### 3. Virtual Scrolling

**For Long Lists:**
```typescript
import { FixedSizeList } from "react-window";

<FixedSizeList
  height={600}
  itemCount={transactions.length}
  itemSize={80}
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>
      <TransactionItem transaction={transactions[index]} />
    </div>
  )}
</FixedSizeList>
```

### 4. Debouncing and Throttling

**Search Input:**
```typescript
const debouncedSearch = useMemo(
  () => debounce((value: string) => {
    performSearch(value);
  }, 300),
  []
);

<input
  onChange={(e) => debouncedSearch(e.target.value)}
  placeholder="Search transactions..."
/>
```

## Accessibility

### 1. Touch Targets

**Minimum Size:** 44x44px for all interactive elements

```css
.touch-target {
  min-width: 44px;
  min-height: 44px;
  padding: 12px;
}
```

### 2. Screen Reader Support

**ARIA Labels:**
```typescript
<button
  aria-label="Retry payment"
  aria-describedby="retry-description"
>
  <RefreshCw />
</button>
<span id="retry-description" className="sr-only">
  Retry the failed payment transaction
</span>
```

### 3. Keyboard Navigation

**Focus Management:**
```typescript
// Trap focus in modal
const modalRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  const focusableElements = modalRef.current?.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  
  const firstElement = focusableElements?.[0] as HTMLElement;
  const lastElement = focusableElements?.[focusableElements.length - 1] as HTMLElement;
  
  const handleTab = (e: KeyboardEvent) => {
    if (e.key === "Tab") {
      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    }
  };
  
  document.addEventListener("keydown", handleTab);
  return () => document.removeEventListener("keydown", handleTab);
}, []);
```

## Testing

### 1. Lighthouse Scores

**Targets:**
- Performance: > 90
- Accessibility: 100
- Best Practices: 100
- SEO: > 90
- PWA: 100

### 2. Device Testing

**Test Devices:**
- iPhone 12/13/14 (iOS 15+)
- Samsung Galaxy S21/S22 (Android 12+)
- iPad Pro (iOS 15+)
- Various Android tablets

### 3. Network Conditions

**Test Scenarios:**
- Fast 3G
- Slow 3G
- Offline
- Flaky connection (intermittent)

### 4. Automated Tests

```typescript
describe("Mobile Payment Flow", () => {
  it("should complete payment on mobile", async () => {
    // Set mobile viewport
    await page.setViewport({ width: 375, height: 667 });
    
    // Navigate to checkout
    await page.goto("/checkout");
    
    // Fill payment form
    await page.type("#card-number", "4242424242424242");
    await page.type("#expiry", "12/25");
    await page.type("#cvc", "123");
    
    // Submit
    await page.click("#submit-payment");
    
    // Verify success
    await page.waitForSelector(".payment-success");
  });
});
```

## User Journey Mobile Implementations

### US-001: Merchant Onboarding (Mobile)

**Features:**
- Multi-step wizard with progress indicator
- Document upload via camera or file picker
- Auto-save drafts
- Mobile-optimized form fields

### US-006: Payment Processing (Mobile)

**Features:**
- Large, clear payment form
- Real-time card validation
- 3D Secure in modal
- Success animation

### US-011: Receipt Download (Mobile)

**Features:**
- Preview receipt in modal
- Download as PDF
- Share via native share sheet
- Email receipt option

### US-013: QR Code Payment (Mobile)

**Features:**
- QR code scanner
- Large QR code display
- Auto-refresh QR code
- Countdown timer for expiry

### US-017: Real-time Monitoring (Mobile)

**Features:**
- Simplified metric cards
- Swipeable charts
- Pull-to-refresh
- Push notifications for alerts

### US-024: Payment Status Tracking (Mobile)

**Features:**
- Visual timeline
- Real-time updates
- Large status icons
- Quick actions (retry, download)

## Deployment

### 1. Build for Production

```bash
# Build with PWA
pnpm build

# Verify service worker
ls dist/public/sw.js

# Verify manifest
ls dist/public/manifest.json
```

### 2. HTTPS Requirement

PWA requires HTTPS in production:

```nginx
server {
  listen 443 ssl http2;
  server_name payment-switch.com;
  
  ssl_certificate /path/to/cert.pem;
  ssl_certificate_key /path/to/key.pem;
  
  location / {
    root /var/www/payment-switch/dist/public;
    try_files $uri $uri/ /index.html;
  }
}
```

### 3. Service Worker Registration

Automatic via vite-plugin-pwa:

```typescript
// Auto-generated in dist/public/registerSW.js
import { registerSW } from "virtual:pwa-register";

registerSW({
  onNeedRefresh() {
    // Show update prompt
  },
  onOfflineReady() {
    // Show offline ready message
  }
});
```

## Monitoring

### 1. PWA Analytics

**Metrics to Track:**
- Install rate
- Standalone usage
- Offline usage
- Service worker cache hit rate
- Push notification engagement

### 2. Mobile Performance

**Metrics:**
- First Contentful Paint (FCP)
- Largest Contentful Paint (LCP)
- First Input Delay (FID)
- Cumulative Layout Shift (CLS)
- Time to Interactive (TTI)

### 3. Error Tracking

```typescript
// Track PWA errors
window.addEventListener("error", (event) => {
  analytics.track("pwa_error", {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno
  });
});

// Track service worker errors
navigator.serviceWorker.addEventListener("error", (event) => {
  analytics.track("sw_error", {
    message: event.message
  });
});
```

## Conclusion

The platform now has comprehensive PWA and mobile UI/UX support:

- ✅ Installable on all devices
- ✅ Offline-capable with intelligent caching
- ✅ Push notifications for real-time updates
- ✅ Mobile-optimized components for all user journeys
- ✅ Touch-friendly interfaces
- ✅ Biometric authentication
- ✅ QR code scanning
- ✅ Performance-optimized
- ✅ Accessible
- ✅ Production-ready

All 30 user stories now have mobile-first implementations integrated with the Temporal orchestrator.
