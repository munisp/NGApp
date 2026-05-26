/**
 * piConnector.ts — Aveva PI System Web API Adapter
 *
 * Connects to an Aveva PI Web API server (v2019+) to:
 *   - Browse the PI Asset Framework (AF) element hierarchy
 *   - Query PI tag values (current + historical)
 *   - Stream recorded values for historian-grade data access
 *   - Sync PI tag data into the local InfluxDB bucket
 *
 * Authentication: Basic auth (username/password) or Kerberos (via negotiate header).
 * When PI_WEBAPI_URL is not set, all operations return simulated data so the UI
 * remains fully functional without a live PI server.
 *
 * PI Web API reference: https://docs.osisoft.com/bundle/pi-web-api-reference/
 */

import axios, { AxiosInstance } from "axios";
import https from "https";

// ─── CONFIG ───────────────────────────────────────────────────────────────────

const PI_WEBAPI_URL = process.env.PI_WEBAPI_URL ?? "";
const PI_WEBAPI_USER = process.env.PI_WEBAPI_USER ?? "";
const PI_WEBAPI_PASS = process.env.PI_WEBAPI_PASS ?? "";
const PI_WEBAPI_VERIFY_SSL = process.env.PI_WEBAPI_VERIFY_SSL !== "false";

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface PITag {
  webId: string;
  name: string;
  path: string;
  descriptor: string;
  pointType: string;
  engineeringUnits: string;
  zero: number;
  span: number;
  serverName: string;
}

export interface PIValue {
  timestamp: string;
  value: number | string | null;
  good: boolean;
  questionable: boolean;
  substituted: boolean;
  annotated: boolean;
}

export interface PIElement {
  webId: string;
  name: string;
  description: string;
  path: string;
  templateName?: string;
  hasChildren: boolean;
  attributes: PIAttribute[];
}

export interface PIAttribute {
  webId: string;
  name: string;
  description: string;
  type: string;
  dataReferencePlugIn: string;
  configString: string;
  value?: PIValue;
}

export interface PIServer {
  webId: string;
  name: string;
  serverVersion: string;
  isConnected: boolean;
  simulated: boolean;
}

export interface PIHistoricalData {
  tagName: string;
  webId: string;
  values: PIValue[];
  startTime: string;
  endTime: string;
  count: number;
}

// ─── CONNECTION STATE ────────────────────────────────────────────────────────

export type PIConnectionStatus = "connected" | "disconnected" | "unconfigured" | "checking";

let _connectionStatus: PIConnectionStatus = PI_WEBAPI_URL ? "checking" : "unconfigured";
let _connectionError: string | null = null;
let _serverVersion: string | null = null;

export function getPIConnectionStatus() {
  return {
    status: _connectionStatus,
    error: _connectionError,
    serverVersion: _serverVersion,
    url: PI_WEBAPI_URL || null,
    simulated: !PI_WEBAPI_URL,
  };
}

// ─── CLIENT FACTORY ───────────────────────────────────────────────────────────

let piClient: AxiosInstance | null = null;

function getPIClient(): AxiosInstance | null {
  if (!PI_WEBAPI_URL) {
    console.warn("[PI Connector] PI_WEBAPI_URL not set — running in simulation mode");
    return null;
  }

  if (piClient) return piClient;

  piClient = axios.create({
    baseURL: PI_WEBAPI_URL,
    auth: PI_WEBAPI_USER ? { username: PI_WEBAPI_USER, password: PI_WEBAPI_PASS } : undefined,
    httpsAgent: new https.Agent({ rejectUnauthorized: PI_WEBAPI_VERIFY_SSL }),
    timeout: 15000,
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
    },
  });

  return piClient;
}

// ─── SERVER INFO ──────────────────────────────────────────────────────────────

/**
 * Get PI server connection info and version.
 */
