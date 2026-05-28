# OG-RMM Platform — Trexm Co-Creation Focus Area Coverage Assessment

**Prepared by:** Manus AI  
**Date:** April 13, 2026  
**Platform Version:** v33.0 Production Hardening  
**Subject:** Upstream focus areas identified for co-creation with Trexm

---

## Executive Summary

The Trexm co-creation brief identifies seven upstream focus areas for potential collaboration. This report provides a rigorous, evidence-based assessment of how the OG-RMM Platform (v33.0) addresses each area, identifies the specific modules and microservices that deliver coverage, and documents the gaps where targeted development would be required to achieve full production-grade capability.

**Overall Assessment:** The platform provides **strong foundational coverage** for five of the seven focus areas through its existing monitoring, analytics, and workover management infrastructure. Two areas — **Oil-Based Mud Storage Cost Management** and **Wellbore Instability/Geomechanics** — require dedicated module development to reach co-creation-grade depth. One area — **Liquid Loading in Gas Wells** — has partial physics infrastructure but lacks a dedicated detection and remediation workflow.

| # | Focus Area | Coverage Level | Status |
|---|---|---|---|
| 1 | Real-time Production and Facility Monitoring System | **Full** | Production-ready |
| 2 | High Cost of Oil-Based Mud Storage | **Partial** | Cost tracking exists; OBM-specific module absent |
| 3 | Optimizing Production in Heavy Oil Reservoir | **Partial** | Physics engine + ML present; thermal/SAGD absent |
| 4 | Production Issues (Liquid Loading) in Gas Wells | **Partial** | VLP/IPR physics present; Turner model absent |
| 5 | Wellbore Instability/Geomechanics Issues | **Gap** | No dedicated geomechanics module |
| 6 | Sand Production Issues | **Partial** | Workover types + alarm rules; no sand rate sensor |
| 7 | Produced Water Challenges | **Substantial** | Water tracking, injection wells, DHWS recommendations |

---

## Detailed Coverage Analysis

### 1. Real-time Production and Facility Monitoring System

**Coverage Level: Full — Production-Ready**

This is the OG-RMM Platform's core competency and its most comprehensively addressed focus area. The platform delivers a multi-layer real-time monitoring architecture that spans from edge sensors to cloud analytics.

At the **data ingestion layer**, the Go-based `telemetry-ingestion` microservice (port 8082) accepts batch sensor readings of up to 10,000 points per request, writes hot data to InfluxDB for time-series storage, and publishes to the Kafka topic `og.field.telemetry.raw` for downstream processing. The service is designed to a throughput specification of greater than 250,000 points per second (FRQ-009). Sensor types supported include tubing pressure, casing pressure, flow rate, water cut, gas-oil ratio, ESP current/frequency/vibration/motor temperature, wellhead temperature, choke position, oil rate, gas rate, water rate, bottomhole pressure (BHP), and bottomhole temperature (BHT).

At the **alarm management layer**, the ISA-18.2-compliant alarm engine provides configurable alarm rules per well and sensor, with four severity levels (CRITICAL, HIGH, MEDIUM, LOW), state management (ACTIVE, ACKNOWLEDGED, SUPPRESSED, CLEARED), and bulk operations. The `alarm-manager` Go service enforces alarm lifecycle transitions. Push notifications via VAPID are configured for mobile alerting.

At the **facility layer**, the platform covers FPSO vessels (with HPU units, subsea trees, and manifold control), the Connectivity page monitors remote site health and communication status, and the Actuator Control page provides remote valve/choke/pump commands with full audit logging. The Production Allocation module manages separator-level commingled production with three allocation methods (proportional, test-based, simulation).

At the **analytics layer**, the Delta Lakehouse module integrates Apache Sedona for geospatial proximity queries, DuckDB for OLAP analytics, DataFusion SQL for Iceberg table queries, and the Python analytics service provides production KPIs, water cut trending, and GOR analysis. The Map page renders all well locations with live status overlays.

**Key platform files:** `services/go/telemetry-ingestion/`, `client/src/pages/Overview.tsx`, `client/src/pages/WellDetail.tsx`, `client/src/pages/FPSO.tsx`, `client/src/pages/Connectivity.tsx`, `client/src/pages/Alarms.tsx`, `server/routers/wells.ts`, `services/python/analytics-service/`

---

### 2. High Cost of Oil-Based Mud Storage

**Coverage Level: Partial — Cost Tracking Exists; OBM-Specific Module Absent**

The platform has a robust financial and cost management infrastructure that provides the **foundation** for mud cost tracking, but no dedicated Oil-Based Mud (OBM) storage management module exists.

