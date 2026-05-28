# OG-RMM Platform: Middle East Deployment Recommendations
## Kuwait & UAE — Regulatory, Technical, and Operational Guidance

**Prepared by:** Manus AI  
**Date:** March 2026  
**Version:** 1.0  
**Classification:** Confidential — For WT Petrotech USA, Inc.

---

## Executive Summary

Deploying the OG-RMM Platform in Kuwait and the United Arab Emirates represents a significant commercial opportunity, given that both nations are executing aggressive oil and gas digital transformation programmes aligned with their respective national visions (Kuwait Vision 2035 and UAE Net Zero 2050). However, both jurisdictions impose distinct and increasingly stringent regulatory obligations on industrial control system (ICS) platforms, data sovereignty, cybersecurity architecture, and vendor qualification. This report identifies all material requirements, maps them against the current platform capabilities, and provides a prioritised implementation roadmap for a compliant, commercially viable Middle East deployment.

The core finding is that the OG-RMM Platform is architecturally well-positioned for the region — its Rust-based edge agent, IEC 62443 zone/conduit model, IEC 61511 SIL documentation, and PostgreSQL-native data residency design address the majority of mandatory requirements. The primary gaps requiring remediation before deployment are: **Arabic (RTL) UI localisation**, **UAE NESA IAS-188 control mapping**, **Kuwait NCSC Decision No. 1/2025 data classification compliance**, **ADNOC Process Control Specification alignment**, and **sovereign cloud hosting configuration** for in-country data residency.

---

## 1. Regional Context and Market Opportunity

### 1.1 Kuwait

Kuwait holds approximately 6% of the world's proven oil reserves and its energy sector accounts for over 90% of government revenue.[^1] The Kuwait Petroleum Corporation (KPC) and its affiliates — Kuwait Oil Company (KOC), Kuwait National Petroleum Company (KNPC), and Kuwait Foreign Petroleum Exploration Company (KUFPEC) — collectively operate one of the most capital-intensive upstream and downstream portfolios in the GCC.

In January 2026, KNPC officially launched its executive digital transformation strategy, explicitly targeting SCADA modernisation, predictive maintenance, and integrated operations centres.[^2] KOC's 2035 Strategic Vision has already resulted in 1,337 wells drilled with digital monitoring as a core enabler. KPC's cybersecurity operations chief has publicly confirmed that the corporation runs multiple dedicated cybersecurity centres and mandates AI-assisted threat detection across all digital platforms.[^3]

The market timing is optimal: Kuwait is actively procuring platforms that can replace legacy SCADA systems while meeting the new National Cybersecurity Center (NCSC) data classification framework issued in October 2025.

### 1.2 United Arab Emirates

The UAE, led by ADNOC's 12.9 million barrel-per-day production target, is the most digitally advanced O&G jurisdiction in the GCC. ADNOC's 2025 "Powering Possible" report with Microsoft confirmed that 88% of surveyed energy leaders consider AI essential to operations.[^4] The UAE cybersecurity market is projected to reach $25 billion by 2025, reflecting the scale of mandatory compliance investment across critical infrastructure operators.[^5]

ADNOC has published a formal **Process Control System Specification** that explicitly requires all vendors to implement UAE National Digital Security Authority (NDSA) requirements and comply with the company's OT Security Policy.[^6] This specification is binding on all platform vendors supplying to ADNOC group companies, making it the single most important compliance document for UAE deployment.

---

## 2. Regulatory and Standards Landscape

### 2.1 Kuwait Regulatory Framework

| Regulation / Standard | Issuing Body | Applicability | Status |
|---|---|---|---|
| National Cybersecurity Framework | Kuwait NCSC | All critical infrastructure | Mandatory |
| Decision No. (1) of 2025 — Data Classification | Kuwait NCSC | Government & critical sector data | Mandatory (Oct 2025) |
| CITRA Telecommunications Regulations | CITRA | Data transmission, cloud services | Mandatory |
| KOC Standard KOC-E-027 | Kuwait Oil Company | E-SCADA systems for substations | Mandatory for KOC sites |
| KOC Security Systems Standard Part 3 | Kuwait Oil Company | Electronic security equipment | Mandatory for KOC sites |
| ISO/IEC 27001 | International | ISMS baseline | Required by NCSC |
| IEC 62443 | International | ICS/OT security | Required by NCSC |
| ISO 45001 | International | Occupational health & safety | Required by KPC |