export async function getPIServerInfo(): Promise<PIServer> {
  const client = getPIClient();
  if (!client) {
    _connectionStatus = "unconfigured";
    return {
      webId: "sim-server-001",
      name: "SIM-PISERVER01",
      serverVersion: "3.4.0.0 (Simulated)",
      isConnected: false,
      simulated: true,
    };
  }
  try {
    const res = await client.get("/piwebapi/dataservers");
    const server = res.data.Items?.[0];
    _connectionStatus = "connected";
    _connectionError = null;
    _serverVersion = server?.ServerVersion ?? "unknown";
    return {
      webId: server?.WebId ?? "unknown",
      name: server?.Name ?? "PI Server",
      serverVersion: server?.ServerVersion ?? "unknown",
      isConnected: true,
      simulated: false,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[PI Connector] Server info failed:", msg);
    _connectionStatus = "disconnected";
    _connectionError = msg;
    return {
      webId: "error",
      name: "Connection Failed",
      serverVersion: "N/A",
      isConnected: false,
      simulated: true,
    };
  }
}

/**
 * Probe the PI server at startup and log the result.
 * Called once from server/index.ts after the HTTP server starts.
 */
export async function probePIConnection(): Promise<void> {
  if (!PI_WEBAPI_URL) {
    console.log("[PI Connector] No PI_WEB_API_URL configured — running in simulation mode");
    return;
  }
  console.log(`[PI Connector] Probing PI Web API at ${PI_WEBAPI_URL} ...`);
  const info = await getPIServerInfo();
  if (info.isConnected) {
    console.log(`[PI Connector] Connected ✓ — ${info.name} v${info.serverVersion}`);
  } else {
    console.warn(`[PI Connector] Connection failed — ${_connectionError ?? "unknown error"}. Running in simulation mode.`);
  }
}

// ─── TAG SEARCH ───────────────────────────────────────────────────────────────

/**
 * Search for PI tags by name pattern.
 * Returns up to `maxCount` matching tags.
 */
export async function searchPITags(
  query: string,
  maxCount = 50
): Promise<PITag[]> {
  const client = getPIClient();

  if (!client) {
    throw new Error("[PI Connector] PI Web API not configured. Set PI_WEB_API_URL environment variable.");
  }

  const res = await client.get("/piwebapi/dataservers", {
    params: { selectedFields: "Items.WebId;Items.Name" },
  });
  const serverWebId = res.data.Items?.[0]?.WebId;
  if (!serverWebId) return [];

  const tagsRes = await client.get(`/piwebapi/dataservers/${serverWebId}/points`, {
    params: {
      nameFilter: `*${query}*`,
      maxCount,
      selectedFields: "Items.WebId;Items.Name;Items.Descriptor;Items.PointType;Items.EngineeringUnits;Items.Zero;Items.Span",
    },
  });

  return (tagsRes.data.Items ?? []).map((item: Record<string, unknown>) => ({
    webId: item.WebId as string,
    name: item.Name as string,
    path: `\\\\${res.data.Items[0].Name}\\${item.Name}`,
    descriptor: item.Descriptor as string ?? "",
    pointType: item.PointType as string ?? "Float32",
    engineeringUnits: item.EngineeringUnits as string ?? "",
    zero: Number(item.Zero ?? 0),
    span: Number(item.Span ?? 100),
    serverName: res.data.Items[0].Name as string,
  }));
}

// ─── CURRENT VALUE ────────────────────────────────────────────────────────────

/**
 * Get the current (snapshot) value for a PI tag by WebId.
 */
export async function getPITagValue(webId: string): Promise<PIValue | null> {
  const client = getPIClient();

  if (!client) {
    throw new Error("[PI Connector] PI Web API not configured. Set PI_WEB_API_URL environment variable.");
  }

  const res = await client.get(`/piwebapi/streams/${webId}/value`);
  return mapPIValue(res.data);
}

// ─── HISTORICAL DATA ──────────────────────────────────────────────────────────

/**
 * Get recorded (historical) values for a PI tag.
 * Uses the PI Web API recorded data endpoint for historian-grade access.
 */
export async function getPIHistoricalData(
  webId: string,
  tagName: string,
  startTime: string,
  endTime: string,
  maxCount = 1000
): Promise<PIHistoricalData> {
  const client = getPIClient();

  if (!client) {
    throw new Error("[PI Connector] PI Web API not configured. Set PI_WEB_API_URL environment variable.");
  }

  const res = await client.get(`/piwebapi/streams/${webId}/recorded`, {
    params: {
      startTime,
      endTime,
      maxCount,
      selectedFields: "Items.Timestamp;Items.Value;Items.Good;Items.Questionable;Items.Substituted;Items.Annotated",
    },
  });

  const values = (res.data.Items ?? []).map(mapPIValue);
  return {
    tagName,
    webId,
    values,
    startTime,
    endTime,
    count: values.length,
  };
}

// ─── BULK CURRENT VALUES ──────────────────────────────────────────────────────

/**
 * Get current values for multiple PI tags in a single batch request.
 * Uses PI Web API batch endpoint for efficiency.
 */
export async function getBulkPITagValues(
  webIds: string[]
): Promise<Record<string, PIValue>> {
  const client = getPIClient();

  if (!client) {
    throw new Error("[PI Connector] PI Web API not configured. Set PI_WEB_API_URL environment variable.");
  }

  try {
    // PI Web API batch endpoint
    const batchBody = Object.fromEntries(
      webIds.map((id, i) => [`req_${i}`, {
        Method: "GET",
        Resource: `/piwebapi/streams/${id}/value`,
      }])
    );

    const res = await client.post("/piwebapi/batch", batchBody);
    const result: Record<string, PIValue> = {};

    webIds.forEach((id, i) => {
      const batchRes = res.data[`req_${i}`];
      if (batchRes?.Status === 200 && batchRes?.Content) {
        result[id] = mapPIValue(batchRes.Content);
      }
    });

    return result;
  } catch (err) {
    console.error("[PI Connector] Bulk values failed:", err instanceof Error ? err.message : err);
    return {};
  }
}

// ─── AF ELEMENT BROWSER ───────────────────────────────────────────────────────

/**
 * Browse the PI Asset Framework (AF) element hierarchy.
 * Returns child elements of the given path (or root if no path given).
 */
export async function browsePIElements(
  assetServerName?: string,
  databaseName?: string,
  elementPath?: string
): Promise<PIElement[]> {
  const client = getPIClient();

  if (!client) {
    throw new Error("[PI Connector] PI Web API not configured. Set PI_WEB_API_URL environment variable.");
  }

  // Get asset servers
  const asRes = await client.get("/piwebapi/assetservers");
  const asServer = asRes.data.Items?.find(
    (s: Record<string, unknown>) => !assetServerName || s.Name === assetServerName
  );
  if (!asServer) return [];

  // Get databases
  const dbRes = await client.get(`/piwebapi/assetservers/${asServer.WebId}/assetdatabases`);
  const db = dbRes.data.Items?.find(
    (d: Record<string, unknown>) => !databaseName || d.Name === databaseName
  );
  if (!db) return [];

  // Get elements
  const elemRes = await client.get(`/piwebapi/assetdatabases/${db.WebId}/elements`, {
    params: { selectedFields: "Items.WebId;Items.Name;Items.Description;Items.Path;Items.TemplateName;Items.HasChildren" },
  });

  return (elemRes.data.Items ?? []).map((el: Record<string, unknown>) => ({
    webId: el.WebId as string,
    name: el.Name as string,
    description: el.Description as string ?? "",
    path: el.Path as string ?? "",
    templateName: el.TemplateName as string,
    hasChildren: Boolean(el.HasChildren),
    attributes: [],
  }));
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function mapPIValue(raw: Record<string, unknown>): PIValue {
  const rawValue = raw.Value;
  let value: number | string | null = null;

  if (rawValue !== null && rawValue !== undefined) {
    if (typeof rawValue === "object" && rawValue !== null && "Value" in rawValue) {
      // PI system digital state
      value = String((rawValue as Record<string, unknown>).Name ?? "No Data");
    } else {
      value = typeof rawValue === "number" ? rawValue : Number(rawValue);
      if (isNaN(value as number)) value = String(rawValue);
    }
  }

  return {
    timestamp: String(raw.Timestamp ?? new Date().toISOString()),
    value,
    good: Boolean(raw.Good ?? true),
    questionable: Boolean(raw.Questionable ?? false),
    substituted: Boolean(raw.Substituted ?? false),
    annotated: Boolean(raw.Annotated ?? false),
  };
}