**What is covered:** The TigerBeetle-backed financial ledger (`server/routers/financials.ts`, `server/routers/ledger.ts`) tracks OPEX, CAPEX, and materials costs per well. The Workover module includes cost entries with categories LABOR, EQUIPMENT, MATERIALS, TRANSPORT, SERVICES, and OTHER, with per-job cost tracking and vendor attribution. The `financial-ledger` Go microservice manages double-entry accounting for all operational expenditures. The Financials page provides monthly trend analysis and cost breakdowns.

**What is missing:** There is no dedicated OBM inventory management module. Industry-standard OBM cost management requires tracking mud volume on-site, mud type (synthetic, diesel-based, mineral oil-based), storage capacity utilization, disposal costs (which can exceed $500/barrel for offshore OBM), reconditioning vs. replacement decisions, and regulatory compliance for OBM discharge (MARPOL Annex II, BSEE requirements). A purpose-built OBM Cost Management module would need to integrate with the existing financial ledger and workover system to provide: storage inventory tracking, cost-per-well-day analysis, mud return/reuse optimization, and disposal cost forecasting.

**Gap to close:** A new `MudManagement` page and corresponding tRPC router with DB tables for `mud_inventory`, `mud_transfers`, and `mud_disposal_records` would close this gap. The financial ledger integration is already in place to receive cost entries.

---

### 3. Optimizing Production in Heavy Oil Reservoir

**Coverage Level: Partial — Physics Engine + ML Present; Thermal/SAGD Absent**

The platform's Rust physics engine and Python ML service provide the computational backbone for production optimization, but the current implementation is calibrated for conventional (light-to-medium) oil wells using ESP lift. Heavy oil reservoirs — typically defined as API gravity below 20° — require fundamentally different optimization approaches.

**What is covered:** The Rust `physics-engine` microservice (port 4004) implements the full Vogel IPR correlation for solution-gas drive reservoirs, the Beggs-Brill multiphase flow correlation for VLP curve generation, nodal analysis (IPR/VLP intersection via bisection solver), Arps decline curve analysis (exponential, hyperbolic, harmonic), and sensitivity analysis across reservoir pressure, skin factor, and ESP frequency. The Digital Twin page exposes all these models interactively with per-well calibration from production history. The ML service provides Isolation Forest + Z-score anomaly detection and Ollama LLM-powered optimization recommendations that include water cut management and drawdown optimization.

The wells schema includes `permeability_md`, `porosity_fraction`, `net_pay_ft`, `skin_factor`, `water_cut_fraction`, and `gor_scf_per_bbl` — all relevant to heavy oil characterization. The workover system supports STIMULATION and ACIDIZING job types, which are applicable to heavy oil wells.

**What is missing:** Heavy oil optimization requires thermal recovery modeling (SAGD, cyclic steam stimulation, steam flooding), viscosity-temperature relationships (heavy oil viscosity can exceed 10,000 cP at reservoir conditions), steam-to-oil ratio (SOR) monitoring, heat loss calculations for steam injection wells, and emulsion treatment tracking. The current Vogel IPR model assumes solution-gas drive, which is not the primary drive mechanism for most heavy oil reservoirs (which rely on thermal, gravity drainage, or pressure maintenance). The Beggs-Brill VLP model does not account for the high viscosity gradients characteristic of heavy oil flow.

**Gap to close:** Extending the Rust physics engine with a `heavy_oil.rs` module implementing the Beggs-Brill viscosity correction for heavy oil, a steam injection model, and SOR tracking would provide the computational foundation. A new `HeavyOilOptimization` page with thermal recovery parameters would complete the user-facing capability.

---

### 4. Production Issues (Liquid Loading) in Gas Wells

**Coverage Level: Partial — VLP/IPR Physics Present; Turner Critical Velocity Model Absent**

Liquid loading is the dominant artificial lift challenge in mature gas wells, occurring when gas velocity falls below the critical velocity required to lift liquids to surface. The platform has the multiphase flow physics infrastructure but lacks the specific liquid loading detection and remediation workflow.

**What is covered:** The Rust VLP module implements the Beggs-Brill multiphase flow correlation, which computes liquid holdup (`liquid_holdup` function using lambda_l and Froude number), superficial liquid velocity (`vsl`), and mixture density as a function of water cut and GOR. The telemetry schema captures tubing pressure, casing pressure, flow rate, water rate, and GOR — all the parameters needed for liquid loading diagnosis. The `WATER_INJECTION` and `DISPOSAL` well types are defined in the schema, and the ML service's rule engine generates recommendations for high water cut scenarios including downhole water separation (DHWS) evaluation.

