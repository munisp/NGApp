/**
 * telemetrySimulator.ts — Background job that writes synthetic telemetry
 * readings every 30 seconds for all active wells.
 *
 * Uses realistic physics-based models:
 *  - Tubing/casing pressure follows sinusoidal diurnal variation
 *  - Flow rate drifts with Gaussian noise around a well-specific baseline
 *  - ESP parameters track frequency changes
 *  - Water cut slowly trends upward over time (reservoir depletion model)
 *  - GOR increases as reservoir pressure declines
 *
 * Publishes each batch to Redis so SSE subscribers (Digital Twin, Overview)
 * receive real-time updates without polling.
 */

import { getDb } from "./db";
import { wells, telemetryReadings } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { cachePublish } from "./cache";

const INTERVAL_MS = 30_000; // 30 seconds
let simulatorTimer: ReturnType<typeof setInterval> | null = null;

// Per-well state for continuity between ticks
const wellState: Map<string, WellSimState> = new Map();

interface WellSimState {
  tick: number;
  tubingPressureBase: number;
  casingPressureBase: number;
  flowRateBase: number;
  waterCutBase: number;
  gorBase: number;
  espFreqBase: number;
  bhpBase: number;
}

function gaussianNoise(mean: number, stddev: number): number {
  // Box-Muller transform
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1 + 1e-10)) * Math.cos(2 * Math.PI * u2);
  return mean + z * stddev;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function initWellState(wellId: string, wellData: any): WellSimState {
  // Use well physics params if available, otherwise use sensible defaults
  const reservoirP = wellData.reservoirPressurePsi ?? 3200;
  const qMax = wellData.qMaxBpd ?? 1500;
  const espFreq = wellData.espFrequencyHz ?? 50;

  return {
    tick: 0,
    tubingPressureBase: clamp(reservoirP * 0.35, 400, 2500),
    casingPressureBase: clamp(reservoirP * 0.28, 300, 2000),
    flowRateBase: clamp(qMax * 0.6, 100, 1200),
    waterCutBase: wellData.waterCutFraction ?? 0.25,
    gorBase: wellData.gorScfPerBbl ?? 450,
    espFreqBase: espFreq,
    bhpBase: clamp(reservoirP * 0.55, 800, 3500),
  };
}

