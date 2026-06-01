/**
 * tRPC client for OG-RMM React Native mobile app.
 *
 * The mobile app connects to the same tRPC backend as the PWA.
 * The base URL is configurable via environment variables or the
 * in-app Settings screen.
 *
 * Authentication uses the same JWT session cookie mechanism —
 * react-native-cookies handles cookie persistence across sessions.
 */
import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import { QueryClient } from "@tanstack/react-query";
import superjson from "superjson";
import type { AppRouter } from "../../../../server/routers";
import { getBaseUrl, getAuthToken } from "../utils/config";

// ── tRPC client ───────────────────────────────────────────────────────────────
export const trpc = createTRPCReact<AppRouter>();

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,        // 30s — matches Redis TTL
      gcTime: 5 * 60 * 1000,   // 5 min
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
    },
    mutations: {
      retry: 1,
    },
  },
});

export function createTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${getBaseUrl()}/api/trpc`,
        transformer: superjson,
        async headers() {
          const token = await getAuthToken();
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
      }),
    ],
  });
}