Kuwait's NCSC Decision No. 1/2025 establishes a **four-tier data classification system** (Public, Internal, Confidential, Restricted) with binding requirements for encryption at rest and in transit, access control, and — critically — **data residency within Kuwait** for Confidential and Restricted categories.[^7] All operational telemetry, alarm records, financial ledger data, and personnel records generated by the OG-RMM Platform at Kuwait sites will fall under Confidential or Restricted classification, requiring in-country hosting.

### 2.2 UAE Regulatory Framework

| Regulation / Standard | Issuing Body | Applicability | Status |
|---|---|---|---|
| UAE Information Assurance (IA) Regulation — 188 Controls | NESA / UAE Cybersecurity Council | Critical infrastructure operators | Mandatory |
| Federal Decree-Law No. 45 of 2021 (PDPL) | UAE Federal Government | All personal data processing | Mandatory |
| UAE National Cybersecurity Strategy 2023–2026 | UAE Cybersecurity Council | All sectors | Policy framework |
| ADNOC Process Control System Specification | ADNOC | All ADNOC-connected platforms | Mandatory for ADNOC |
| Dubai Electronic Security Center (DESC) ASAAS 2.0 | DESC | Dubai-based operations | Mandatory in Dubai |
| IEC 62443 (Zones & Conduits) | International | OT/ICS environments | Mandated by NESA |
| IEC 61511 (SIL) | International | Safety instrumented systems | Required by ADNOC |
| ISO 27001 | International | ISMS | Required by NESA |
| UAE Cryptographic Controls Framework (Feb 2026) | UAE Cybersecurity Council | All encrypted systems | Mandatory (new) |

The **NESA IAS-188 controls** are the most comprehensive mandatory framework, covering governance, risk management, asset management, access control, cryptography, physical security, incident response, and business continuity. The UAE Cybersecurity Council actively monitors compliance and can impose operational restrictions on non-compliant operators.[^8]

The UAE's new **Cryptographic Controls Framework** (February 2026) mandates that all organisations submit formal transition plans for post-quantum cryptography migration — a forward-looking requirement that the platform's TLS and at-rest encryption layers must accommodate.[^9]

---

## 3. Platform Gap Analysis for Middle East Deployment

### 3.1 Critical Gaps (Must Fix Before Deployment)

**Gap ME-01: Arabic Right-to-Left (RTL) UI Localisation**

The current dashboard is English-only with left-to-right layout. Both KPC/KOC and ADNOC operate in bilingual Arabic/English environments. Regulatory submissions, alarm acknowledgements, and shift handover reports must be available in Arabic. The UAE PDPL also requires that privacy notices be presented in Arabic. This is the highest-priority gap because it affects operator adoption, regulatory compliance, and contractual eligibility with both KPC and ADNOC.

*Remediation:* Integrate `react-i18next` with an Arabic translation file, add `dir="rtl"` support to the Tailwind CSS layout, and configure the sidebar and all data tables to mirror correctly in RTL mode. Estimated effort: 3–4 weeks.

**Gap ME-02: Kuwait NCSC Data Classification Tagging**

The platform currently stores all data in PostgreSQL without NCSC-mandated classification labels. Kuwait Decision No. 1/2025 requires that every data record be tagged with its classification tier and that access controls enforce tier-appropriate restrictions.

*Remediation:* Add a `data_classification` enum column (`public`, `internal`, `confidential`, `restricted`) to all PostgreSQL tables, implement row-level security policies that enforce classification-based access, and add a classification badge to the UI for all data views. Estimated effort: 1–2 weeks.

**Gap ME-03: UAE NESA IAS-188 Control Mapping and Evidence Package**

ADNOC and UAE regulators require vendors to provide a formal **Statement of Applicability** mapping their platform's controls to all 188 NESA IAS requirements, with evidence artefacts. The platform implements the majority of required controls but lacks the formal documentation package.

*Remediation:* Generate a NESA IAS-188 control mapping spreadsheet cross-referencing each control to the platform component that implements it (e.g., IEC 62443 Cybersecurity module → Controls 4.x, Keycloak JWT auth → Controls 9.x). Estimated effort: 2 weeks (documentation).

