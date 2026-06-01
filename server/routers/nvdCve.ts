import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";

// ─── NIST NVD API v2 types ────────────────────────────────────────────────────

interface NvdCveItem {
  cve: {
    id: string;
    published: string;
    lastModified: string;
    vulnStatus: string;
    descriptions: Array<{ lang: string; value: string }>;
    metrics?: {
      cvssMetricV31?: Array<{
        cvssData: { baseScore: number; baseSeverity: string; vectorString: string };
        exploitabilityScore: number;
        impactScore: number;
      }>;
      cvssMetricV2?: Array<{
        cvssData: { baseScore: number; baseSeverity: string };
      }>;
    };
    references?: Array<{ url: string; source: string }>;
    configurations?: unknown;
  };
}

interface NvdApiResponse {
  resultsPerPage: number;
  startIndex: number;
  totalResults: number;
  format: string;
  version: string;
  timestamp: string;
  vulnerabilities: NvdCveItem[];
}

// ─── ICS/OT-relevant keyword list ────────────────────────────────────────────

const ICS_KEYWORDS = [
  "SCADA",
  "PLC",
  "HMI",
  "OPC",
  "Modbus",
  "DNP3",
  "IEC 61850",
  "industrial control",
  "Siemens",
  "Rockwell",
  "Schneider",
  "ABB",
  "Honeywell",
  "Emerson",
  "Yokogawa",
  "wellhead",
  "RTU",
];

function getSeverityColor(score: number): string {
  if (score >= 9.0) return "CRITICAL";
  if (score >= 7.0) return "HIGH";
  if (score >= 4.0) return "MEDIUM";
  return "LOW";
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const nvdCveRouter = router({
  // Fetch latest ICS/OT-relevant CVEs from NIST NVD API v2
  fetchLatest: protectedProcedure
    .input(z.object({
      keyword: z.string().optional().default("SCADA"),
      resultsPerPage: z.number().min(1).max(50).optional().default(20),
    }))
    .query(async ({ input }) => {
      try {
        const params = new URLSearchParams({
          keywordSearch: input.keyword,
          resultsPerPage: String(input.resultsPerPage),
          startIndex: "0",
        });

        const url = `https://services.nvd.nist.gov/rest/json/cves/2.0?${params}`;

        const response = await fetch(url, {
          headers: {
            "Accept": "application/json",
            "User-Agent": "OG-RMM-Platform/3.0 (security@og-rmm.platform)",
          },
          signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
          throw new Error(`NVD API returned ${response.status}: ${response.statusText}`);
        }

        const data: NvdApiResponse = await response.json();

        const cves = data.vulnerabilities.map((item) => {
          const cve = item.cve;
          const description =
            cve.descriptions.find((d) => d.lang === "en")?.value || "No description available.";

          // Extract CVSS score (prefer v3.1, fall back to v2)
          const cvssV31 = cve.metrics?.cvssMetricV31?.[0];
          const cvssV2 = cve.metrics?.cvssMetricV2?.[0];
          const cvssScore = cvssV31?.cvssData.baseScore ?? cvssV2?.cvssData.baseScore ?? 0;
          const severity = cvssV31?.cvssData.baseSeverity ?? getSeverityColor(cvssScore);

          // Determine if ICS/OT relevant
          const isIcsRelevant = ICS_KEYWORDS.some(
            (kw) =>
              description.toLowerCase().includes(kw.toLowerCase()) ||
              cve.id.toLowerCase().includes(kw.toLowerCase())
          );

          return {
            cveId: cve.id,
            published: cve.published,
            lastModified: cve.lastModified,
            vulnStatus: cve.vulnStatus,
            description: description.length > 400 ? description.substring(0, 400) + "…" : description,
            cvssScore,
            severity: severity.toUpperCase() as "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO",
            vectorString: cvssV31?.cvssData.vectorString ?? null,
            exploitabilityScore: cvssV31?.exploitabilityScore ?? null,
            impactScore: cvssV31?.impactScore ?? null,
            references: (cve.references ?? []).slice(0, 3).map((r) => r.url),
            isIcsRelevant,
            patchAvailable: cve.vulnStatus === "Analyzed" || cve.vulnStatus === "Modified",
          };
        });

        // Sort: ICS-relevant first, then by CVSS score descending
        cves.sort((a, b) => {
          if (a.isIcsRelevant !== b.isIcsRelevant) return a.isIcsRelevant ? -1 : 1;
          return b.cvssScore - a.cvssScore;
        });

        return {
          success: true,
          totalResults: data.totalResults,
          fetchedAt: new Date().toISOString(),
          keyword: input.keyword,
          cves,
          icsRelevantCount: cves.filter((c) => c.isIcsRelevant).length,
          criticalCount: cves.filter((c) => c.severity === "CRITICAL").length,
          highCount: cves.filter((c) => c.severity === "HIGH").length,
        };
      } catch (error) {
        console.error("[NVD CVE] Fetch failed:", error);
        // Return graceful fallback — UI will show stale data indicator
        return {
          success: false,
          totalResults: 0,
          fetchedAt: new Date().toISOString(),
          keyword: input.keyword,
          cves: [],
          icsRelevantCount: 0,
          criticalCount: 0,
          highCount: 0,
          error: error instanceof Error ? error.message : "Unknown error fetching CVE data",
        };
      }
    }),

  // Fetch CVEs for a specific keyword (for asset-specific searches)
  searchByKeyword: protectedProcedure
    .input(z.object({
      keyword: z.string().min(2).max(100),
    }))
    .query(async ({ input }) => {
      try {
        const params = new URLSearchParams({
          keywordSearch: input.keyword,
          resultsPerPage: "10",
        });

        const response = await fetch(
          `https://services.nvd.nist.gov/rest/json/cves/2.0?${params}`,
          {
            headers: { "Accept": "application/json" },
            signal: AbortSignal.timeout(8000),
          }
        );

        if (!response.ok) throw new Error(`NVD API ${response.status}`);

        const data: NvdApiResponse = await response.json();

        return {
          success: true,
          keyword: input.keyword,
          totalResults: data.totalResults,
          cves: data.vulnerabilities.slice(0, 10).map((item) => ({
            cveId: item.cve.id,
            description: item.cve.descriptions.find((d) => d.lang === "en")?.value?.substring(0, 200) ?? "",
            cvssScore: item.cve.metrics?.cvssMetricV31?.[0]?.cvssData.baseScore ?? 0,
            severity: (item.cve.metrics?.cvssMetricV31?.[0]?.cvssData.baseSeverity ?? "INFO").toUpperCase(),
            published: item.cve.published,
          })),
        };
      } catch {
        return { success: false, keyword: input.keyword, totalResults: 0, cves: [], error: "Search failed" };
      }
    }),
});
