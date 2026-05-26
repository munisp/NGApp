# OpenSTEF Integration Assessment for OG-RMM Platform

**Author:** Manus AI | **Date:** March 2026 | **Version:** 1.0

---

## Executive Summary

[OpenSTEF](https://github.com/OpenSTEF/openstef) (Open Short-Term Energy Forecasting) is a Linux Foundation Energy project that provides automated machine learning pipelines for 48-hour ahead load and generation forecasting. Originally developed by Alliander (a Dutch DSO) for electricity grid congestion management, its core algorithms — XGBoost, LightGBM, Prophet, and custom gradient-boosted regressors — are domain-agnostic time-series forecasters. **The OG-RMM platform can derive meaningful value from OpenSTEF in at least five concrete areas**, primarily by treating oil/gas production and energy consumption as the "load" signal that OpenSTEF was designed to forecast.

---

## What OpenSTEF Does

OpenSTEF delivers a complete ML pipeline covering data ingestion, feature engineering, model training, hyperparameter optimisation, backtesting, and inference. Its key characteristics are summarised below.

| Capability | Detail |
|---|---|
| **Forecast horizon** | 15 min to 48 hours ahead (configurable) |
| **Core models** | XGBoost, LightGBM, Linear, Prophet, custom ensembles |
| **Input signals** | Any time-series (load, weather, price, calendar) |
| **Output** | Point forecast + quantile confidence intervals (P10/P50/P90) |
| **AutoML** | Automated feature selection, hyperparameter tuning, model selection |
| **Explainability** | SHAP feature importance built-in |
| **License** | Mozilla Public License 2.0 (commercial-friendly) |
| **Language** | Python 3.9+ |
| **Integration** | REST API via `openstef-reference`; Kafka-compatible via custom connector |

---

## Value Proposition for OG-RMM

### 1. Production Volume Forecasting (Highest Value)

The most direct application is treating well-level oil, gas, and water production rates as the "load" signal. OpenSTEF can ingest the RTDIP Delta Lakehouse time-series (already integrated in v12.0) and produce 48-hour production forecasts per well or per field. These forecasts feed directly into:

- **Decline curve validation** — compare OpenSTEF's data-driven ML forecast against the Arps decline model already implemented in the Production Optimization module. Divergence between the two signals an anomaly (e.g., a skin damage event or tubing leak).
- **Allocation planning** — the TigerBeetle ledger (v12.0) can use forecast volumes to pre-allocate royalty and production credits before the actual measurement arrives, reducing end-of-day reconciliation lag.
- **Regulatory reporting** — KOC and ARAMCO monthly production reports require 30-day forecasts; OpenSTEF P50/P90 intervals satisfy this requirement with documented uncertainty bounds.

### 2. Energy Demand Forecasting for OpenADR Demand Response

The OG-RMM platform already integrates OpenADR 3.1 via the `demandResponse` tRPC router. OpenSTEF can forecast the **electrical load** of compressor stations, ESP pumps, water injection pumps, and gas lift compressors. This forecast is the prerequisite for:

- Generating **proactive OpenADR DR events** before grid congestion occurs (rather than reacting to utility signals).
- Calculating **baseline energy consumption** (the "customer baseline load" required by FERC Order 745 and equivalent GCC regulations) against which demand response curtailment is measured.
- Optimising the **setpoint advisor** in the Production Optimization module — if OpenSTEF forecasts a high-load period, the advisor can pre-emptively reduce ESP speed to flatten the demand curve.

### 3. Predictive Maintenance via Anomaly Detection

OpenSTEF's confidence intervals (P10/P90) create a natural anomaly detection envelope. When a sensor reading falls outside the P10–P90 band, it triggers an alarm rule. This is more sophisticated than the static threshold alarms currently in the ISA-18.2 alarm rules module, because the envelope adapts to operating conditions (temperature, pressure, flow regime).

### 4. ESP Failure Prediction Enhancement

The ML Insights module currently uses a static XGBoost model trained offline. OpenSTEF's AutoML pipeline can retrain this model nightly using fresh data from the Delta Lakehouse, automatically selecting the best model and features. This closes the model drift problem without manual retraining.

### 5. Shift Handover Forecast Briefings

The Shift Handover module can embed a 12-hour OpenSTEF production forecast in the handover document, giving the incoming operator a data-driven expectation of what the field will produce during their shift. This replaces the current practice of using the previous shift's actual as a proxy.

---

## Integration Architecture

```
RTDIP Delta Lakehouse (Python)
        │  time-series tags (OPC-UA → Delta)
        ▼
OpenSTEF Forecasting Service (Python, new sidecar)
  ├── openstef.tasks.create_forecast  (runs every 15 min via Temporal)
  ├── openstef.tasks.train_model      (runs nightly via Temporal)
  └── REST API  /forecast/{wellId}?horizon=48h
        │
        ▼
server/routers/forecasting.ts  (new tRPC router)
  ├── getForecast(wellId, horizon)
  ├── getModelMetrics(wellId)
  └── getAnomalyStatus(wellId)
        │
        ▼
Frontend: WellDetail → Forecast tab
          ProductionOptimization → ML Forecast panel
          DemandResponse → Baseline Load panel
```

The OpenSTEF service connects to the RTDIP FastAPI (already on port 8000) to retrieve historical tag data, runs inference, and exposes results via a lightweight REST endpoint. Temporal (already integrated) schedules the `create_forecast` and `train_model` tasks, eliminating the need for a separate cron infrastructure.

---

## Implementation Effort Estimate

| Component | Effort | Notes |
|---|---|---|
| `middleware/python/openstef_service.py` | 2–3 days | FastAPI wrapper around `openstef` package |
| Temporal activity: `create_forecast` | 0.5 days | Calls OpenSTEF REST, stores result in Delta |
| Temporal activity: `train_model` | 0.5 days | Nightly retraining with latest Delta data |
| `server/routers/forecasting.ts` | 1 day | tRPC router proxying OpenSTEF REST |
| WellDetail Forecast tab | 1 day | P10/P50/P90 chart, SHAP feature bar |
| DemandResponse baseline panel | 0.5 days | Overlay OpenSTEF load forecast on DR events |
| **Total** | **~6 days** | Incremental on top of v12.0 |

---

## Recommendation

**Integrate OpenSTEF.** The value is highest in three areas: (1) production volume forecasting feeding the TigerBeetle ledger and regulatory reports, (2) energy load forecasting feeding proactive OpenADR DR events, and (3) anomaly detection envelopes replacing static ISA-18.2 thresholds. The integration is low-risk because OpenSTEF is a pure Python library (no new infrastructure required beyond the existing RTDIP Python sidecar), it is Apache/MPL-2.0 licensed, and it is actively maintained under the Linux Foundation Energy umbrella — the same governance body overseeing RTDIP itself.

The only prerequisite is sufficient historical tag data in the Delta Lakehouse (minimum 4 weeks of 15-minute resolution data per well) to train the initial models. Given that the RTDIP OPC-UA simulator is already generating synthetic data, a training dataset can be bootstrapped immediately.

---

## References

[1] OpenSTEF GitHub Repository — https://github.com/OpenSTEF/openstef  
[2] OpenSTEF Documentation — https://openstef.github.io/openstef/  
[3] Linux Foundation Energy Project Page — https://lfenergy.org/projects/openstef/  
[4] RTDIP Documentation — https://www.rtdip.io/  
[5] OpenADR 3.1 Specification — https://www.openadr.org/  