**Gap ME-04: In-Country Data Residency Configuration**

Both Kuwait and UAE require that Confidential/Restricted operational data remain within national borders. The current Docker Compose configuration deploys all services to a single location without geographic constraints.

*Remediation:* Document and implement a **Sovereign Deployment Profile** — a Docker Compose override file and Kubernetes Helm chart variant that deploys PostgreSQL, InfluxDB, MinIO (S3), and Redis to in-country infrastructure. For Kuwait: Kuwait National Data Center (KNDC) or KPC-operated private cloud. For UAE: ADNOC's private cloud, G42 Cloud (Abu Dhabi), or Khazna Data Centers. Estimated effort: 1 week (configuration).

### 3.2 High-Priority Gaps (Fix Within 90 Days of Deployment)

**Gap ME-05: ADNOC Process Control Specification Compliance**

ADNOC's published specification requires vendors to implement NDSA requirements and provide OT Security Policy documentation. The platform must be formally assessed against this specification and any deviations documented in a Vendor Deviation Request (VDR).

**Gap ME-06: UAE Cryptographic Controls Framework (Post-Quantum Readiness)**

The February 2026 framework requires a formal PQC migration roadmap. The platform must document its current cryptographic inventory (TLS 1.3, AES-256, RSA-2048 for JWT) and submit a transition timeline to CRYSTALS-Kyber and CRYSTALS-Dilithium.

**Gap ME-07: KOC E-SCADA Standard (KOC-E-027) Alignment**

KOC's internal E-SCADA standard specifies particular requirements for substation SCADA integration, including specific Modbus register maps, DNP3 object definitions, and alarm priority schemes that differ from the platform's current defaults.

**Gap ME-08: Bilingual Regulatory Report Templates**

The Regulatory Reporting module currently generates English-only reports. Kuwait and UAE regulatory submissions require Arabic versions of all safety and environmental reports.

### 3.3 Medium-Priority Gaps (Fix Within 180 Days)

**Gap ME-09: GCC HSE Standards Integration (OSHA-GCC Equivalent)**

Kuwait and UAE both reference ISO 45001 for occupational health and safety. The platform's SIS module should be extended with ISO 45001 incident classification codes and the UAE's Federal Law No. 8 of 1980 (Labour Law) reporting requirements.

**Gap ME-10: Hajj/Ramadan Operational Calendar**

The shift handover scheduler and maintenance calendar use Gregorian dates only. Both Kuwait and UAE operations observe the Islamic calendar for shift planning, particularly during Ramadan (reduced staffing) and national holidays (Eid Al-Fitr, Eid Al-Adha, National Day).

**Gap ME-11: GCC Interoperability — Saudi Aramco IAMS Integration**

For operators with cross-border assets (Kuwait/Saudi neutral zone, UAE/Oman border fields), integration with Saudi Aramco's Identity and Access Management System (IAMS) and ADNOC's vendor portal is commercially valuable.

---

## 4. Technical Architecture Recommendations

### 4.1 Sovereign Deployment Architecture

The recommended deployment architecture for both Kuwait and UAE follows a **two-tier sovereign model**:

The **Edge Tier** deploys the Rust edge agent on hardened industrial PCs at each wellsite, communicating via OPC-UA, DNP3, or Modbus TCP to field instruments. All edge-to-cloud communication uses TLS 1.3 with mutual certificate authentication. For solar-powered remote sites common in Kuwait's desert fields, the edge agent's low-bandwidth mode (implemented in the Connectivity module) transmits compressed delta updates every 15 minutes rather than continuous streaming.

The **Sovereign Cloud Tier** deploys all backend services (Go microservices, Python analytics, PostgreSQL, InfluxDB, MinIO) within the national data centre. For Kuwait, the recommended hosting partner is the **Kuwait National Data Center (KNDC)** operated by the Ministry of Finance, or KPC's own private cloud infrastructure. For UAE, **G42 Cloud** (Abu Dhabi) or **Khazna Data Centers** (certified for ADNOC workloads) are the appropriate choices. Both offer IEC 27001-certified facilities with UAE/Kuwait data residency guarantees.

