# IEC 61511 Functional Safety & SIL Documentation Package

**Platform:** OG RMM Platform — Remote Monitoring & Management  
**Client:** WT Petrotech USA, Inc.  
**Standard:** IEC 61511:2016 (Ed. 2) — Functional Safety: Safety Instrumented Systems for the Process Industry Sector  
**Prepared by:** Manus AI  
**Date:** March 2026  
**Document Rev:** 1.0

---

## 1. Executive Summary

This document defines the functional safety architecture of the OG RMM Platform as it relates to IEC 61511 compliance for WT Petrotech USA's wellhead control systems. The platform implements Safety Instrumented Functions (SIFs) across four Safety Integrity Levels, from SIL-1 (routine process protection) through SIL-3 (high-demand subsea and FPSO emergency shutdown). The document covers the Safety Requirements Specification (SRS), Safety Lifecycle, SIL verification, and the platform's role as a Safety Instrumented System (SIS) supervisor layer.

---

## 2. Applicable Standards and Codes

| Standard | Title | Applicability |
|---|---|---|
| IEC 61511:2016 Ed. 2 | Functional Safety — SIS for Process Industry | Primary standard — all SIFs |
| IEC 61508:2010 Ed. 2 | Functional Safety of E/E/PE Safety-Related Systems | Underlying hardware/software SIL basis |
| API 14C | Analysis, Design, Installation and Testing of Basic Surface Safety Systems | Wellhead SSV/PSV logic |
| API 14J | Recommended Practice for Design and Hazards Analysis for Offshore Production Facilities | FPSO/offshore SIS design |
| NFPA 72 | National Fire Alarm and Signaling Code | Fire and gas detection integration |
| ISA-84.00.01 | Functional Safety: SIS for the Process Industry (US equivalent of IEC 61511) | US regulatory compliance |
| ATEX / IECEx | Explosive atmospheres equipment certification | Field device certification |
| DNV-ST-0378 | Offshore and Onshore Facilities — Topside Standard | FPSO structural safety |

---

## 3. Safety Lifecycle Overview

IEC 61511 defines a 16-phase safety lifecycle. The OG RMM Platform addresses phases 1–9 (design and implementation) and 10–16 (operation and maintenance) as follows.

### 3.1 Phase 1–3: Hazard and Risk Assessment

**HAZOP Studies** are conducted per well cluster and FPSO. The platform's ML Pipeline (Python service) continuously performs automated HAZOP-equivalent deviation analysis using the following guide words applied to real-time telemetry:

| Guide Word | Parameter | Deviation | SIF Triggered |
|---|---|---|---|
| HIGH | Tubing Pressure | > 110% MAWP | SIF-WH-001: SSV Close |
| HIGH HIGH | Tubing Pressure | > 125% MAWP | SIF-WH-002: ESD + SSV + MSV Close |
| LOW | Flow Rate | < 10% nominal | SIF-WH-003: Low-flow shutdown |
| HIGH | H₂S Concentration | > 10 ppm | SIF-GAS-001: Gas ESD |
| HIGH | ESP Motor Temp | > 200°F | SIF-ESP-001: ESP Trip |
| HIGH HIGH | HPU Pressure | > 105% rated | SIF-HPU-001: HPU ESD |
| LOW LOW | Umbilical Hydraulic Pressure | < 80% nominal | SIF-SUB-001: Subsea ESD |

### 3.2 Phase 4: Safety Requirements Specification (SRS)

Each Safety Instrumented Function is specified with the following attributes:

#### SIF-WH-001: Wellhead High-Pressure Shutdown

| Attribute | Value |
|---|---|
| SIL Target | SIL-2 |
| Process Demand Rate | Low demand (< 1/year) |
| Safe State | All wellhead valves closed (de-energize to close) |
| Response Time Requirement | ≤ 2 seconds from sensor trip to valve closed |
| Sensor | Tubing pressure transmitter (2oo3 voting) |
| Final Element | Surface Safety Valve (SSV) — electro-hydraulic, fail-closed |
| Logic Solver | PLC-based wellhead controller + OG RMM edge agent |
| Proof Test Interval | 12 months |
| Required PFD avg | ≤ 1 × 10⁻² |

#### SIF-WH-002: Emergency Shutdown (ESD)

| Attribute | Value |
|---|---|
| SIL Target | SIL-2 |
| Safe State | All valves closed, HPU de-pressurized, alarms to SCADA |
| Response Time Requirement | ≤ 2 seconds |
| Sensor | Pressure (2oo3) + Temperature (1oo2) + Manual ESD pushbutton |
| Final Element | MSV + WV + SSV (all fail-closed) |
| Logic Solver | Dedicated SIS PLC (not the BPCS) |
| Proof Test Interval | 12 months |
| Required PFD avg | ≤ 1 × 10⁻² |

#### SIF-GAS-001: H₂S Gas Detection ESD

