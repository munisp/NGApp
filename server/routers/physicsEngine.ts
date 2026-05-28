/**
 * Physics Engine Router — Proxy to Rust physics-engine service (port 4001)
 *
 * Exposes all 9 Rust endpoints as tRPC procedures:
 *   - nodal:         IPR/VLP nodal analysis (Vogel + Beggs-Brill)
 *   - decline:       Arps decline curve (exponential / hyperbolic / harmonic)
 *   - sensitivity:   Tornado sensitivity chart
 *   - turnerLoading: Gas well liquid loading (Turner + Coleman)
 *   - heavyOil:      SAGD/CSS steam chamber model
 *   - geomechanics:  1D MEM wellbore stability (Zoback-Eaton)
 *   - sandOnset:     Critical drawdown pressure (Morita-Willson)
 *   - coupled:       v54.0 Coupled multi-physics solver (nodal+geo+sand)
 *
 * Also exports pinnRouter for PINN surrogate ML service (port 4003).
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { ENV } from "../_core/env";


const PHYSICS_URL = ENV.physicsUrl;

async function callPhysics<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${PHYSICS_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Physics engine error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export const physicsEngineRouter = router({
  // ── Health ──────────────────────────────────────────────────────────────
  health: protectedProcedure.query(async () => {
    try {
      const res = await fetch(`${PHYSICS_URL}/health`, { signal: AbortSignal.timeout(3000) });
      return res.json();
    } catch {
      return { status: "offline", error: "Physics engine not reachable" };
    }
  }),

  // ── Nodal Analysis (IPR/VLP) ─────────────────────────────────────────────
  nodal: protectedProcedure
    .input(z.object({
      wellId:             z.string(),
      reservoirPressure:  z.number().min(100).max(20000),
      qMax:               z.number().min(10).max(50000),
      skinFactor:         z.number().min(-5).max(50).default(0),
      espFrequencyHz:     z.number().min(20).max(70).default(60),
      wellheadPressure:   z.number().min(50).max(3000).default(200),
      tvdFt:              z.number().min(500).max(30000).default(8000),
      fluidGradient:      z.number().min(0.2).max(0.6).default(0.433),
      waterCut:           z.number().min(0).max(1).default(0.25),
      gorScfPerBbl:       z.number().min(0).max(5000).default(500),
      points:             z.number().min(10).max(200).default(60),
    }))
    .mutation(async ({ input }) => {
      return callPhysics("/compute/nodal", {
        well_id:            input.wellId,
        reservoir_pressure: input.reservoirPressure,
        q_max:              input.qMax,
        skin_factor:        input.skinFactor,
        esp_frequency_hz:   input.espFrequencyHz,
        wellhead_pressure:  input.wellheadPressure,
        tvd_ft:             input.tvdFt,
        fluid_gradient:     input.fluidGradient,
        water_cut:          input.waterCut,
        gor_scf_per_bbl:    input.gorScfPerBbl,
        points:             input.points,
      });
    }),

  // ── Arps Decline Curve ───────────────────────────────────────────────────
  decline: protectedProcedure
    .input(z.object({
      wellId:  z.string(),
      qi:      z.number().min(1).max(50000).describe("Initial rate BPD"),
      di:      z.number().min(0.001).max(0.5).describe("Initial decline rate fraction/month"),
      b:       z.number().min(0).max(1).describe("Arps b-factor (0=exp, 1=harmonic)"),
      months:  z.number().min(1).max(360).default(60),
    }))
    .mutation(async ({ input }) => {
      return callPhysics("/compute/decline", {
        well_id: input.wellId,
        qi:      input.qi,
        di:      input.di,
        b:       input.b,
        months:  input.months,
      });
    }),

  // ── Sensitivity / Tornado Chart ──────────────────────────────────────────
  sensitivity: protectedProcedure
    .input(z.object({
      wellId:            z.string(),
      baseQBpd:          z.number(),
      reservoirPressure: z.number(),
      qMax:              z.number(),
      skinFactor:        z.number(),
      espFrequencyHz:    z.number(),
      fluidGradient:     z.number(),
      tvdFt:             z.number(),
      wellheadPressure:  z.number(),
      waterCut:          z.number(),
      variationPct:      z.number().min(5).max(50).default(15),
    }))
    .mutation(async ({ input }) => {
      return callPhysics("/compute/sensitivity", {
        well_id:            input.wellId,
        base_q_bpd:         input.baseQBpd,
        reservoir_pressure: input.reservoirPressure,
        q_max:              input.qMax,
        skin_factor:        input.skinFactor,
        esp_frequency_hz:   input.espFrequencyHz,
        fluid_gradient:     input.fluidGradient,
        tvd_ft:             input.tvdFt,
        wellhead_pressure:  input.wellheadPressure,
        water_cut:          input.waterCut,
        variation_pct:      input.variationPct,
      });
    }),

  // ── Turner Liquid Loading ────────────────────────────────────────────────
  turnerLoading: protectedProcedure
    .input(z.object({
      wellId:                z.string(),
      tubingIdIn:            z.number().min(1).max(6).default(2.441),
      wellheadPressurePsia:  z.number().min(50).max(5000).default(800),
      wellheadTempF:         z.number().min(50).max(300).default(120),
      gasRateMscfd:          z.number().min(0).max(100000).default(1200),
      gasSpecificGravity:    z.number().min(0.5).max(1.0).default(0.65),
      surfaceTensionDynesCm: z.number().min(10).max(80).default(60),
      liquidDensityLbFt3:    z.number().min(30).max(80).default(67),
      useColeman:            z.boolean().default(false),
    }))
    .mutation(async ({ input }) => {
      return callPhysics("/compute/turner-loading", {
        well_id:                    input.wellId,
        tubing_id_in:               input.tubingIdIn,
        wellhead_pressure_psia:     input.wellheadPressurePsia,
        wellhead_temp_f:            input.wellheadTempF,
        gas_rate_mscfd:             input.gasRateMscfd,
        gas_specific_gravity:       input.gasSpecificGravity,
        surface_tension_dynes_cm:   input.surfaceTensionDynesCm,
        liquid_density_lb_ft3:      input.liquidDensityLbFt3,
        use_coleman:                input.useColeman,
      });
    }),

  // ── Heavy Oil (SAGD/CSS) ─────────────────────────────────────────────────
  heavyOil: protectedProcedure
    .input(z.object({
      wellId:                  z.string(),
      reservoirThicknessFt:    z.number().min(10).max(500).default(80),
      steamTempF:              z.number().min(300).max(700).default(480),
      reservoirTempF:          z.number().min(40).max(200).default(55),
      oilViscosityCp:          z.number().min(100).max(1000000).default(50000),
      steamInjectionRateBpd:   z.number().min(10).max(5000).default(400),
      steamQuality:            z.number().min(0.5).max(1.0).default(0.8),
      horizontalWellLengthFt:  z.number().min(100).max(5000).default(2500),
      reservoirPorosityFrac:   z.number().min(0.1).max(0.5).default(0.33),
      oilSaturationFrac:       z.number().min(0.3).max(0.9).default(0.75),
      operatingMode:           z.enum(["SAGD", "CSS", "HYBRID"]).default("SAGD"),
    }))
    .mutation(async ({ input }) => {
      return callPhysics("/compute/heavy-oil", {
        well_id:                    input.wellId,
        reservoir_thickness_ft:     input.reservoirThicknessFt,
        steam_temp_f:               input.steamTempF,
        reservoir_temp_f:           input.reservoirTempF,
        oil_viscosity_cp:           input.oilViscosityCp,
        steam_injection_rate_bpd:   input.steamInjectionRateBpd,
        steam_quality:              input.steamQuality,
        horizontal_well_length_ft:  input.horizontalWellLengthFt,
        reservoir_porosity_frac:    input.reservoirPorosityFrac,
        oil_saturation_frac:        input.oilSaturationFrac,
        operating_mode:             input.operatingMode,
      });
    }),

  // ── Wellbore Geomechanics (1D MEM) ──────────────────────────────────────
  geomechanics: protectedProcedure
    .input(z.object({
      wellId:              z.string(),
      tvdFt:               z.number().min(500).max(30000),
      avgBulkDensityGcc:   z.number().min(1.8).max(3.0).default(2.35),
      porePressurePpg:     z.number().min(7).max(20).optional(),
      lotPressurePpg:      z.number().min(8).max(22).optional(),
      ucsPsi:              z.number().min(500).max(30000).default(3000),
      frictionAngleDeg:    z.number().min(15).max(50).default(30),
      biotCoefficient:     z.number().min(0.3).max(1.0).default(0.8),
      poissonRatio:        z.number().min(0.1).max(0.45).default(0.25),
      inclinationDeg:      z.number().min(0).max(90).default(0),
      azimuthDeg:          z.number().min(0).max(360).default(0),
      currentMudWeightPpg: z.number().min(7).max(22).default(10.5),
    }))
    .mutation(async ({ input }) => {
      return callPhysics("/compute/geomechanics", {
        well_id:                input.wellId,
        tvd_ft:                 input.tvdFt,
        avg_bulk_density_gcc:   input.avgBulkDensityGcc,
        pore_pressure_ppg:      input.porePressurePpg,
        lot_pressure_ppg:       input.lotPressurePpg,
        ucs_psi:                input.ucsPsi,
        friction_angle_deg:     input.frictionAngleDeg,
        biot_coefficient:       input.biotCoefficient,
        poisson_ratio:          input.poissonRatio,
        inclination_deg:        input.inclinationDeg,
        azimuth_deg:            input.azimuthDeg,
        current_mud_weight_ppg: input.currentMudWeightPpg,
      });
    }),

  // ── Sand Onset (Critical Drawdown) ──────────────────────────────────────
  sandOnset: protectedProcedure
    .input(z.object({
      wellId:                  z.string(),
      tvdFt:                   z.number().min(500).max(30000),
      reservoirPressurePsia:   z.number().min(200).max(15000),
      bhfpPsia:                z.number().min(100).max(14000),
      ucsPsi:                  z.number().min(200).max(20000),
      frictionAngleDeg:        z.number().min(15).max(50).default(30),
      biotCoefficient:         z.number().min(0.3).max(1.0).default(0.8),
      poissonRatio:            z.number().min(0.1).max(0.45).default(0.25),
      bulkDensityGcc:          z.number().min(1.8).max(3.0).default(2.3),
      perforationLengthFt:     z.number().min(1).max(200).default(20),
      perforationDiameterIn:   z.number().min(0.2).max(1.5).default(0.5),
      waterCut:                z.number().min(0).max(1).default(0),
      currentRateBpd:          z.number().min(0).max(50000),
      sandRateMgL:             z.number().optional(),
      completionType:          z.enum(["OPEN_HOLE", "CASED_PERFORATED", "GRAVEL_PACK", "FRAC_PACK", "EXPANDABLE_SAND_SCREEN", "STANDALONE_SCREEN"]).default("CASED_PERFORATED"),
    }))
    .mutation(async ({ input }) => {
      return callPhysics("/compute/sand-onset", {
        well_id:                  input.wellId,
        tvd_ft:                   input.tvdFt,
        reservoir_pressure_psia:  input.reservoirPressurePsia,
        bhfp_psia:                input.bhfpPsia,
        ucs_psi:                  input.ucsPsi,
        friction_angle_deg:       input.frictionAngleDeg,
        biot_coefficient:         input.biotCoefficient,
        poisson_ratio:            input.poissonRatio,
        bulk_density_gcc:         input.bulkDensityGcc,
        perforation_length_ft:    input.perforationLengthFt,
        perforation_diameter_in:  input.perforationDiameterIn,
        water_cut:                input.waterCut,
        current_rate_bpd:         input.currentRateBpd,
        sand_rate_mg_l:           input.sandRateMgL,
        completion_type:          input.completionType,
      });
    }),

  // ── Coupled Multi-Physics Solver (v54.0) ─────────────────────────────────
  // Runs nodal + geomechanics + sand onset in a single coupled solve,
  // sharing state between modules to eliminate double-counting.
  coupled: protectedProcedure
    .input(z.object({
      wellId:                  z.string(),
      // Nodal inputs
      reservoirPressure:       z.number().min(100).max(20000),
      qMax:                    z.number().min(10).max(50000),
      skinFactor:              z.number().min(-5).max(50).default(0),
      espFrequencyHz:          z.number().min(0).max(70).default(0),
      wellheadPressure:        z.number().min(50).max(3000).default(200),
      tvdFt:                   z.number().min(500).max(30000).default(8000),
      fluidGradient:           z.number().min(0.2).max(0.6).default(0.433),
      waterCut:                z.number().min(0).max(1).default(0.25),
      gorScfPerBbl:            z.number().min(0).max(5000).default(500),
      // Geomechanics inputs
      avgBulkDensityGcc:       z.number().min(1.8).max(3.0).default(2.35),
      lotPressurePpg:          z.number().min(8).max(22).optional(),
      ucsPsi:                  z.number().min(200).max(20000).default(3000),
      frictionAngleDeg:        z.number().min(15).max(50).default(30),
      biotCoefficient:         z.number().min(0.3).max(1.0).default(0.8),
      poissonRatio:            z.number().min(0.1).max(0.45).default(0.25),
      currentMudWeightPpg:     z.number().min(7).max(22).default(10.5),
      // Sand onset inputs
      completionType:          z.enum(["OPEN_HOLE", "CASED_PERFORATED", "GRAVEL_PACK", "FRAC_PACK", "EXPANDABLE_SAND_SCREEN", "STANDALONE_SCREEN"]).default("CASED_PERFORATED"),
      perforationLengthFt:     z.number().min(1).max(200).default(20),
      perforationDiameterIn:   z.number().min(0.2).max(1.5).default(0.5),
      // Decline inputs
      declineRateDi:           z.number().min(0.001).max(0.5).default(0.08),
      bFactor:                 z.number().min(0).max(2).default(0.5),
    }))
    .mutation(async ({ input }) => {
      return callPhysics("/compute/coupled", {
        well_id:                  input.wellId,
        reservoir_pressure:       input.reservoirPressure,
        q_max:                    input.qMax,
        skin_factor:              input.skinFactor,
        esp_frequency_hz:         input.espFrequencyHz,
        wellhead_pressure:        input.wellheadPressure,
        tvd_ft:                   input.tvdFt,
        fluid_gradient:           input.fluidGradient,
        water_cut:                input.waterCut,
        gor_scf_per_bbl:          input.gorScfPerBbl,
        avg_bulk_density_gcc:     input.avgBulkDensityGcc,
        lot_pressure_ppg:         input.lotPressurePpg,
        ucs_psi:                  input.ucsPsi,
        friction_angle_deg:       input.frictionAngleDeg,
        biot_coefficient:         input.biotCoefficient,
        poisson_ratio:            input.poissonRatio,
        current_mud_weight_ppg:   input.currentMudWeightPpg,
        completion_type:          input.completionType,
        perforation_length_ft:    input.perforationLengthFt,
        perforation_diameter_in:  input.perforationDiameterIn,
        decline_rate_di:          input.declineRateDi,
        b_factor:                 input.bFactor,
      });
    }),
});

// ─── ML Service Router (PINN Surrogate) ──────────────────────────────────────

const ML_URL = ENV.mlUrl;

async function callML<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${ML_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ML service error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export const pinnRouter = router({
  // ── PINN Surrogate Inference ─────────────────────────────────────────────
  predict: protectedProcedure
    .input(z.object({
      wellId:                z.string(),
      reservoirPressure:     z.number().min(100).max(20000).default(3000),
      qMax:                  z.number().min(10).max(50000).default(1500),
      skinFactor:            z.number().min(-5).max(50).default(0),
      espFrequencyHz:        z.number().min(0).max(70).default(0),
      wellheadPressure:      z.number().min(50).max(3000).default(200),
      tvdFt:                 z.number().min(500).max(30000).default(8000),
      fluidGradient:         z.number().min(0.2).max(0.6).default(0.433),
      waterCut:              z.number().min(0).max(1).default(0.3),
      gorScfPerBbl:          z.number().min(0).max(5000).default(500),
      avgBulkDensityGcc:     z.number().min(1.8).max(3.0).default(2.4),
      lotPressurePpg:        z.number().min(8).max(22).default(14.5),
      currentMudWeightPpg:   z.number().min(7).max(22).default(10.5),
      ucsPsi:                z.number().min(200).max(20000).default(3000),
      frictionAngleDeg:      z.number().min(15).max(50).default(30),
      biotCoefficient:       z.number().min(0.3).max(1.0).default(0.8),
      declineRateDi:         z.number().min(0.001).max(0.5).default(0.08),
      bFactor:               z.number().min(0).max(2).default(0.5),
      mcSamples:             z.number().min(10).max(200).default(50),
    }))
    .mutation(async ({ input }) => {
      return callML("/pinn/predict", {
        reservoir_pressure:     input.reservoirPressure,
        q_max:                  input.qMax,
        skin_factor:            input.skinFactor,
        esp_frequency_hz:       input.espFrequencyHz,
        wellhead_pressure:      input.wellheadPressure,
        tvd_ft:                 input.tvdFt,
        fluid_gradient:         input.fluidGradient,
        water_cut:              input.waterCut,
        gor_scf_per_bbl:        input.gorScfPerBbl,
        avg_bulk_density_gcc:   input.avgBulkDensityGcc,
        lot_pressure_ppg:       input.lotPressurePpg,
        current_mud_weight_ppg: input.currentMudWeightPpg,
        ucs_psi:                input.ucsPsi,
        friction_angle_deg:     input.frictionAngleDeg,
        biot_coefficient:       input.biotCoefficient,
        decline_rate_di:        input.declineRateDi,
        b_factor:               input.bFactor,
        mc_samples:             input.mcSamples,
      });
    }),

  // ── PINN Training ────────────────────────────────────────────────────────
  train: protectedProcedure
    .input(z.object({
      nSamples:      z.number().min(50).max(2000).default(300),
      nEpochs:       z.number().min(10).max(1000).default(150),
      lr:            z.number().min(1e-5).max(0.1).default(1e-3),
      physicsWeight: z.number().min(0).max(1).default(0.1),
    }))
    .mutation(async ({ input }) => {
      return callML("/pinn/train", {
        n_samples:      input.nSamples,
        n_epochs:       input.nEpochs,
        lr:             input.lr,
        physics_weight: input.physicsWeight,
      });
    }),

  // ── PINN Status ──────────────────────────────────────────────────────────
  status: protectedProcedure.query(async () => {
    try {
      const res = await fetch(`${ML_URL}/pinn/status`, { signal: AbortSignal.timeout(5000) });
      return res.json();
    } catch {
      return { available: false, reason: "ML service not reachable" };
    }
  }),

  // ── PINN Model Save to S3 ───────────────────────────────────────────────────────────────────────
  saveModel: protectedProcedure.mutation(async () => {
    try {
      const res = await fetch(`${ML_URL}/pinn/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ s3_key: ENV.pinnModelS3Key, version_key: ENV.pinnVersionKey }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new Error(`ML service error ${res.status}`);
      return res.json();
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }),

  // ── PINN Model Load from S3 ───────────────────────────────────────────────────────────────────────
  loadModel: protectedProcedure.mutation(async () => {
    try {
      const res = await fetch(`${ML_URL}/pinn/load`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ s3_key: ENV.pinnModelS3Key }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new Error(`ML service error ${res.status}`);
      return res.json();
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }),

  // ── PINN Model Version History ─────────────────────────────────────────────────────────────────────
  modelVersions: protectedProcedure.query(async () => {
    try {
      const res = await fetch(`${ML_URL}/pinn/versions`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return { versions: [] };
      return res.json();
    } catch {
      return { versions: [] };
    }
  }),
});
