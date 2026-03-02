// ============================================================
// NEXCOM Exchange - Keycloak Authentication
// ============================================================

import { create } from "zustand";

const KEYCLOAK_URL = process.env.NEXT_PUBLIC_KEYCLOAK_URL || "http://localhost:8080";
const KEYCLOAK_REALM = process.env.NEXT_PUBLIC_KEYCLOAK_REALM || "nexcom";
const KEYCLOAK_CLIENT_ID = process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID || "nexcom-pwa";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
  accountTier: string;
  emailVerified: boolean;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  expiresAt: number;
}

interface AuthState {
  user: AuthUser | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  loginWithKeycloak: () => void;
  logout: () => Promise<void>;
  refreshTokens: () => Promise<boolean>;
  setUser: (user: AuthUser | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  checkAuth: () => boolean;
}

// PKCE helpers
function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  tokens: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(
        `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "password",
            client_id: KEYCLOAK_CLIENT_ID,
            username: email,
            password: password,
            scope: "openid profile email",
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error_description: "Login failed" }));
        set({ error: error.error_description || "Invalid credentials", isLoading: false });
        return false;
      }

      const tokens = await response.json();
      const user = parseJwtPayload(tokens.access_token);

      const authTokens: AuthTokens = {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        idToken: tokens.id_token,
        expiresAt: Date.now() + tokens.expires_in * 1000,
      };

      persistTokens(authTokens);

      set({
        tokens: authTokens,
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      return true;
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Network error",
        isLoading: false,
      });
      return false;
    }
  },

  loginWithKeycloak: () => {
    // PKCE Authorization Code Flow
    const codeVerifier = generateCodeVerifier();
    sessionStorage.setItem("pkce_code_verifier", codeVerifier);

    generateCodeChallenge(codeVerifier).then((codeChallenge) => {
      const params = new URLSearchParams({
        client_id: KEYCLOAK_CLIENT_ID,
        response_type: "code",
        scope: "openid profile email",
        redirect_uri: `${window.location.origin}/login/callback`,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        state: crypto.randomUUID(),
      });

      window.location.href = `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/auth?${params}`;
    });
  },

  logout: async () => {
    const { tokens } = get();
    try {
      if (tokens?.refreshToken) {
        await fetch(
          `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/logout`,
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: KEYCLOAK_CLIENT_ID,
              refresh_token: tokens.refreshToken,
            }),
          }
        );
      }
    } catch {
      // Logout best-effort
    } finally {
      clearPersistedTokens();
      set({ user: null, tokens: null, isAuthenticated: false, isLoading: false });
    }
  },

  refreshTokens: async () => {
    const { tokens } = get();
    if (!tokens?.refreshToken) return false;

    try {
      const response = await fetch(
        `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            client_id: KEYCLOAK_CLIENT_ID,
            refresh_token: tokens.refreshToken,
          }),
        }
      );

      if (!response.ok) {
        clearPersistedTokens();
        set({ user: null, tokens: null, isAuthenticated: false });
        return false;
      }

      const newTokens = await response.json();
      const user = parseJwtPayload(newTokens.access_token);

      const authTokens: AuthTokens = {
        accessToken: newTokens.access_token,
        refreshToken: newTokens.refresh_token,
        idToken: newTokens.id_token,
        expiresAt: Date.now() + newTokens.expires_in * 1000,
      };

      persistTokens(authTokens);
      set({ tokens: authTokens, user, isAuthenticated: true });
      return true;
    } catch {
      clearPersistedTokens();
      set({ user: null, tokens: null, isAuthenticated: false });
      return false;
    }
  },

  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  checkAuth: () => {
    const tokens = getPersistedTokens();
    if (!tokens) {
      set({ isLoading: false, isAuthenticated: false });
      return false;
    }

    if (tokens.expiresAt < Date.now()) {
      // Token expired, try refresh
      get().refreshTokens();
      return false;
    }

    const user = parseJwtPayload(tokens.accessToken);
    set({ tokens, user, isAuthenticated: true, isLoading: false });
    return true;
  },
}));

// ============================================================
// JWT Helpers
// ============================================================

function parseJwtPayload(token: string): AuthUser {
  try {
    const base64 = token.split(".")[1];
    const payload = JSON.parse(atob(base64));
    return {
      id: payload.sub || "",
      email: payload.email || "",
      name: payload.name || payload.preferred_username || "",
      roles: payload.realm_access?.roles || [],
      accountTier: payload.account_tier || "retail_trader",
      emailVerified: payload.email_verified || false,
    };
  } catch {
    return {
      id: "",
      email: "",
      name: "",
      roles: [],
      accountTier: "retail_trader",
      emailVerified: false,
    };
  }
}

// ============================================================
// Token Persistence
// ============================================================

function persistTokens(tokens: AuthTokens): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("nexcom_access_token", tokens.accessToken);
  localStorage.setItem("nexcom_refresh_token", tokens.refreshToken);
  localStorage.setItem("nexcom_id_token", tokens.idToken);
  localStorage.setItem("nexcom_token_expires", String(tokens.expiresAt));
}

function getPersistedTokens(): AuthTokens | null {
  if (typeof window === "undefined") return null;
  const accessToken = localStorage.getItem("nexcom_access_token");
  const refreshToken = localStorage.getItem("nexcom_refresh_token");
  const idToken = localStorage.getItem("nexcom_id_token");
  const expiresAt = localStorage.getItem("nexcom_token_expires");

  if (!accessToken || !refreshToken) return null;

  return {
    accessToken,
    refreshToken,
    idToken: idToken || "",
    expiresAt: Number(expiresAt) || 0,
  };
}

function clearPersistedTokens(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("nexcom_access_token");
  localStorage.removeItem("nexcom_refresh_token");
  localStorage.removeItem("nexcom_id_token");
  localStorage.removeItem("nexcom_token_expires");
}

// ============================================================
// Route Guard Utility
// ============================================================

export function requireAuth(): boolean {
  const { isAuthenticated } = useAuthStore.getState();
  return isAuthenticated;
}

export const PROTECTED_ROUTES = ["/", "/trade", "/markets", "/portfolio", "/orders", "/alerts", "/account", "/analytics"];
export const PUBLIC_ROUTES = ["/login"];