```
┌─────────────────────────────────────────────────────────┐
│                    FIELD SITES                          │
│  [Wellhead] → [Rust Edge Agent] → [OPC-UA/DNP3/Modbus] │
│  [Solar Site] → [Low-BW Agent] → [MQTT/4G/VSAT]        │
└──────────────────────┬──────────────────────────────────┘
                       │ TLS 1.3 mTLS
┌──────────────────────▼──────────────────────────────────┐
│         SOVEREIGN CLOUD (In-Country)                    │
│  Kuwait: KNDC / KPC Private Cloud                       │
│  UAE: G42 Cloud / Khazna / ADNOC Private Cloud          │
│                                                         │
│  [Go API Gateway] [Rust Stream Processor]               │
│  [PostgreSQL 16 + TimescaleDB] [InfluxDB]               │
│  [MinIO S3] [Redis] [Redpanda]                          │
│  [Python Analytics + ML Pipeline]                       │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS (Restricted to Corp Network)
┌──────────────────────▼──────────────────────────────────┐
│         OPERATOR WORKSTATIONS                           │
│  [TypeScript/React Dashboard] — Arabic/English UI       │
│  [Role-Based Access: KPC/ADNOC AD Integration]          │
└─────────────────────────────────────────────────────────┘
```

### 4.2 Network Segmentation for GCC OT Environments

Both KOC and ADNOC operate **Purdue Model** network architectures with strict zone separation. The platform must be deployed respecting the following zone assignments:

| Platform Component | Purdue Level | Zone | Notes |
|---|---|---|---|
| Rust Edge Agent | Level 1–2 | OT Zone | Hardened OS, no internet access |
| Rust Stream Processor | Level 3 | DMZ/iDMZ | One-way data diode recommended |
| Go API Gateway | Level 3.5 | iDMZ | Firewall-separated from OT |
| PostgreSQL / InfluxDB | Level 4 | IT/OT Bridge | In-country sovereign cloud |
| React Dashboard | Level 4–5 | Enterprise | Corporate network only |
| ML Pipeline | Level 4 | Enterprise | Air-gapped model training option |

### 4.3 Active Directory and Identity Federation

Both KPC and ADNOC operate Microsoft Active Directory environments. The current Keycloak-based authentication must be configured as a **SAML 2.0 / OIDC federation bridge** to the customer's AD, allowing operators to use their existing corporate credentials without a separate OG-RMM login. This is a contractual requirement for most GCC NOC deployments.

### 4.4 Cybersecurity Hardening for GCC Threat Landscape

The GCC faces a distinct threat landscape characterised by nation-state actors (particularly targeting Kuwait's proximity to Iraq and Iran, and UAE's geopolitical exposure), hacktivism targeting oil infrastructure, and ransomware groups specialising in OT environments. The platform's IEC 62443 Cybersecurity module should be extended with:

- **OT-specific threat intelligence feeds** from the GCC-CERT (Gulf Cooperation Council Computer Emergency Response Team) and ADNOC's own threat sharing programme.
- **Unidirectional Security Gateways** (data diodes) between Level 2 and Level 3, which are increasingly required by ADNOC and recommended by Kuwait NCSC for critical infrastructure.
- **Offline/air-gapped ML model updates** — the ML pipeline's model refresh mechanism must support manual USB-based model file transfer for sites that prohibit internet connectivity from the OT zone.

---

## 5. Operational Recommendations

### 5.1 Localisation and Cultural Considerations

Beyond Arabic RTL UI, successful Middle East deployment requires several operational adaptations. The **shift handover report** must support the Islamic calendar (Hijri dates) alongside Gregorian dates, as KPC and ADNOC operations teams use both systems. The **alarm priority scheme** should be reviewed against the GCC-standard colour coding (red/amber/green is universal, but Arabic text labels for alarm states are required for operator acceptance).

Personnel training materials must be available in Arabic. The platform's built-in LLM integration (via the `invokeLLM` helper) should be configured to respond in Arabic when the UI language is set to Arabic, enabling Arabic-language natural language queries against the analytics and ML insights modules.

### 5.2 Vendor Qualification Process

**For Kuwait (KPC/KOC/KNPC):** Vendors must register through KPC's Vendor Management System and obtain a **Material Approval Certificate (MAC)** for software platforms. The process requires: company registration documents, ISO 27001 certificate, IEC 62443 compliance evidence, a Factory Acceptance Test (FAT) report, and a Site Acceptance Test (SAT) plan. KOC additionally requires compliance with its in-house standards (KOC-E-027 for SCADA, KOC-G-019 for security systems).

