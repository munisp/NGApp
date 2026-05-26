import { TRPCError } from "@trpc/server";
/**
 * piConnector router — Aveva PI System Web API tRPC procedures
 *
 * Exposes PI tag browsing, current values, historical data, and
 * AF element hierarchy through typed tRPC procedures.
 */

import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import {
  getPIServerInfo,
  searchPITags,
  getPITagValue,
  getPIHistoricalData,
  getBulkPITagValues,
  browsePIElements,
  getPIConnectionStatus,
} from "../piConnector";

export const piConnectorRouter = router({
  /**
   * Get PI server connection status and version info.
   */
  serverInfo: protectedProcedure.query(async () => {
    return getPIServerInfo();
  }),

  /**
   * Search for PI tags by name pattern.
   */
  searchTags: publicProcedure
    .input(z.object({
      query: z.string().default(""),
      maxCount: z.number().min(1).max(500).default(50),
    }))
    .query(async ({ input }) => {
      return searchPITags(input.query, input.maxCount);
    }),

  /**
   * Get the current (snapshot) value for a PI tag.
   */
  tagValue: publicProcedure
    .input(z.object({ webId: z.string() }))
    .query(async ({ input }) => {
      return getPITagValue(input.webId);
    }),

  /**
   * Get historical recorded values for a PI tag.
   */
  historicalData: publicProcedure
    .input(z.object({
      webId: z.string(),
      tagName: z.string(),
      startTime: z.string().default("*-24h"),
      endTime: z.string().default("*"),
      maxCount: z.number().min(1).max(10000).default(1000),
    }))
    .query(async ({ input }) => {
      return getPIHistoricalData(
        input.webId,
        input.tagName,
        input.startTime,
        input.endTime,
        input.maxCount
      );
    }),

  /**
   * Get current values for multiple PI tags in one batch request.
   */
  bulkValues: publicProcedure
    .input(z.object({ webIds: z.array(z.string()).max(200) }))
    .query(async ({ input }) => {
      return getBulkPITagValues(input.webIds);
    }),

  /**
   * Browse the PI Asset Framework (AF) element hierarchy.
   */
  browseElements: publicProcedure
    .input(z.object({
      assetServerName: z.string().optional(),
      databaseName: z.string().optional(),
      elementPath: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      return browsePIElements(
        input?.assetServerName,
        input?.databaseName,
        input?.elementPath
      );
    }),

  /**
   * Get the cached connection status (fast, no network call).
   */
  connectionStatus: protectedProcedure.query(() => {
    return getPIConnectionStatus();
  }),

  /**
   * Connection health check — returns whether PI Web API is reachable.
   */
  health: protectedProcedure.query(async () => {
    const PI_WEBAPI_URL = process.env.PI_WEBAPI_URL ?? "";
    const info = await getPIServerInfo();
    return {
      configured: !!PI_WEBAPI_URL,
      url: PI_WEBAPI_URL || "not configured",
      mode: PI_WEBAPI_URL ? "live" : "simulation",
      connected: info.isConnected,
      serverName: info.name,
      serverVersion: info.serverVersion,
    };
  }),

  /**
   * Test connection with provided credentials (admin only).
   * Used by the connection config form before saving secrets.
   */
  testConnection: protectedProcedure
    .input(z.object({
      url: z.string().url(),
      username: z.string().optional(),
      password: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      // Temporarily test the provided URL without persisting credentials
      const axios = (await import("axios")).default;
      const https = (await import("https")).default;
      try {
        const res = await axios.get(`${input.url}/piwebapi/dataservers`, {
          auth: input.username ? { username: input.username, password: input.password ?? "" } : undefined,
          httpsAgent: new https.Agent({ rejectUnauthorized: false }),
          timeout: 8000,
        });
        const server = res.data.Items?.[0];
        return {
          success: true,
          serverName: server?.Name ?? "PI Server",
          serverVersion: server?.ServerVersion ?? "unknown",
          message: "Connection successful",
        };
      } catch (err) {
        return {
          success: false,
          serverName: null,
          serverVersion: null,
          message: err instanceof Error ? err.message : "Connection failed",
        };
      }
    }),
});
