/**
 * useNavBadges — Fetches live badge counts for sidebar navigation items.
 * Returns counts for alarms, permits, and other items that show badges.
 */
import { trpc } from "@/lib/trpc";

export interface NavBadgeCounts {
  [key: string]: number;
}

export function useNavBadges(): NavBadgeCounts {
  const counts: NavBadgeCounts = {};

  // Alarms: count unacknowledged
  const { data: alarmsData } = trpc.alarms.list.useQuery(
    { limit: 100 },
    {
      refetchInterval: 30_000,
      retry: false,
      staleTime: 15_000,
    }
  );
  if (alarmsData && Array.isArray(alarmsData)) {
    const unack = alarmsData.filter(
      (a) => (a as { state?: string }).state === "UNACKNOWLEDGED"
    ).length;
    if (unack > 0) counts["/alarms"] = unack;
  }

  // Permits: count pending/submitted
  const { data: permitsData } = trpc.permitToWork.list.useQuery(
    {},
    {
      refetchInterval: 60_000,
      retry: false,
      staleTime: 30_000,
    }
  );
  if (permitsData && Array.isArray(permitsData)) {
    const pending = permitsData.filter(
      (p) => {
        const status = (p as { status?: string }).status;
        return status === "PENDING_APPROVAL" || status === "DRAFT";
      }
    ).length;
    if (pending > 0) counts["/permits"] = pending;
  }

  return counts;
}
