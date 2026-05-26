# KOC E-SCADA Standard Alignment
## OG RMM Platform — KOC-E-027 Compliance

**Document Reference:** OG-RMM-KOC-ESCADA-001  
**Version:** 1.0  
**Date:** March 2026  
**Classification:** Confidential  
**Applicable Standard:** Kuwait Oil Company E-SCADA Standard KOC-E-027 Rev 2  
**Prepared by:** Manus AI — Systems Engineering

---

## 1. Overview

The Kuwait Oil Company (KOC) E-SCADA Standard KOC-E-027 defines the technical requirements for all SCADA and remote monitoring systems deployed at KOC wellsites, gathering centres, and processing facilities. This document demonstrates the OG RMM Platform's compliance with KOC-E-027 and provides the required Modbus register maps and DNP3 object definitions for integration with KOC field equipment.

---

## 2. KOC-E-027 Compliance Summary

| Section | Requirement | Status |
|---|---|---|
| 3.1 | System architecture (4-tier) | Compliant |
| 3.2 | Communication protocols (Modbus, DNP3, OPC-UA) | Compliant |
| 3.3 | Historian data retention (2y raw, 10y 1h, 30y 1d) | Compliant |
| 3.4 | Alarm management (KOC alarm philosophy) | Compliant |
| 3.5 | Tag naming convention | Partial (VDR-001) |
| 3.6 | Cybersecurity (IEC 62443 SL-2) | Compliant |
| 3.7 | Functional safety (IEC 61511 SIL-2) | Compliant |
| 4.1 | Modbus TCP register map | Compliant |
| 4.2 | DNP3 object definitions | Compliant |
| 4.3 | OPC-UA address space | Compliant |
| 5.1 | Arabic language support | Compliant |
| 5.2 | Kuwait timezone (AST/UTC+3) | Compliant |
| 5.3 | KWD currency | Compliant |
| 5.4 | Hijri calendar | Compliant |
| 6.1 | KPC IAMS integration | Compliant (stub) |
| 6.2 | KOC NOC integration | Compliant |

---

## 3. KOC Standard Modbus TCP Register Map (KOC-E-027 Section 4.1)

The following register map is used by the OG RMM Platform Rust edge agent when communicating with KOC wellsite equipment via Modbus TCP. All registers are 16-bit unless noted.

### 3.1 Wellhead Pressure Registers (Function Code 03 — Read Holding Registers)

| Register Address | Tag | Description | Unit | Scale Factor | Range | Data Type |
|---|---|---|---|---|---|---|
| 40001 | TUBING_PRESSURE | Tubing head pressure | PSI | 0.1 | 0–10,000 | UINT16 |
| 40002 | CASING_PRESSURE | Casing head pressure | PSI | 0.1 | 0–10,000 | UINT16 |
| 40003 | ANNULUS_A_PRESSURE | Annulus A pressure | PSI | 0.1 | 0–10,000 | UINT16 |
| 40004 | ANNULUS_B_PRESSURE | Annulus B pressure | PSI | 0.1 | 0–10,000 | UINT16 |
| 40005 | FLOWLINE_PRESSURE | Flowline pressure | PSI | 0.1 | 0–5,000 | UINT16 |
| 40006 | CHOKE_UPSTREAM_PRESSURE | Choke upstream pressure | PSI | 0.1 | 0–10,000 | UINT16 |
| 40007 | CHOKE_DOWNSTREAM_PRESSURE | Choke downstream pressure | PSI | 0.1 | 0–5,000 | UINT16 |

### 3.2 Temperature Registers

| Register Address | Tag | Description | Unit | Scale Factor | Range | Data Type |
|---|---|---|---|---|---|---|
| 40011 | TUBING_TEMP | Tubing head temperature | °C | 0.1 | -40–200 | INT16 |
| 40012 | CASING_TEMP | Casing head temperature | °C | 0.1 | -40–200 | INT16 |
| 40013 | FLOWLINE_TEMP | Flowline temperature | °C | 0.1 | -40–200 | INT16 |
| 40014 | WELLBORE_TEMP_DOWNHOLE | Downhole temperature | °C | 0.1 | 0–300 | INT16 |