async function simulateTick() {
  try {
    // Fetch all active wells
    const db = await getDb();
    if (!db) return;
    const activeWells = await db.select().from(wells).where(eq(wells.status, "ACTIVE"));

    if (activeWells.length === 0) return;

    const now = Date.now();
    const hourOfDay = new Date().getUTCHours();
    // Diurnal factor: slightly higher production during day shift (0.95-1.05)
    const diurnalFactor = 1 + 0.05 * Math.sin((hourOfDay / 24) * 2 * Math.PI);

    const readings = activeWells.map((well: typeof activeWells[0]) => {
      // Initialize or retrieve per-well state
      if (!wellState.has(well.wellId)) {
        wellState.set(well.wellId, initWellState(well.wellId, well));
      }
      const state = wellState.get(well.wellId)!;
      state.tick += 1;

      // Slow drift: water cut increases 0.001% per tick, GOR increases 0.05 scf/bbl per tick
      state.waterCutBase = clamp(state.waterCutBase + 0.00001, 0.05, 0.85);
      state.gorBase = clamp(state.gorBase + 0.005, 200, 2000);

      // Compute values with noise
      const tubingPressure = gaussianNoise(state.tubingPressureBase * diurnalFactor, state.tubingPressureBase * 0.02);
      const casingPressure = gaussianNoise(state.casingPressureBase * diurnalFactor, state.casingPressureBase * 0.015);
      const flowRate = gaussianNoise(state.flowRateBase * diurnalFactor, state.flowRateBase * 0.03);
      const waterCut = clamp(gaussianNoise(state.waterCutBase, 0.005), 0.05, 0.85);
      const gor = clamp(gaussianNoise(state.gorBase, state.gorBase * 0.02), 100, 3000);
      const espFreq = clamp(gaussianNoise(state.espFreqBase, 0.5), 30, 65);
      const espCurrent = clamp(gaussianNoise(espFreq * 1.8, 2), 40, 120);
      const espVibration = clamp(gaussianNoise(0.8, 0.15), 0.1, 3.5);
      const espMotorTemp = clamp(gaussianNoise(85, 5), 60, 130);
      const espInletPressure = clamp(gaussianNoise(state.bhpBase * 0.45, state.bhpBase * 0.02), 200, 2000);
      const espDischargePressure = clamp(gaussianNoise(state.tubingPressureBase * 1.8, 30), 500, 4000);
      const wellheadTemp = clamp(gaussianNoise(72, 3), 50, 120);
      const chokePosition = clamp(gaussianNoise(75, 5), 20, 100);
      const oilRate = clamp(flowRate * (1 - waterCut), 10, 1200);
      const waterRate = clamp(flowRate * waterCut, 5, 800);
      const gasRate = clamp(oilRate * gor / 1000, 0.1, 50);
      const bhp = clamp(gaussianNoise(state.bhpBase, state.bhpBase * 0.02), 500, 5000);
      const bht = clamp(gaussianNoise(180, 8), 120, 300);

      return {
        wellId: well.wellId,
        tubingPressure: Math.round(tubingPressure * 10) / 10,
        casingPressure: Math.round(casingPressure * 10) / 10,
        flowRate: Math.round(flowRate * 10) / 10,
        waterCut: Math.round(waterCut * 1000) / 1000,
        gasOilRatio: Math.round(gor),
        espCurrent: Math.round(espCurrent * 10) / 10,
        espFrequency: Math.round(espFreq * 10) / 10,
        espVibration: Math.round(espVibration * 100) / 100,
        espMotorTemp: Math.round(espMotorTemp * 10) / 10,
        espInletPressure: Math.round(espInletPressure * 10) / 10,
        espDischargePressure: Math.round(espDischargePressure * 10) / 10,
        wellheadTemp: Math.round(wellheadTemp * 10) / 10,
        chokePosition: Math.round(chokePosition * 10) / 10,
        oilRate: Math.round(oilRate * 10) / 10,
        gasRate: Math.round(gasRate * 100) / 100,
        waterRate: Math.round(waterRate * 10) / 10,
        gor: Math.round(gor),
        bhp: Math.round(bhp * 10) / 10,
        bht: Math.round(bht * 10) / 10,
        protocol: "MQTT" as const,
        quality: clamp(Math.round(gaussianNoise(97, 2)), 70, 100),
        recordedAt: new Date(),
      };
    });

    // Batch insert all readings
    await db.insert(telemetryReadings).values(readings);

    // Publish to Redis for SSE subscribers
    try {
      await cachePublish("og-rmm:telemetry", {
        type: "telemetry_batch",
        count: readings.length,
        timestamp: now,
        wells: readings.map((r: typeof readings[0]) => ({ wellId: r.wellId, flowRate: r.flowRate, tubingPressure: r.tubingPressure })),
      });
    } catch {
      // Redis publish failure is non-fatal
    }

    console.log(`[TelemetrySimulator] Wrote ${readings.length} readings for ${activeWells.length} wells`);
  } catch (err) {
    console.error("[TelemetrySimulator] Error writing telemetry:", err);
  }
}

export function startTelemetrySimulator() {
  if (simulatorTimer) return; // Already running

  console.log("[TelemetrySimulator] Starting — writing telemetry every 30s");

  // Write first batch immediately on startup
  simulateTick().catch(err => console.error("[TelemetrySimulator] Initial tick error:", err));

  simulatorTimer = setInterval(simulateTick, INTERVAL_MS);

  // Allow Node.js to exit even if this interval is running
  if (simulatorTimer.unref) simulatorTimer.unref();
}

export function stopTelemetrySimulator() {
  if (simulatorTimer) {
    clearInterval(simulatorTimer);
    simulatorTimer = null;
    console.log("[TelemetrySimulator] Stopped");
  }
}