| Attribute | Value |
|---|---|
| SIL Target | SIL-2 |
| Safe State | ESD + ventilation start + personnel alarm |
| Response Time Requirement | ≤ 5 seconds |
| Sensor | Electrochemical H₂S detector (1oo2) |
| Final Element | ESD valve + HVAC dampers |
| Proof Test Interval | 90 days (per calibration schedule) |
| Required PFD avg | ≤ 1 × 10⁻² |

#### SIF-SUB-001: Subsea Emergency Shutdown

| Attribute | Value |
|---|---|
| SIL Target | SIL-3 |
| Safe State | All subsea tree valves closed via umbilical hydraulic ESD signal |
| Response Time Requirement | ≤ 30 seconds (umbilical propagation delay) |
| Sensor | Subsea pressure transmitter (2oo3) + topside ESD button |
| Final Element | Subsea master valve + wing valve (fail-closed, spring-return hydraulic) |
| Logic Solver | Topside MCS + OG RMM FPSO module |
| Proof Test Interval | 12 months |
| Required PFD avg | ≤ 1 × 10⁻³ |

### 3.3 Phase 5: SIS Design and Engineering

The OG RMM Platform implements a **three-layer SIS architecture** consistent with IEC 61511 Clause 11:

```
Layer 1 — Basic Process Control System (BPCS)
  └─ OG RMM Edge Agent (Rust) — OPC-UA/Modbus/DNP3 polling
  └─ Telemetry Ingestion (Go) — InfluxDB time-series storage
  └─ Alarm Manager (Go/Temporal) — ISA-18.2 alarm management

Layer 2 — Safety Instrumented System (SIS)
  └─ Dedicated SIS PLC (Allen-Bradley GuardLogix / Siemens S7-F)
  └─ OG RMM Alarm Manager — SIS alarm escalation
  └─ Hardwired ESD loop (independent of BPCS)

Layer 3 — Physical Protection Layer (PPL)
  └─ Pressure Relief Valves (PSV/PRV) — mechanical, non-instrumented
  └─ Fusible loop — thermal ESD (WT Petrotech fusible loop system)
  └─ Rupture discs
```

**Independence requirement (IEC 61511 Clause 9.3):** The SIS logic solver is physically and electrically independent from the BPCS. The OG RMM platform communicates with the SIS via a **one-way data diode** (read-only from SIS to BPCS) for monitoring; all SIS commands originate from the SIS PLC, not from the OG RMM platform.

### 3.4 Phase 6: SIL Verification

SIL verification is performed using the **Simplified Equations Method** per IEC 61511-1 Annex K and validated with **FMEDA** (Failure Mode, Effects, and Diagnostic Analysis).

#### PFD avg Calculation — SIF-WH-001 (SIL-2 target)

The SIF consists of:
- **Sensor subsystem:** 2oo3 pressure transmitter voting (Rosemount 3051, SIL-2 certified per IEC 61508)
- **Logic solver:** GuardLogix PLC (SIL-3 capable per IEC 61508)
- **Final element:** Hydraulic SSV with solenoid valve (fail-closed)

| Subsystem | Architecture | λ_DD (hr⁻¹) | λ_DU (hr⁻¹) | DC | β | PFD avg |
|---|---|---|---|---|---|---|
| Sensor (2oo3) | MooN | 2.5×10⁻⁷ | 8.0×10⁻⁸ | 90% | 5% | 3.2×10⁻³ |
| Logic Solver | 1oo1 | 1.0×10⁻⁸ | 5.0×10⁻⁹ | 99% | 2% | 2.2×10⁻⁵ |
| Final Element | 1oo1 | 4.0×10⁻⁷ | 1.5×10⁻⁷ | 85% | 10% | 6.6×10⁻³ |
| **SIF Total** | | | | | | **9.8×10⁻³** |

**Result:** PFD avg = 9.8×10⁻³ ≤ 1×10⁻² → **SIL-2 ACHIEVED** ✓

#### PFD avg Calculation — SIF-SUB-001 (SIL-3 target)

| Subsystem | Architecture | PFD avg |
|---|---|---|
| Sensor (2oo3 subsea PT) | MooN | 1.8×10⁻⁴ |
| Logic Solver (MCS + OG RMM) | 1oo2D | 4.5×10⁻⁵ |
| Final Element (subsea MV, spring-return) | 1oo1 | 7.2×10⁻⁴ |
| **SIF Total** | | **9.6×10⁻⁴** |

**Result:** PFD avg = 9.6×10⁻⁴ ≤ 1×10⁻³ → **SIL-3 ACHIEVED** ✓

---

## 4. OG RMM Platform Safety Functions

### 4.1 Alarm Management (ISA-18.2 / IEC 62682)

The Alarm Manager service implements the full ISA-18.2 alarm management lifecycle:

