/**
 * Runtime configuration for the OG-RMM React Native app.
 * Base URL is stored in AsyncStorage so field engineers can
 * point the app at their on-premise deployment.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const DEFAULT_BASE_URL = "https://your-og-rmm-deployment.example.com";
const BASE_URL_KEY = "og_rmm_base_url";
const AUTH_TOKEN_KEY = "og_rmm_auth_token";

let _cachedBaseUrl: string | null = null;

export async function getBaseUrl(): Promise<string> {
  if (_cachedBaseUrl) return _cachedBaseUrl;
  const stored = await AsyncStorage.getItem(BASE_URL_KEY);
  _cachedBaseUrl = stored ?? DEFAULT_BASE_URL;
  return _cachedBaseUrl;
}

export async function setBaseUrl(url: string): Promise<void> {
  _cachedBaseUrl = url;
  await AsyncStorage.setItem(BASE_URL_KEY, url);
}

export async function getAuthToken(): Promise<string | null> {
  return AsyncStorage.getItem(AUTH_TOKEN_KEY);
}

export async function setAuthToken(token: string): Promise<void> {
  await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
}

export async function clearAuthToken(): Promise<void> {
  await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
}