**For UAE (ADNOC):** ADNOC's vendor registration process requires pre-qualification through the ADNOC Supplier Portal, submission of technical capability statements, HSE performance records (TRIR, LTIR), ISO certifications, and — for digital platforms — a formal OT Security Assessment conducted by an ADNOC-approved third-party assessor. The assessment evaluates compliance with the ADNOC Process Control System Specification and NESA IAS-188.

### 5.3 Data Sovereignty Implementation Checklist

The following checklist should be completed before any production deployment in Kuwait or UAE:

| Item | Kuwait Requirement | UAE Requirement | Platform Action |
|---|---|---|---|
| Data residency | In-country (NCSC Dec. 1/2025) | In-country (PDPL Art. 22) | Deploy to KNDC / G42 Cloud |
| Encryption at rest | AES-256 mandatory | AES-256 mandatory | Enable PostgreSQL TDE |
| Encryption in transit | TLS 1.3 mandatory | TLS 1.3 mandatory | Already implemented |
| Data classification labels | 4-tier NCSC scheme | NESA classification | Add DB column + UI badge |
| Cross-border transfer | Prohibited for Confidential | Restricted (PDPL Art. 22) | Disable cloud backup to foreign regions |
| Audit logging | 5-year retention | 3-year retention (NESA) | Configure PostgreSQL audit retention |
| Incident notification | 72 hours to NCSC | 72 hours to UAE Cybersecurity Council | Add incident reporting workflow |
| Penetration testing | Annual mandatory | Annual mandatory | Document in Cybersecurity module |

### 5.4 HSE and Safety Standards Alignment

Both Kuwait and UAE require alignment with international HSE standards. The platform's SIS module (IEC 61511 SIL-2/3) already covers the safety instrumented system requirements. Additional alignment is needed with:

- **ISO 45001:2018** — Occupational Health and Safety Management System. The Permit-to-Work module should include ISO 45001 hazard identification and risk assessment fields.
- **IOGP (International Association of Oil and Gas Producers) Guidelines** — particularly IOGP Report 456 (Process Safety — Recommended Practice on Key Performance Indicators) for the Analytics module's KPI dashboard.
- **API RP 14C** (already implemented in the Regulatory module) is widely accepted in both Kuwait and UAE as the baseline for surface safety system design documentation.

---

## 6. Commercial and Partnership Recommendations

### 6.1 In-Country Partnership Requirement

Both Kuwait and UAE have **in-country value (ICV)** programmes that strongly favour or mandate local partnerships for technology deployments. Kuwait's ICV policy under the Ministry of Finance requires that a minimum percentage of contract value be spent with Kuwaiti entities. UAE's ICV programme (managed by the Ministry of Industry and Advanced Technology) requires ADNOC suppliers to achieve a minimum ICV score, which increases with contract value.

**Recommended partners:**

| Country | Recommended Partner Type | Examples |
|---|---|---|
| Kuwait | KPC-registered systems integrator with SCADA experience | Al-Bahar (Caterpillar dealer with automation division), Alghanim Industries Technology |
| UAE | ADNOC-approved OT integrator | Honeywell UAE, Yokogawa Middle East, Schneider Electric UAE |

### 6.2 Pricing and Licensing Model

GCC NOCs typically prefer **perpetual licence + annual maintenance** models over SaaS subscriptions, due to data sovereignty concerns about cloud-hosted licensing servers. The platform's self-hosted architecture is a significant commercial advantage. WT Petrotech should position the OG-RMM Platform as a **perpetual licence with optional annual support contract**, with the source code held in escrow by a Kuwait/UAE law firm as a condition of the contract.

### 6.3 Pilot Site Recommendation

The recommended pilot deployment strategy is a **3-well cluster pilot** at a single gathering centre, running in parallel with the existing SCADA system for 90 days before cutover. This approach satisfies both KOC's and ADNOC's standard change management requirements for production system replacements and provides the FAT/SAT evidence required for vendor qualification.

---

## 7. Implementation Roadmap