**What is missing:** The Turner (1969) critical velocity model — the industry standard for liquid loading prediction — is not implemented. This model calculates the minimum gas velocity required to transport liquid droplets to surface as a function of tubing diameter, wellhead pressure, gas gravity, and liquid density. The Coleman (1991) modification for low-pressure wells is also absent. There is no dedicated gas well liquid loading diagnostic page, no Turner velocity trend chart (comparing actual gas velocity to critical velocity over time), no plunger lift optimization module, and no velocity string sizing tool. The workover system does not include `PLUNGER_LIFT_INSTALLATION`, `VELOCITY_STRING`, or `FOAM_INJECTION` job types that are the primary remediation actions for liquid loading.

**Gap to close:** Adding a `turner_loading.rs` module to the Rust physics engine, a `GasWellLiquidLoading` page with Turner velocity trend visualization, and extending the workover job types to include plunger lift and velocity string installations would close this gap. The existing telemetry infrastructure already captures all required input parameters.

---

### 5. Wellbore Instability / Geomechanics Issues

**Coverage Level: Gap — No Dedicated Geomechanics Module**

Wellbore instability is caused by the interaction between drilling-induced stress perturbations and the in-situ stress field, formation strength, and pore pressure. It manifests as borehole collapse, lost circulation, stuck pipe, and casing deformation. This is the most significant gap relative to the Trexm focus areas.

**What is covered:** The platform has indirect relevance through the Damage Assessment module (which can log wellbore integrity incidents), the HSE module (which tracks stuck pipe and lost circulation as operational hazards), and the Workovers module (which includes `WELLBORE_CLEANOUT` as a job type). The wells schema stores `permeability_md`, `porosity_fraction`, `net_pay_ft`, and `skin_factor`, which are inputs to geomechanical models. The Calibration module manages sensor calibration records that could include formation evaluation tools.

**What is missing:** A geomechanics module requires: a 1D Mechanical Earth Model (MEM) builder with overburden stress, pore pressure, minimum horizontal stress (Shmin), and maximum horizontal stress (SHmax) profiles; a mud weight window calculator (collapse pressure to fracture gradient); wellbore stability analysis for different trajectory azimuths and inclinations; real-time pore pressure prediction from drilling parameters (D-exponent, sigma method); and formation strength characterization (UCS, friction angle, cohesion). None of these capabilities exist in the current platform. The sensor type enum does not include formation evaluation sensors (caliper, sonic, resistivity). The schema has no tables for `geomechanical_models`, `stress_profiles`, or `mud_weight_windows`.

**Gap to close:** This requires the most substantial development effort of all seven focus areas. A `GeomechanicsModule` page, a new `geomechanics.ts` tRPC router, database tables for stress profiles and MEM data, and a Python geomechanics service (leveraging libraries such as `welly` or `lasio` for well log processing) would be required. Integration with the existing Workovers module to flag wellbore instability as a trigger for workover jobs would complete the workflow.

---

### 6. Sand Production Issues

**Coverage Level: Partial — Workover Types + Alarm Rules; No Sand Rate Sensor or Prediction Model**

Sand production occurs when the effective stress on the formation exceeds the formation's compressive strength, causing sand grains to be mobilized into the wellbore. It causes erosion of downhole and surface equipment, choke plugging, and separator damage.

**What is covered:** The platform includes `SAND_CONTROL` and `SAND_CLEANOUT` as workover job types in the schema, enabling operators to log and track sand-related interventions. The alarm rule engine supports configurable thresholds on any sensor tag, meaning sand detector readings (if present in the field) can trigger ISA-18.2 alarms. The Damage Assessment module can log equipment damage caused by sand erosion. The HSE module tracks incidents including equipment damage. The production records schema tracks daily production volumes, and declining production trends (detectable via the Arps decline curve module) can be an indicator of sand-related production impairment.

**What is missing:** The sensor type enum does not include `SAND_DETECTOR` or `EROSION_PROBE` — the two primary real-time sand monitoring sensor types used in industry (acoustic sand detectors and intrusive/non-intrusive erosion probes). There is no sand production rate model (e.g., the Morita sanding prediction model or empirical correlations based on drawdown and water cut). There is no sand management workflow that links sand production rate to choke management recommendations (reducing drawdown to stay below the critical drawdown pressure for sand onset). The workover system does not include `GRAVEL_PACK`, `FRAC_PACK`, or `EXPANDABLE_SAND_SCREEN` as job types, which are the primary sand control completions.

**Gap to close:** Adding `SAND_DETECTOR` and `EROSION_PROBE` to the sensor type enum, implementing a sand onset prediction model in the Python ML service, and extending the workover job types to include gravel pack and sand screen installations would substantially close this gap. The existing alarm infrastructure would then automatically propagate sand rate exceedances.