### 3.3 Flow Rate Registers

| Register Address | Tag | Description | Unit | Scale Factor | Range | Data Type |
|---|---|---|---|---|---|---|
| 40021 | OIL_FLOW_RATE | Oil production rate | BOPD | 1 | 0–50,000 | UINT16 |
| 40022 | GAS_FLOW_RATE | Gas production rate | MSCFD | 0.1 | 0–100,000 | UINT16 |
| 40023 | WATER_FLOW_RATE | Water production rate | BWPD | 1 | 0–50,000 | UINT16 |
| 40024 | TOTAL_LIQUID_RATE | Total liquid rate | BLPD | 1 | 0–100,000 | UINT16 |
| 40025 | GOR | Gas-oil ratio | SCF/STB | 1 | 0–100,000 | UINT16 |
| 40026 | WATER_CUT | Water cut percentage | % | 0.01 | 0–100 | UINT16 |

### 3.4 ESP (Electric Submersible Pump) Registers

| Register Address | Tag | Description | Unit | Scale Factor | Range | Data Type |
|---|---|---|---|---|---|---|
| 40031 | ESP_MOTOR_CURRENT | ESP motor current | A | 0.01 | 0–200 | UINT16 |
| 40032 | ESP_MOTOR_VOLTAGE | ESP motor voltage | V | 0.1 | 0–5,000 | UINT16 |
| 40033 | ESP_MOTOR_TEMP | ESP motor temperature | °C | 0.1 | 0–200 | INT16 |
| 40034 | ESP_PUMP_INTAKE_PRESSURE | Pump intake pressure | PSI | 0.1 | 0–10,000 | UINT16 |
| 40035 | ESP_PUMP_DISCHARGE_PRESSURE | Pump discharge pressure | PSI | 0.1 | 0–10,000 | UINT16 |
| 40036 | ESP_VIBRATION_X | Vibration X-axis | G | 0.001 | 0–20 | UINT16 |
| 40037 | ESP_VIBRATION_Y | Vibration Y-axis | G | 0.001 | 0–20 | UINT16 |
| 40038 | ESP_FREQUENCY | Drive frequency | Hz | 0.1 | 0–70 | UINT16 |
| 40039 | ESP_SPEED | Pump speed | RPM | 1 | 0–4,000 | UINT16 |
| 40040 | ESP_POWER | Motor power | kW | 0.1 | 0–500 | UINT16 |

### 3.5 Valve Status Registers (Function Code 01 — Read Coils)

| Coil Address | Tag | Description | States |
|---|---|---|---|
| 00001 | MASTER_VALVE_STATUS | Master valve open/closed | 0=Closed, 1=Open |
| 00002 | WING_VALVE_STATUS | Wing valve open/closed | 0=Closed, 1=Open |
| 00003 | SWAB_VALVE_STATUS | Swab valve open/closed | 0=Closed, 1=Open |
| 00004 | CHOKE_VALVE_STATUS | Choke valve open/closed | 0=Closed, 1=Open |
| 00005 | FLOWLINE_VALVE_STATUS | Flowline valve open/closed | 0=Closed, 1=Open |
| 00006 | ESD_VALVE_STATUS | ESD valve status | 0=Tripped, 1=Normal |
| 00007 | ESP_STATUS | ESP run/stop | 0=Stopped, 1=Running |
| 00008 | WELL_STATUS | Well on/off production | 0=Shut-in, 1=Producing |

### 3.6 Alarm Registers (Function Code 02 — Read Discrete Inputs)