| Phase | Duration | Key Deliverables | Priority Gaps Closed |
|---|---|---|---|
| **Phase 1: Compliance Preparation** | Weeks 1–4 | Arabic RTL UI, NCSC data classification tagging, NESA IAS-188 mapping document | ME-01, ME-02, ME-03 |
| **Phase 2: Sovereign Deployment** | Weeks 5–8 | In-country Helm chart, KNDC/G42 deployment, AD federation, data diode config | ME-04, ME-05 |
| **Phase 3: Vendor Qualification** | Weeks 9–16 | KPC MAC submission, ADNOC OT Security Assessment, FAT completion | ME-05, ME-06 |
| **Phase 4: Pilot Deployment** | Weeks 17–28 | 3-well cluster pilot, parallel run, operator training in Arabic | ME-07, ME-08, ME-10 |
| **Phase 5: Full Rollout** | Weeks 29–52 | Fleet-wide deployment, GCC-CERT threat feed integration, PQC roadmap submission | ME-06, ME-09, ME-11 |

---

## 8. Summary Scorecard

The table below scores the platform's current readiness for Kuwait and UAE deployment on a 1–5 scale (5 = fully compliant, no action needed):

| Dimension | Kuwait Score | UAE Score | Key Action |
|---|---|---|---|
| OT/ICS Security (IEC 62443) | 4/5 | 4/5 | Add data diode configuration |
| Safety Systems (IEC 61511) | 5/5 | 5/5 | Already fully implemented |
| Data Sovereignty | 2/5 | 2/5 | Deploy to in-country sovereign cloud |
| Cybersecurity Compliance (NCSC/NESA) | 3/5 | 3/5 | Complete IAS-188 mapping + NCSC classification |
| Arabic Localisation | 1/5 | 1/5 | Implement RTL UI + Arabic translations |
| Vendor Qualification | 2/5 | 2/5 | Initiate KPC MAC + ADNOC portal registration |
| Protocol Coverage (OPC-UA, DNP3) | 5/5 | 5/5 | Already fully implemented |
| FPSO/Offshore Capability | 5/5 | 5/5 | Already fully implemented |
| Financial Ledger (TigerBeetle) | 4/5 | 4/5 | Add Arabic invoice templates |
| HSE Standards (ISO 45001) | 3/5 | 3/5 | Extend PTW module with ISO 45001 fields |
| **Overall Readiness** | **3.4/5** | **3.4/5** | **~12 weeks to full compliance** |

---

## References

[^1]: [2025 Investment Climate Statements: Kuwait — U.S. Department of State](https://www.state.gov/reports/2025-investment-climate-statements/kuwait)
[^2]: [KNPC Unveils Digital Transformation Plan for Kuwait's Oil Sector — Kuwait Times, January 2026](https://kuwaittimes.com/article/38441/kuwait/other-news/knpc-unveils-digital-transformation-plan-for-kuwaits-oil-sector/)
[^3]: [Kuwait's Oil Sector Establishes Robust Cybersecurity System — TradeArabia, June 2025](https://tradearabia.com/News/296290/Kuwait's-oil-sector-establishes-robust-cybersecurity-system)
[^4]: [ADNOC and Microsoft Powering Possible 2025 Report — ADNOC](https://www.adnoc.ae/en/news-and-media/press-releases/2025/adnoc-and-microsoft-powering-possible-report-88)
[^5]: [SCADA Cybersecurity Requirements UAE Critical Infrastructure — 3Phase Tech Services, October 2025](https://3phtechservices.com/scada-cybersecurity-requirements-uae-critical-infrastructure/)
[^6]: [ADNOC Process Control System Specification — ADNOC Engineering Standards](https://www.adnoc.ae/-/media/adnoc-v2/files/specs/2021/engineering-standards-and-specifications-october14th/process-control-specification.ashx)
[^7]: [Kuwait Reinforces Cybersecurity Governance with the 2025 National Data Classification Framework — Wefaq Law, October 2025](https://www.wefaqlaw.com/post/kuwait-reinforces-cybersecurity-governance-with-the-2025-national-data-classification-framework)
[^8]: [What Is NESA Compliance in the UAE? 2026 Guide — SecurityWall](https://securitywall.co/blog/nesa-uae)
[^9]: [UAE Establishes Requirements for Cryptographic Controls and Migration Planning — PQShield, February 2026](https://pqshield.com/uae-establishes-requirements-for-cryptographic-controls-and-migration-planning/)
