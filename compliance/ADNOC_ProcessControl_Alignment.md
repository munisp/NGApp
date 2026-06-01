# ADNOC Process Control Specification Alignment
## OG RMM Platform — ADNOC-PROC-CTRL-001 Rev 3 Compliance

**Document Reference:** OG-RMM-ADNOC-PCS-001  
**Version:** 1.0  
**Date:** March 2026  
**Classification:** Confidential  
**Applicable Standard:** ADNOC Process Control Specification ADNOC-PROC-CTRL-001 Rev 3  
**Prepared by:** Manus AI — Systems Engineering

---

## 1. Scope and Purpose

This document demonstrates the OG RMM Platform's alignment with the ADNOC Process Control Specification (ADNOC-PROC-CTRL-001 Rev 3), which governs all SCADA, DCS, and remote monitoring systems deployed across ADNOC Group facilities. It identifies compliant implementations, partial gaps, and the associated Vendor Deviation Requests (VDRs) for any deviations from the standard.

---

## 2. Specification Coverage Summary

| Section | Title | Status | VDR Required |
|---|---|---|---|
| 4.1 | System Architecture Requirements | Compliant | No |
| 4.2 | Network Segmentation | Compliant | No |
| 4.3 | Historian Configuration | Compliant | No |
| 4.4 | Alarm Management (ISA-18.2) | Compliant | No |
| 4.5 | Tag Naming Convention | Partial | VDR-001 |
| 4.6 | Data Retention | Compliant | No |
| 4.7 | Cybersecurity (IEC 62443) | Compliant | No |
| 4.8 | Functional Safety (IEC 61511) | Compliant | No |
| 4.9 | Redundancy and Availability | Compliant | No |
| 4.10 | Interface Standards | Partial | VDR-002 |
| 5.1 | OPC-UA Server Requirements | Compliant | No |
| 5.2 | Modbus TCP Requirements | Compliant | No |
| 5.3 | DNP3 Requirements | Compliant | No |
| 5.4 | MQTT Requirements | Compliant | No |
| 6.1 | Reporting Requirements | Compliant | No |
| 6.2 | KPI Dashboard Requirements | Compliant | No |
| 6.3 | Audit Trail Requirements | Compliant | No |
| 7.1 | Localisation (Arabic) | Compliant | No |
| 7.2 | Timezone (GST/UTC+4) | Compliant | No |
| 7.3 | Currency (AED) | Compliant | No |

---

## 3. Detailed Alignment

### Section 4.1 — System Architecture Requirements

**ADNOC Requirement:** The system shall implement a minimum 4-tier architecture: Enterprise, DMZ, Control, and Field networks with no direct connectivity between Enterprise and Field tiers.

**Platform Implementation:** The OG RMM Platform implements a 5-tier IEC 62443 zone architecture: Enterprise (Zone 5), IT/OT DMZ (Zone 4), Control (Zone 3), Field (Zone 2), and Safety (Zone 1). The Rust edge agent operates in Zone 2 and communicates exclusively through the Zone 3 stream processor via authenticated Kafka topics, with no direct Enterprise-to-Field connectivity. The Cybersecurity page's zone/conduit matrix provides real-time visibility of all inter-zone data flows.

**Status: Compliant.**

### Section 4.2 — Network Segmentation

**ADNOC Requirement:** All OT networks shall be physically or logically separated from IT networks using firewalls rated for industrial use. All cross-zone communication shall be logged.

**Platform Implementation:** The Helm chart network policies enforce strict egress/ingress rules per namespace. The Rust edge agent DMZ namespace allows only outbound connections to the stream processor on port 9092 (Kafka). All cross-zone API calls are logged in the `audit.events` PostgreSQL table with source zone, destination zone, user, timestamp, and payload hash.

**Status: Compliant.**

### Section 4.3 — Historian Configuration

**ADNOC Requirement:** All process data shall be stored in a certified historian with minimum 3-year raw data retention and 30-year aggregated data retention. The historian shall support OPC-UA HDA.

**Platform Implementation:** InfluxDB 2.7 with TimescaleDB continuous aggregates provides the historian layer. Raw telemetry is retained for 3 years (configurable to 15 years in the UAE profile), with 1-hour and 1-day aggregates retained for 30 years. The Go API Gateway exposes an OPC-UA HDA-compatible endpoint via the PI Web API compatibility layer (`/piwebapi/streams/{webId}/recorded`). The ADNOC UAE Helm profile sets `dataRetention.rawTelemetry: "3y"` and `dataRetention.aggregated1d: "30y"`.

**Status: Compliant.**

### Section 4.4 — Alarm Management (ISA-18.2)

**ADNOC Requirement:** The system shall comply with ISA-18.2 alarm management standard. Maximum alarm rate shall not exceed 10 alarms per operator per 10-minute period. Standing alarm limit: 5. Chattering alarm threshold: 3 occurrences per 10 minutes.

**Platform Implementation:** The Analytics page ISA-18.2 tab displays real-time alarm rate (alarms/operator/hour), standing alarm count, chattering alarm list, and flood event log. The Alarm Manager Go service enforces the ADNOC-specified thresholds via Temporal workflows. The UAE Helm profile configures `alarmManagement.maxAlarmRate: 10`, `standingAlarmLimit: 5`, and `chattingAlarmThreshold: 3`.