---

### 7. Produced Water Challenges

**Coverage Level: Substantial — Water Tracking, Injection Wells, DHWS Recommendations**

Produced water is the largest volume byproduct of oil and gas production globally, and its management involves treatment, reinjection, disposal, and regulatory compliance. The platform has meaningful coverage across multiple dimensions.

**What is covered:** The wells schema includes `WATER_INJECTION` and `DISPOSAL` as well types, and the production records schema tracks `water_bbls` as a daily production metric. The telemetry schema captures `water_rate`, `water_cut`, and `gor` in real time. The Production Allocation module tracks `allocated_water_bpd` per well and separator. The Python analytics service computes `water_cut_pct` and `gor_scf_per_bbl` as KPIs. The ML service's rule engine generates specific recommendations for water cut exceeding 65% — including downhole water separation (DHWS) evaluation and chemical injection programmes. The Regulatory module covers EPA Subpart W and BSEE OGOR reporting, both of which include produced water volumes. The HSE module tracks SPILL incidents, which are the primary environmental risk from produced water.

**What is missing:** There is no dedicated produced water management workflow covering the full water lifecycle: treatment technology selection (API separators, hydrocyclones, induced gas flotation, reverse osmosis), water quality monitoring (TSS, oil-in-water, bacteria counts, scaling indices), reinjection well integrity monitoring (injectivity index trending), disposal well regulatory compliance (UIC Class II permits in the US, equivalent in GCC), and water recycling/reuse tracking. The workover system does not include `WATER_INJECTION_STIMULATION` or `SCALE_SQUEEZE` as job types. There is no produced water balance reconciliation (comparing produced water volumes to injection + disposal + evaporation).

**Gap to close:** A `ProducedWaterManagement` page with water balance visualization, water quality tracking, and injection well performance monitoring would close the most critical gaps. The existing financial ledger, regulatory reporting, and workover infrastructure provide strong integration points.

---

## Summary Gap Analysis and Development Roadmap

The table below summarizes the estimated development effort to achieve full co-creation-grade coverage for each focus area, building on the existing platform infrastructure.

| Focus Area | Current Depth | New Module Required | Effort Estimate | Integration Points |
|---|---|---|---|---|
| Real-time Production & Facility Monitoring | **Full** | None — extend sensor types | Low | Telemetry ingestion, alarm engine |
| OBM Storage Cost Management | **Low** | `MudManagement` page + router + 3 DB tables | Medium | Financial ledger, workovers |
| Heavy Oil Reservoir Optimization | **Medium** | `HeavyOilOptimization` page + thermal models in Rust | High | Physics engine, Digital Twin, ML service |
| Liquid Loading in Gas Wells | **Medium** | `GasWellLiquidLoading` page + Turner model in Rust | Medium | Physics engine, telemetry, workovers |
| Wellbore Instability / Geomechanics | **None** | `GeomechanicsModule` page + Python service + 4 DB tables | High | Workovers, wells, calibration |
| Sand Production Issues | **Low-Medium** | Sand sensor types + sanding model in Python | Medium | Alarm engine, workovers, telemetry |
| Produced Water Challenges | **Substantial** | `ProducedWaterManagement` page + water balance router | Medium | Production allocation, regulatory, financials |

**Effort scale:** Low = 1–3 days, Medium = 3–7 days, High = 7–14 days of focused development.

---

## Conclusion

The OG-RMM Platform v33.0 is not a blank slate for the Trexm co-creation engagement — it is a production-hardened enterprise platform with 42 React pages, 25 tRPC routers, 103 database tables, and a multi-language microservices architecture (Go, Rust, Python) that already addresses the monitoring, alarm management, financial, regulatory, and operational workflow dimensions that underpin all seven focus areas.

The most strategically valuable co-creation opportunities are in **Wellbore Instability/Geomechanics** (where the platform has zero existing coverage and Trexm's domain expertise would be most differentiated), **Heavy Oil Reservoir Optimization** (where the existing physics engine provides an extensible foundation for thermal recovery models), and **Liquid Loading in Gas Wells** (where the Turner critical velocity model can be added to the existing Rust VLP module in a targeted sprint). The **Produced Water** and **Real-time Monitoring** areas are already at a level where the platform can serve as the delivery vehicle for Trexm's operational expertise without requiring significant new development.

---

*This assessment is based on a full code audit of the OG-RMM Platform v33.0 (checkpoint `3ce46c57`) conducted on April 13, 2026. All capability claims are traceable to specific source files in the platform codebase.*
