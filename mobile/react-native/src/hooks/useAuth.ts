/**
 * useAuth — Authentication state for the React Native app.
 * Mirrors the PWA's useAuth hook, backed by the same tRPC auth.me endpoint.
 */
import { useCallback } from "react";
import { trpc } from "../api/trpc";
import { clearAuthToken } from "../utils/config";

export function useAuth() {
  const { data: user, isLoading, error, refetch } = trpc.auth.me.useQuery(undefined, {
    retry: false,
    staleTime: 60_000,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: async () => {
      await clearAuthToken();
      await refetch();
    },
  });

  const logout = useCallback(() => {
    logoutMutation.mutate();
  }, [logoutMutation]);

  return {
    user: user ?? null,
    loading: isLoading,
    error,
    isAuthenticated: !!user,
    logout,
  };
}
