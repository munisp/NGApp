# ERPNext Open Materials Strategy — Gap Analysis vs OG-RMM Platform v37

## Document: "Open-Source Technology Recommendations for Trexm Upstream Co-Creation Focus Areas"

---

## Recommended Stack by Focus Area

### FA1: Real-time Production & Facility Monitoring
- **Recommended:** OSDU + ThingsBoard CE + Apache Kafka + TimescaleDB
- **Platform v37 status:** Go telemetry ingestion (250K pts/sec), ISA-18.2 alarms, Delta Lakehouse, EMQX MQTT
- **GAP:** No TimescaleDB (using InfluxDB mock + PostgreSQL). No Kafka event bus. No OSDU data platform layer. No ThingsBoard OPC-UA gateway.

### FA2: High Cost of Oil-Based Mud Storage
- **Recommended:** ERPNext/Frappe + ThingsBoard + Pyomo optimization
- **Platform v37 status:** Mud inventory tables, OBM cost tracker, mud weight window
- **GAP:** No ERPNext/Frappe integration. No Pyomo optimization for procurement routing. No Source-to-Pay workflow. No Rig-to-Rig transfer workflow. No barcode/QR scanning.

### FA3: Optimizing Production in Heavy Oil Reservoir
- **Recommended:** open-DARTS + OPM Flow + MRST + ResInsight
- **Platform v37 status:** Butler SAGD simulation, Beggs-Robinson viscosity, thermal recovery models in Rust
- **GAP:** No open-DARTS OBL solver. No OPM Flow black-oil simulation. No ResInsight 3D visualization. SAGD is analytical only (not full reservoir simulation).

### FA4: Production Issues (Liquid Loading) in Gas Wells
- **Recommended:** PressureDrop.jl + NodAnaPy
- **Platform v37 status:** Turner critical velocity, Foss & Gaul plunger lift, velocity string design
- **GAP:** No PressureDrop.jl multiphase pressure profile. No NodAnaPy nodal analysis IPR/VLP curves. No drift-flux simulation.

### FA5: Wellbore Instability / Geomechanics
- **Recommended:** GEOSX + OpenGeoSys + MOOSE
- **Platform v37 status:** Eaton pore pressure, Mohr-Coulomb stress, 1D MEM, LAS import
- **GAP:** No GEOSX coupled flow-geomechanics. No OpenGeoSys THMC. No MOOSE finite strain. Only analytical models, no FEM/FVM simulation.

### FA6: Sand Production Issues
- **Recommended:** CFDEM coupling + LIGGGHTS + OpenFOAM
- **Platform v37 status:** Mohr-Coulomb critical drawdown, sand rate tracking, SAND_CONTROL workover
- **GAP:** No OpenFOAM CFD. No LIGGGHTS DEM particle simulation. No CFDEM coupling. Only analytical onset prediction.

### FA7: Produced Water Challenges
- **Recommended:** PARETO + WaterTAP + IDAES
- **Platform v37 status:** Water balance, EPA/BSEE reporting, injection wells, spill tracking
- **GAP:** No PARETO logistics optimization. No WaterTAP treatment techno-economics. No IDAES process systems engineering.

---

## ERPNext/Frappe OpenMaterials Blueprint — Key Entities Missing from Platform

### Master Data
- Material Master (mud types, chemicals, pipes, rentals)
- Supplier Catalog with Contract Rates
- Field Location (Rig/Pad) master
- Yard/Bin/Tank location hierarchy
- Price Book

### Inventory & Tracking
- Batch/Lot tracking (crucial for OBM characteristics)
- Rental vs. Consumable Item classification
- Equipment/Container tracking
- QR/Barcode tag generation and scanning

### Procurement Workflow
- Material Request → Purchase Requisition → Purchase Order → Goods Receipt
- Approval Workflow with role-based gates

### Field Operations
- Transfer Order (Yard-to-Rig)
- Field Issue Ticket
- Return Ticket (halts demurrage fees)
- Consumption Ticket

### Telemetry & Auditing
- Mud Tank Snapshot (API-populated from ThingsBoard)
- Sensor Stream Binding
- Audit Event log

### Optimization
- Pyomo-based procurement/transfer routing optimizer
- Supplier performance scoring

---

## Phased Roadmap from Document

| Phase | Timeline | Focus | Key Deliverables |
|---|---|---|---|
| Phase 1: Foundation | Months 0-3 | Monitoring, Mud Storage | OSDU, Kafka, TimescaleDB, ThingsBoard CE, ERPNext basic |
| Phase 2: Custom Apps | Months 3-6 | Mud Storage, Produced Water | ERPNext OpenMaterials MVP, PARETO water logistics |
| Phase 3: Engineering Sims | Months 6-12 | Heavy Oil, Gas Wells | open-DARTS, OPM Flow, PressureDrop.jl, NodAnaPy |
| Phase 4: Advanced Multiphysics | Months 12+ | Geomechanics, Sand | GEOSX, OpenFOAM/LIGGGHTS/CFDEM |

---

## Implementation Plan for OG-RMM Platform

### Tier 1 — Implement Now (High value, feasible in platform)
1. **Kafka event streaming** — Go Kafka producer in telemetry service, consumer in analytics service
2. **TimescaleDB** — Replace InfluxDB mock with TimescaleDB (PostgreSQL extension, already using pg)
3. **ERPNext-inspired Materials Management** — Full procurement workflow in tRPC + new DB tables
4. **Pyomo optimization** — Python service endpoint for mud procurement routing
5. **PARETO produced water logistics** — Python service endpoint using PARETO/IDAES
6. **WaterTAP treatment optimizer** — Python service endpoint
7. **NodAnaPy nodal analysis** — Python service endpoint for IPR/VLP nodal analysis
8. **AI Copilot tool-calling** — Wire real well/alarm data to LLM tool calls
9. **Redis caching** — Enable existing cache layer
10. **Playwright E2E tests** — Smoke test suite

### Tier 2 — Integrate via API/subprocess (Specialist engines)
11. **OPM Flow** — Black-oil simulation via subprocess, results stored in DB
12. **open-DARTS** — Heavy oil thermal simulation via Python subprocess
13. **OSDU data platform layer** — OSDU-compatible well/facility metadata schema
14. **ResInsight 3D** — Embed ResInsight web viewer for subsurface visualization

### Tier 3 — Architecture/Infrastructure
15. **OSDU-compatible API layer** — Expose well/facility data via OSDU REST schemas
16. **ThingsBoard OPC-UA gateway** — Docker compose integration
17. **OpenFOAM CFD wrapper** — Python subprocess for sand CFD simulations
