/**
 * InfluxDB 2.x client module for high-resolution SCADA telemetry queries.
 *
 * When INFLUXDB_URL is not set (local dev without Docker), all functions
 * gracefully return empty arrays so the caller can fall back to PostgreSQL.
 */

import { InfluxDB, QueryApi } from "@influxdata/influxdb-client";

const INFLUX_URL = process.env.INFLUXDB_URL ?? "";
const INFLUX_TOKEN = process.env.INFLUXDB_TOKEN ?? "ogrmm-influx-token-dev";
const INFLUX_ORG = process.env.INFLUXDB_ORG ?? "ogrmm";
const INFLUX_BUCKET = process.env.INFLUXDB_BUCKET ?? "telemetry";

let queryApi: QueryApi | null = null;

function getQueryApi(): QueryApi | null {
  if (!INFLUX_URL) return null;
  if (!queryApi) {
    const client = new InfluxDB({ url: INFLUX_URL, token: INFLUX_TOKEN });
    queryApi = client.getQueryApi(INFLUX_ORG);
  }
  return queryApi;
}

export interface InfluxTelemetryPoint {
  time: string;
  wellId: string;
  field: string;
  value: number;
}

/**
 * Query high-resolution telemetry from InfluxDB for a given well and time range.
 * Returns an empty array when InfluxDB is unavailable (graceful degradation).
 *
 * @param wellId  Well identifier used as the measurement tag
 * @param fields  Metric fields to retrieve (e.g. ['pressure', 'temperature'])
 * @param rangeHours  Look-back window in hours (default 1)
 * @param aggregateWindowSec  Aggregation window in seconds (default 10 for sub-minute resolution)
 */
export async function queryHighResolutionTelemetry(
  wellId: string,
  fields: string[] = ["pressure", "temperature", "flow_rate", "choke_position"],
  rangeHours = 1,
  aggregateWindowSec = 10
): Promise<InfluxTelemetryPoint[]> {
  const api = getQueryApi();
  if (!api) {
    console.warn("[InfluxDB] INFLUXDB_URL not set – skipping high-resolution query");
    return [];
  }

  const fieldFilter = fields.map((f) => `r["_field"] == "${f}"`).join(" or ");

  const flux = `
from(bucket: "${INFLUX_BUCKET}")
  |> range(start: -${rangeHours}h)
  |> filter(fn: (r) => r["_measurement"] == "well_telemetry")
  |> filter(fn: (r) => r["well_id"] == "${wellId}")
  |> filter(fn: (r) => ${fieldFilter})
  |> aggregateWindow(every: ${aggregateWindowSec}s, fn: mean, createEmpty: false)
  |> yield(name: "mean")
`;

  const results: InfluxTelemetryPoint[] = [];

  try {
    await new Promise<void>((resolve, reject) => {
      api.queryRows(flux, {
        next(row, tableMeta) {
          const obj = tableMeta.toObject(row);
          results.push({
            time: String(obj._time),
            wellId: String(obj.well_id ?? wellId),
            field: String(obj._field),
            value: Number(obj._value),
          });
        },
        error(err) {
          console.error("[InfluxDB] Query error:", err.message);
          reject(err);
        },
        complete() {
          resolve();
        },
      });
    });
  } catch {
    // Return empty on error so the caller can fall back to PostgreSQL
    return [];
  }

  return results;
}

/**
 * Check whether InfluxDB is reachable.
 */
export async function influxHealthCheck(): Promise<boolean> {
  if (!INFLUX_URL) return false;
  try {
    // Use a simple Flux query to test connectivity
    const client = new InfluxDB({ url: INFLUX_URL, token: INFLUX_TOKEN });
    const api = client.getQueryApi(INFLUX_ORG);
    await new Promise<void>((resolve, reject) => {
      api.queryRows('buckets()', {
        next() {},
        error(e) { reject(e); },
        complete() { resolve(); },
      });
    });
    return true;
  } catch {
    return false;
  }
}