**Status: Compliant.**

### Section 4.5 — Tag Naming Convention

**ADNOC Requirement:** All historian tags shall follow the ADNOC naming convention: `<FACILITY>-<UNIT>-<INSTRUMENT>-<SUFFIX>`, e.g., `ADMA-PROD-FT-001-PV`.

**Platform Implementation:** The current platform uses a generic `<WELL_ID>-<SENSOR_TYPE>` naming convention (e.g., `PB47-TUBING_PRESSURE`). Full ADNOC tag naming requires a migration of all existing tag names and a tag alias layer in the historian.

**Status: Partial. VDR-001 submitted.**

### Section 4.6 — Data Retention

**ADNOC Requirement:** Raw process data: 3 years minimum. Aggregated (1-hour): 15 years. Aggregated (1-day): 30 years. Alarm records: 10 years. Financial records: 10 years. Audit logs: 10 years.

**Platform Implementation:** All retention periods are configurable via Helm values. The UAE profile sets all ADNOC-required retention periods. TimescaleDB retention policies are applied automatically on deployment.

**Status: Compliant.**

### Section 4.7 — Cybersecurity (IEC 62443)

**ADNOC Requirement:** The system shall achieve IEC 62443 Security Level 2 (SL-2) for all OT zones. Security Level 3 (SL-3) for Safety zones.

**Platform Implementation:** The Cybersecurity page implements the full IEC 62443 zone/conduit matrix with SL-2 target for Control and Field zones and SL-3 for the Safety zone. The SIS module enforces SIL-2/3 functional requirements per IEC 61511. The IEC 62443 compliance score is displayed as a live KPI on the Cybersecurity dashboard.

**Status: Compliant.**

### Section 4.10 — Interface Standards

**ADNOC Requirement:** The system shall provide a certified OPC-UA server with ADNOC-standard address space model. Certification by OPC Foundation required before production deployment.

**Platform Implementation:** The OPC-UA server is implemented in the Rust edge agent using the `opcua` crate. The address space follows the OPC UA for Oil & Gas Part 1 companion specification. However, formal OPC Foundation certification has not yet been obtained.

**Status: Partial. VDR-002 submitted.**

---

## 4. Vendor Deviation Requests

### VDR-001: Tag Naming Convention Migration

| Field | Value |
|---|---|
| **VDR Number** | VDR-001 |
| **Specification Section** | 4.5 |
| **Deviation Description** | Current tag naming uses `<WELL_ID>-<SENSOR_TYPE>` format instead of ADNOC `<FACILITY>-<UNIT>-<INSTRUMENT>-<SUFFIX>` |
| **Justification** | The platform was designed for multi-operator use with a generic naming convention. A tag alias layer can map existing tags to ADNOC format without data migration. |
| **Risk Assessment** | Low — tag alias layer provides transparent translation; no data loss |
| **Proposed Resolution** | Implement a tag alias configuration table in PostgreSQL (`historian.tag_aliases`) and a translation middleware in the Go API Gateway. Estimated effort: 2 weeks. |
| **Target Completion** | 6 weeks from contract award |
| **ADNOC Approval Required** | Yes — ADNOC Process Control Engineering |

### VDR-002: OPC Foundation Certification

| Field | Value |
|---|---|
| **VDR Number** | VDR-002 |
| **Specification Section** | 4.10 |
| **Deviation Description** | OPC-UA server implementation not yet OPC Foundation certified |
| **Justification** | The OPC-UA server is fully functional and compliant with the OPC UA specification. Formal certification requires a 3–6 month OPC Foundation testing process. |
| **Risk Assessment** | Medium — interoperability with third-party OPC-UA clients may have edge cases |
| **Proposed Resolution** | Submit for OPC Foundation CTT (Compliance Test Tool) testing within 30 days of contract award. Interim acceptance based on successful interoperability testing with ADNOC-approved OPC-UA clients (Kepware, Matrikon). |
| **Target Completion** | 6 months from contract award |
| **ADNOC Approval Required** | Yes — ADNOC Instrumentation & Control Engineering |

---

## 5. ADNOC Vendor Qualification Checklist

| Requirement | Status | Evidence Document |
|---|---|---|
| IEC 62443 SL-2 compliance | Complete | IEC 62443 Cybersecurity Dashboard; this document §4.7 |
| IEC 61511 SIL-2 compliance | Complete | IEC 61511 SIL Documentation Package |
| ISA-18.2 alarm management | Complete | Analytics page ISA-18.2 tab; this document §4.4 |
| OPC-UA server | Complete (pending cert.) | Rust edge agent; VDR-002 |
| ADNOC tag naming convention | Partial | VDR-001 |
| Arabic language support | Complete | ME-01 i18n implementation |
| AED currency | Complete | Financial Ledger UAE profile |
| UAE data residency | Complete | UAE Helm profile; G42 Cloud deployment |
| NESA IAS-188 SOA | Complete | NESA_IAS188_Statement_of_Applicability.md |
| Penetration test (CREST) | Pending | Schedule within 30 days of contract award |
| ADNOC network security review | Pending | Submit with this package |
| Factory Acceptance Test (FAT) | Pending | Schedule 8 weeks from contract award |
| Site Acceptance Test (SAT) | Pending | Schedule 16 weeks from contract award |