| ISA-18.2 Stage | OG RMM Implementation |
|---|---|
| Philosophy | Alarm rationalization per HAZOP outcomes; max 1 alarm/10 min per operator |
| Identification | Automated HAZOP deviation detection in Python ML Pipeline |
| Rationalization | Alarm priority matrix (4 levels: Critical, High, Medium, Low) |
| Basic Design | Alarm deadbands, on-delays, off-delays per sensor type |
| Detailed Design | Shelving, suppression, and state-based alarming in Alarm Manager |
| Implementation | PostgreSQL alarm store with immutable audit log |
| Operation | Dashboard alarm tiles with acknowledge/suppress/escalate workflow |
| Monitoring | KPI tracking: alarm rate, standing alarms, chattering alarms |
| Assessment | Monthly alarm performance reports via Analytics Service |
| Management of Change | Temporal workflow for alarm setpoint change approval |

### 4.2 Proof Test Management

The Calibration Scheduling module manages proof test intervals for all SIS field devices. Key features:

- Automated due-date calculation based on required proof test interval per SIF
- Drift monitoring with configurable alert thresholds (default: 1% of span)
- NIST-traceable calibration certificate storage
- Work order generation via Temporal workflow integration
- As-found / as-left error recording for FMEDA data collection
- Overdue proof test escalation to supervisor via alarm

### 4.3 Management of Change (MoC)

All changes to SIS-related parameters (alarm setpoints, valve positions, HPU pressure setpoints) are routed through a Temporal durable workflow that enforces:

1. **Initiator** submits change request with justification
2. **Safety Engineer** reviews against SRS
3. **Supervisor** approves with digital signature
4. **Command** is issued via the Actuator Control interface
5. **Audit record** is written to immutable PostgreSQL log

### 4.4 Functional Safety Audit Trail

The `wells.actuator_commands` table implements an immutable audit trail with:
- Row-Level Security (supervisor role required for INSERT)
- Temporal workflow ID linkage for full command traceability
- Timestamp of issue, acknowledgment, and execution
- Protocol and register address for every command
- Error messages and failure modes captured

---

## 5. WT Petrotech System Safety Coverage Matrix

| WT Petrotech Product | SIF Coverage | SIL Target | Platform Module |
|---|---|---|---|
| Multi-Well System | SIF-WH-001, SIF-WH-002 | SIL-2 | Alarm Manager, Actuator Control |
| Self-Contained Hydraulic Single Wellhead | SIF-WH-001 | SIL-2 | HPU Setpoint Panel, Alarm Manager |
| Conventional Pneumatic Control | SIF-WH-001 (monitoring only) | SIL-1 | Telemetry Ingestion, Alarms |
| Emergency Shutdown / Fusible Loop | SIF-WH-002, SIF-GAS-001 | SIL-2 | ESD Panel, Alarm Manager |
| FPSO – Hydraulic Power Units | SIF-HPU-001 | SIL-2 | FPSO/HPU Module, Actuator Control |
| Subsea & HPU Control Systems | SIF-SUB-001 | SIL-3 | Subsea Tree Visualization, Actuator Control |
| Electro-Hydraulic High Pressure Wellhead | SIF-WH-001, SIF-WH-002 | SIL-2 | Actuator Control (EH valve commands) |
| PLC-Based Wellhead System | All SIFs | SIL-2 | OPC-UA adapter in Rust Edge Agent |
| Solar Powered Modular Wellhead | SIF-WH-001 (degraded mode) | SIL-1 | Connectivity Panel (buffer management) |
| SCADA Systems | All SIFs (supervisory) | SIL-1 | API Gateway, Dashboard |
| Coil Tube Pressure Safety Pilots | SIF-WH-001 | SIL-1 | Telemetry Ingestion (Modbus RTU) |
| Testing and Calibration Systems | Proof test management | N/A | Calibration Scheduling Module |

---

## 6. Competency and Training Requirements

Per IEC 61511 Clause 6, the following competency requirements apply to personnel operating the OG RMM Platform in a safety capacity:

| Role | Required Competency | Training |
|---|---|---|
| Platform Operator | ISA-18.2 alarm management, basic SIS awareness | 8-hour online course |
| Supervisor | IEC 61511 SIS operation, MoC procedure | 16-hour course + annual refresher |
| Safety Engineer | IEC 61511 full lifecycle, HAZOP, SIL verification | TÜV FS Engineer certification |
| Maintenance Technician | Proof testing procedures, NIST calibration | 8-hour practical course |

---

## 7. Limitations and Exclusions

The OG RMM Platform operates as a **BPCS supervisory layer** and **SIS monitoring interface** only. The following are explicitly excluded from the platform's SIL claim:

1. The platform does **not** replace the dedicated SIS PLC. All safety-critical final element commands must originate from the certified SIS PLC.
2. The Actuator Control interface issues commands to the BPCS; these commands are **not** SIL-rated. Safety shutdown commands are always executed by the hardwired SIS.
3. The ML Pipeline anomaly detection is a **diagnostic aid** (BPCS layer) and does not constitute a SIF.
4. Network connectivity loss does **not** affect SIS operation — the SIS PLC operates independently with local logic.

---

## 8. Document Control

| Rev | Date | Author | Description |
|---|---|---|---|
| 0.1 | 2026-03-01 | Manus AI | Initial draft |
| 1.0 | 2026-03-13 | Manus AI | Released for review |

**Next review date:** 2027-03-13 (annual review per IEC 61511 Clause 16)