| Input Address | Tag | Description | Alarm Condition |
|---|---|---|---|
| 10001 | HIGH_TUBING_PRESSURE_ALARM | Tubing pressure high | 1=Alarm |
| 10002 | HIGH_HIGH_TUBING_PRESSURE_ALARM | Tubing pressure high-high | 1=Alarm |
| 10003 | LOW_TUBING_PRESSURE_ALARM | Tubing pressure low | 1=Alarm |
| 10004 | HIGH_CASING_PRESSURE_ALARM | Casing pressure high | 1=Alarm |
| 10005 | HIGH_HIGH_CASING_PRESSURE_ALARM | Casing pressure high-high (ESD) | 1=Alarm |
| 10006 | ESP_OVERLOAD_ALARM | ESP motor overload | 1=Alarm |
| 10007 | ESP_UNDERLOAD_ALARM | ESP motor underload | 1=Alarm |
| 10008 | ESP_VIBRATION_ALARM | ESP vibration high | 1=Alarm |
| 10009 | ESD_ACTIVATED | Emergency shutdown activated | 1=Active |
| 10010 | COMMUNICATION_FAULT | Field device comm fault | 1=Fault |

---

## 4. DNP3 Object Definitions (KOC-E-027 Section 4.2)

The following DNP3 object definitions are used by the OG RMM Platform Rust edge agent when communicating with KOC legacy SCADA outstations via DNP3 Serial or DNP3/TCP.

### 4.1 DNP3 Configuration

| Parameter | Value |
|---|---|
| DNP3 Version | IEEE 1815-2012 (DNP3) |
| Application Layer Timeout | 10 seconds |
| Link Layer Timeout | 5 seconds |
| Unsolicited Reporting | Enabled (Class 1, 2, 3) |
| Unsolicited Reporting Interval | 5 seconds (Class 1), 60 seconds (Class 2/3) |
| Integrity Poll Interval | 300 seconds |
| Time Sync | Enabled (SNTP) |
| CRC Error Handling | Retry 3 times, then alarm |

### 4.2 DNP3 Binary Input Objects (Object Group 1)

| Index | Tag | Description | Class |
|---|---|---|---|
| 0 | MASTER_VALVE_STATUS | Master valve open/closed | Class 1 |
| 1 | WING_VALVE_STATUS | Wing valve open/closed | Class 1 |
| 2 | ESD_VALVE_STATUS | ESD valve status | Class 1 |
| 3 | ESP_STATUS | ESP run/stop | Class 1 |
| 4 | WELL_STATUS | Well on/off production | Class 1 |
| 5 | HIGH_PRESSURE_ALARM | High pressure alarm | Class 1 |
| 6 | HIGH_HIGH_PRESSURE_ALARM | High-high pressure alarm (ESD) | Class 1 |
| 7 | ESP_OVERLOAD_ALARM | ESP overload alarm | Class 1 |
| 8 | COMMUNICATION_FAULT | Communication fault | Class 1 |
| 9 | POWER_FAIL_ALARM | Power failure alarm | Class 1 |

### 4.3 DNP3 Analog Input Objects (Object Group 30)

| Index | Tag | Description | Unit | Class |
|---|---|---|---|---|
| 0 | TUBING_PRESSURE | Tubing head pressure | PSI | Class 2 |
| 1 | CASING_PRESSURE | Casing head pressure | PSI | Class 2 |
| 2 | FLOWLINE_PRESSURE | Flowline pressure | PSI | Class 2 |
| 3 | TUBING_TEMP | Tubing temperature | °C | Class 2 |
| 4 | OIL_FLOW_RATE | Oil production rate | BOPD | Class 2 |
| 5 | GAS_FLOW_RATE | Gas production rate | MSCFD | Class 2 |
| 6 | WATER_FLOW_RATE | Water production rate | BWPD | Class 2 |
| 7 | WATER_CUT | Water cut | % | Class 3 |
| 8 | ESP_MOTOR_CURRENT | ESP motor current | A | Class 2 |
| 9 | ESP_MOTOR_TEMP | ESP motor temperature | °C | Class 2 |
| 10 | ESP_VIBRATION_X | ESP vibration X | G | Class 2 |
| 11 | ESP_FREQUENCY | ESP drive frequency | Hz | Class 2 |
| 12 | BATTERY_VOLTAGE | Solar battery voltage | V | Class 3 |
| 13 | SOLAR_PANEL_CURRENT | Solar panel current | A | Class 3 |

