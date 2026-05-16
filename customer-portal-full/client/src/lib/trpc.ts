import { useState, useMemo, createContext, useContext, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const DEMO_MODE = true;

const TRPCContext = createContext<{ queryClient: any; client: any } | null>(null);

function useMockQuery(_input?: any, _opts?: any) {
  return { data: undefined, isLoading: false, isPending: false, error: null, refetch: () => Promise.resolve({ data: undefined }) };
}

function useMockMutation(_opts?: any) {
  const [isPending, setIsPending] = useState(false);
  return {
    mutate: (..._args: any[]) => {},
    mutateAsync: async (..._args: any[]) => ({} as any),
    isPending,
    isLoading: isPending,
    error: null,
    data: undefined,
    reset: () => {},
  };
}

function createDeepProxy(): any {
  const handler: ProxyHandler<any> = {
    get(_target, prop) {
      if (prop === "useQuery") return useMockQuery;
      if (prop === "useMutation") return useMockMutation;
      if (prop === "useUtils" || prop === "useContext") return () => new Proxy({}, handler);
      if (prop === "Provider") {
        return ({ children }: { children: ReactNode }) => children;
      }
      if (prop === "createClient") {
        return (_opts: any) => new Proxy({}, handler);
      }
      if (prop === "setData" || prop === "invalidate" || prop === "getData") {
        return () => {};
      }
      if (typeof prop === "symbol") return undefined;
      return new Proxy({}, handler);
    },
    apply() {
      return new Proxy({}, handler);
    },
  };
  return new Proxy(function(){} as any, handler);
}

export const trpc = createDeepProxy();
