/**
 * physicsEngine.coupled.test.ts
 * Integration tests for the coupled multi-physics solver tRPC procedure
 * and the PINN surrogate router.
 *
 * These tests mock the downstream HTTP calls (Rust :4001 and Python :4003)
 * so they run fully offline in CI.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock global fetch before any module imports ──────────────────────────────
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ─── Import routers after stubbing ────────────────────────────────────────────
import { physicsEngineRouter, pinnRouter } from "./routers/physicsEngine";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeCoupledResponse() {
  return {
    well_id: "WELL-001",
    nodal: {
      operating_rate_bpd: 1234,
      operating_bhp_psia: 2800,
      aof_bpd: 3500,
      lift_efficiency: 0.78,
      ipr_curve: [],
      vlp_curve: [],
    },
    geomechanics: {
      fracture_gradient_ppg: 14.2,
      pore_pressure_ppg: 9.8,
      min_horizontal_stress_psi: 4200,
      max_horizontal_stress_psi: 5100,
      overburden_stress_psi: 6800,
      wellbore_stability: "STABLE",
      mud_window_lower_ppg: 9.8,
      mud_window_upper_ppg: 14.2,
      stress_regime: "Normal",
    },
    sand_onset: {
      critical_drawdown_psi: 800,
      current_drawdown_psi: 500,
      safety_margin_psi: 300,
      sand_risk: "LOW",
      sanding_index: 0.62,
      critical_rate_bpd: 2100,
    },
    eur_mbbl: 1850.5,
    decline_months: 240,
  };
}

function makePinnResponse() {
  return {
    q_bpd:               { mean: 1234.5, lower: 1100.0, upper: 1369.0, std: 67.5, cv_pct: 5.5 },
    pwf_psi:             { mean: 2800.0, lower: 2600.0, upper: 3000.0, std: 100.0, cv_pct: 3.6 },
    drawdown_psi:        { mean: 700.0,  lower: 600.0,  upper: 800.0,  std: 50.0,  cv_pct: 7.1 },
    sanding_index:       { mean: 0.62,   lower: 0.50,   upper: 0.74,   std: 0.06,  cv_pct: 9.7 },
    risk_score:          { mean: 38.0,   lower: 28.0,   upper: 48.0,   std: 5.0,   cv_pct: 13.2 },
    fracture_gradient_ppg: { mean: 14.2, lower: 13.8,   upper: 14.6,   std: 0.2,   cv_pct: 1.4 },
    eur_mbbl:            { mean: 1850.0, lower: 1600.0, upper: 2100.0, std: 125.0, cv_pct: 6.8 },
    model_version: 1,
    mc_samples: 50,
    used_pinn: false,
  };
}

function okJson(body: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response);
}

function errorResponse(status: number, message: string) {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve({ error: message }),
    text: () => Promise.resolve(message),
  } as Response);
}

// ─── Minimal tRPC caller context ──────────────────────────────────────────────
function makeCtx() {
  return {
    user: { id: 1, openId: "test-open-id", name: "Test User", role: "admin" as const },
    req: {} as any,
    res: {} as any,
  };
}

const coupledCaller = physicsEngineRouter.createCaller(makeCtx());
const pinnCaller    = pinnRouter.createCaller(makeCtx());

// ─── Coupled Solver Tests ─────────────────────────────────────────────────────
describe("physicsEngine.coupled", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("returns coupled response with nodal, geomechanics, and sand_onset sections", async () => {
    mockFetch.mockResolvedValueOnce(okJson(makeCoupledResponse()));

    const result = await coupledCaller.coupled({
      wellId:              "WELL-001",
      reservoirPressure:   3500,
      qMax:                5000,
      skinFactor:          0,
      espFrequencyHz:      60,
      wellheadPressure:    200,
      tvdFt:               8500,
      fluidGradient:       0.433,
      waterCut:            0.25,
      gorScfPerBbl:        500,
      avgBulkDensityGcc:   2.35,
      ucsPsi:              3000,
      frictionAngleDeg:    30,
      biotCoefficient:     0.8,
      poissonRatio:        0.25,
      currentMudWeightPpg: 10.5,
      completionType:      "CASED_PERFORATED",
      perforationLengthFt: 20,
      perforationDiameterIn: 0.5,
      declineRateDi:       0.08,
      bFactor:             0.5,
    }) as any;

    expect(result.well_id).toBe("WELL-001");
    expect(result.nodal.operating_rate_bpd).toBe(1234);
    expect(result.geomechanics.wellbore_stability).toBe("STABLE");
    expect(result.sand_onset.sand_risk).toBe("LOW");
    expect(result.eur_mbbl).toBeCloseTo(1850.5, 1);
  });

  it("sends the correct JSON body to the physics engine", async () => {
    mockFetch.mockResolvedValueOnce(okJson(makeCoupledResponse()));

    await coupledCaller.coupled({
      wellId:              "WELL-002",
      reservoirPressure:   4000,
      qMax:                6000,
      skinFactor:          2,
      espFrequencyHz:      55,
      wellheadPressure:    250,
      tvdFt:               9000,
      fluidGradient:       0.45,
      waterCut:            0.4,
      gorScfPerBbl:        600,
      avgBulkDensityGcc:   2.4,
      ucsPsi:              4000,
      frictionAngleDeg:    32,
      biotCoefficient:     0.75,
      poissonRatio:        0.28,
      currentMudWeightPpg: 11.0,
      completionType:      "GRAVEL_PACK",
      perforationLengthFt: 25,
      perforationDiameterIn: 0.6,
      declineRateDi:       0.06,
      bFactor:             0.8,
    });

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/compute/coupled");
    const body = JSON.parse(opts.body as string);
    expect(body.well_id).toBe("WELL-002");
    expect(body.reservoir_pressure).toBe(4000);
    expect(body.completion_type).toBe("GRAVEL_PACK");
    expect(body.skin_factor).toBe(2);
  });

  it("propagates physics engine HTTP errors as thrown errors", async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(500, "Internal physics error"));

    await expect(
      coupledCaller.coupled({
        wellId: "WELL-ERR", reservoirPressure: 3000, qMax: 5000,
      } as any)
    ).rejects.toThrow(/Physics engine error 500/);
  });

  it("applies default values for optional fields", async () => {
    mockFetch.mockResolvedValueOnce(okJson(makeCoupledResponse()));

    await coupledCaller.coupled({
      wellId:            "WELL-003",
      reservoirPressure: 3000,
      qMax:              4000,
    } as any);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    // Defaults from zod schema
    expect(body.skin_factor).toBe(0);
    expect(body.fluid_gradient).toBeCloseTo(0.433, 3);
    expect(body.completion_type).toBe("CASED_PERFORATED");
    expect(body.decline_rate_di).toBeCloseTo(0.08, 3);
  });
});

// ─── PINN Router Tests ────────────────────────────────────────────────────────
describe("pinn.predict", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("returns uncertainty-quantified predictions for all 7 outputs", async () => {
    mockFetch.mockResolvedValueOnce(okJson(makePinnResponse()));

    const result = await pinnCaller.predict({
      wellId:              "WELL-001",
      reservoirPressure:   3500,
      qMax:                5000,
      skinFactor:          0,
      espFrequencyHz:      0,
      wellheadPressure:    200,
      tvdFt:               8500,
      fluidGradient:       0.433,
      waterCut:            0.3,
      gorScfPerBbl:        500,
      avgBulkDensityGcc:   2.4,
      lotPressurePpg:      14.5,
      currentMudWeightPpg: 10.5,
      ucsPsi:              3000,
      frictionAngleDeg:    30,
      biotCoefficient:     0.8,
      declineRateDi:       0.08,
      bFactor:             0.5,
      mcSamples:           50,
    }) as any;

    expect(result.q_bpd.mean).toBeCloseTo(1234.5, 1);
    expect(result.q_bpd.lower).toBeLessThan(result.q_bpd.mean);
    expect(result.q_bpd.upper).toBeGreaterThan(result.q_bpd.mean);
    expect(result.eur_mbbl.mean).toBeCloseTo(1850.0, 1);
    expect(result.sanding_index.cv_pct).toBeGreaterThan(0);
  });

  it("sends correct snake_case body to ML service", async () => {
    mockFetch.mockResolvedValueOnce(okJson(makePinnResponse()));

    await pinnCaller.predict({
      wellId: "WELL-004", reservoirPressure: 4200, qMax: 5500,
      skinFactor: 1, espFrequencyHz: 50, wellheadPressure: 220,
      tvdFt: 9000, fluidGradient: 0.45, waterCut: 0.35, gorScfPerBbl: 450,
      avgBulkDensityGcc: 2.45, lotPressurePpg: 15.0, currentMudWeightPpg: 11.5,
      ucsPsi: 3500, frictionAngleDeg: 28, biotCoefficient: 0.82,
      declineRateDi: 0.07, bFactor: 0.6, mcSamples: 100,
    });

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/pinn/predict");
    const body = JSON.parse(opts.body as string);
    expect(body.reservoir_pressure).toBe(4200);
    expect(body.mc_samples).toBe(100);
    expect(body.biot_coefficient).toBeCloseTo(0.82, 2);
  });

  it("propagates ML service errors", async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(503, "ML service unavailable"));

    await expect(
      pinnCaller.predict({
        wellId: "WELL-ERR", reservoirPressure: 3000, qMax: 5000,
      } as any)
    ).rejects.toThrow(/ML service error 503/);
  });
});

describe("pinn.train", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("sends training parameters to ML service", async () => {
    const trainResponse = { status: "ok", epochs_completed: 150, final_loss: 0.0023, model_version: 2 };
    mockFetch.mockResolvedValueOnce(okJson(trainResponse));

    const result = await pinnCaller.train({
      nSamples: 300, nEpochs: 150, lr: 0.001, physicsWeight: 0.1,
    }) as any;

    expect(result.status).toBe("ok");
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.n_samples).toBe(300);
    expect(body.n_epochs).toBe(150);
    expect(body.physics_weight).toBeCloseTo(0.1, 3);
  });
});

describe("pinn.status", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("returns available:false when ML service is unreachable", async () => {
    mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const result = await pinnCaller.status() as any;
    expect(result.available).toBe(false);
    expect(result.reason).toContain("not reachable");
  });

  it("returns status JSON when ML service is up", async () => {
    const statusBody = { available: true, trained: true, model_version: 1 };
    mockFetch.mockResolvedValueOnce(okJson(statusBody));

    const result = await pinnCaller.status() as any;
    expect(result.available).toBe(true);
    expect(result.trained).toBe(true);
  });
});