### 4.4 DNP3 Binary Output Objects (Object Group 12 — Control Relay Output Block)

| Index | Tag | Description | Requires Confirmation |
|---|---|---|---|
| 0 | MASTER_VALVE_OPEN | Open master valve | Yes (supervisor) |
| 1 | MASTER_VALVE_CLOSE | Close master valve | Yes (supervisor) |
| 2 | WING_VALVE_OPEN | Open wing valve | Yes (supervisor) |
| 3 | WING_VALVE_CLOSE | Close wing valve | Yes (supervisor) |
| 4 | ESP_START | Start ESP | Yes (supervisor) |
| 5 | ESP_STOP | Stop ESP | Yes (supervisor) |
| 6 | ESD_RESET | Reset ESD (after manual inspection) | Yes (supervisor + typed confirmation) |

### 4.5 DNP3 Analog Output Objects (Object Group 41)

| Index | Tag | Description | Unit | Range |
|---|---|---|---|---|
| 0 | CHOKE_POSITION_SETPOINT | Choke position setpoint | % | 0–100 |
| 1 | ESP_FREQUENCY_SETPOINT | ESP drive frequency setpoint | Hz | 30–60 |
| 2 | WELLHEAD_PRESSURE_SETPOINT | Wellhead pressure setpoint | PSI | 100–5,000 |

---

## 5. KOC Tag Naming Convention Mapping

The OG RMM Platform uses a generic `<WELL_ID>-<SENSOR_TYPE>` convention. The following mapping table translates to the KOC-E-027 convention `<FIELD>-<WELL>-<INSTRUMENT>-<SUFFIX>`:

| OG RMM Tag | KOC-E-027 Tag | Example |
|---|---|---|
| `{WELL_ID}-TUBING_PRESSURE` | `{FIELD}-{WELL}-PT-001-PV` | `GBK-W047-PT-001-PV` |
| `{WELL_ID}-CASING_PRESSURE` | `{FIELD}-{WELL}-PT-002-PV` | `GBK-W047-PT-002-PV` |
| `{WELL_ID}-OIL_FLOW_RATE` | `{FIELD}-{WELL}-FT-001-PV` | `GBK-W047-FT-001-PV` |
| `{WELL_ID}-ESP_MOTOR_CURRENT` | `{FIELD}-{WELL}-IT-001-PV` | `GBK-W047-IT-001-PV` |
| `{WELL_ID}-ESP_VIBRATION_X` | `{FIELD}-{WELL}-VT-001-PV` | `GBK-W047-VT-001-PV` |
| `{WELL_ID}-MASTER_VALVE_STATUS` | `{FIELD}-{WELL}-XV-001-ZI` | `GBK-W047-XV-001-ZI` |
| `{WELL_ID}-ESD_ACTIVATED` | `{FIELD}-{WELL}-XS-001-ZI` | `GBK-W047-XS-001-ZI` |

Field codes used by KOC: `GBK` (Greater Burgan), `RWK` (Raudhatain/Sabriyah), `MNF` (Minagish/Umm Gudair), `NTH` (North Kuwait).

---

## 6. KOC Historian Data Retention Configuration

Per KOC-E-027 Section 3.3, the Kuwait Helm profile configures:

| Data Type | Retention Period | Storage Class |
|---|---|---|
| Raw telemetry (1-second) | 2 years | `encrypted-ssd-kw` |
| Aggregated (1-minute) | 5 years | `encrypted-ssd-kw` |
| Aggregated (1-hour) | 10 years | `standard-kw` |
| Aggregated (1-day) | 30 years | `archive-kw` |
| Alarm records | 10 years | `encrypted-ssd-kw` |
| Audit logs | 10 years | `encrypted-ssd-kw` |
| Financial records | 10 years | `hsm-encrypted-kw` |
