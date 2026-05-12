import type { Express } from "express";

/**
 * Agriculture Enhancement — 40 services (ports 8589–8628)
 * Phase 1: Cooperative, Livestock, Input Marketplace, NIRSAL CRG, CBN ABP, Interactive USSD
 * Phase 2: Savings Cycles, Livestock Finance, Commodity Exchange, E-Vouchers, Price Intelligence, Satellite
 * Phase 3: CoopScore, Fisheries, Farm Boundaries, AYII, Warehouse Mgmt, Agent Onboarding
 * Phase 4: Livestock Insurance, Equipment Leasing, Yield Prediction, MPCI, Logistics, CBN Returns
 * Phase 5: Animal ID, NAGC, IoT Sensors, Reinsurance, Certification, ESG, Cross-border
 * Phase 6: Meeting Mgmt, Coop Financials, Soil Analysis, Insurance Analytics, Parametric IoT, Post-Harvest, Aggregation, AGSMEIS, ACGSF
 */

interface AgriService {
  path: string;
  port: number;
  topic: string;
  name: string;
}

const AGRI_SERVICES: AgriService[] = [
  { path: "cooperative-management", port: 8589, topic: "cooperative_management", name: "cooperative-management-go" },
  { path: "livestock-management", port: 8590, topic: "livestock_management", name: "livestock-management-rs" },
  { path: "agri-input-marketplace", port: 8591, topic: "agri_input_marketplace", name: "agri-input-marketplace-go" },
  { path: "nirsal-credit-guarantee", port: 8592, topic: "nirsal_credit_guarantee", name: "nirsal-credit-guarantee-go" },
  { path: "cbn-anchor-borrowers", port: 8593, topic: "cbn_anchor_borrowers", name: "cbn-anchor-borrowers-go" },
  { path: "interactive-ussd-agri", port: 8594, topic: "interactive_ussd_agri", name: "interactive-ussd-agri-py" },
  { path: "agri-savings-cycles", port: 8595, topic: "agri_savings_cycles", name: "agri-savings-cycles-go" },
  { path: "livestock-finance", port: 8596, topic: "livestock_finance", name: "livestock-finance-rs" },
  { path: "commodity-exchange", port: 8597, topic: "commodity_exchange", name: "commodity-exchange-rs" },
  { path: "agri-evoucher", port: 8598, topic: "agri_evoucher", name: "agri-evoucher-go" },
  { path: "commodity-price-intelligence", port: 8599, topic: "commodity_price_intelligence", name: "commodity-price-intelligence-py" },
  { path: "satellite-crop-monitor", port: 8600, topic: "satellite_crop_monitor", name: "satellite-crop-monitor-rs" },
  { path: "cooperative-credit-scoring", port: 8601, topic: "cooperative_credit_scoring", name: "cooperative-credit-scoring-py" },
  { path: "fisheries-aquaculture", port: 8602, topic: "fisheries_aquaculture", name: "fisheries-aquaculture-go" },
  { path: "farm-boundary-mapping", port: 8603, topic: "farm_boundary_mapping", name: "farm-boundary-mapping-rs" },
  { path: "area-yield-index-insurance", port: 8604, topic: "area_yield_index_insurance", name: "area-yield-index-insurance-py" },
  { path: "warehouse-management", port: 8605, topic: "warehouse_management", name: "warehouse-management-go" },
  { path: "agent-farmer-onboarding", port: 8606, topic: "agent_farmer_onboarding", name: "agent-farmer-onboarding-go" },
  { path: "livestock-insurance", port: 8607, topic: "livestock_insurance", name: "livestock-insurance-rs" },
  { path: "equipment-leasing", port: 8608, topic: "equipment_leasing", name: "equipment-leasing-go" },
  { path: "crop-yield-prediction", port: 8609, topic: "crop_yield_prediction", name: "crop-yield-prediction-py" },
  { path: "multi-peril-crop-insurance", port: 8610, topic: "multi_peril_crop_insurance", name: "multi-peril-crop-insurance-rs" },
  { path: "agri-logistics", port: 8611, topic: "agri_logistics", name: "agri-logistics-go" },
  { path: "cbn-agri-returns", port: 8612, topic: "cbn_agri_returns", name: "cbn-agri-returns-py" },
  { path: "animal-id-traceability", port: 8613, topic: "animal_id_traceability", name: "animal-id-traceability-rs" },
  { path: "nirsal-agro-geocoop", port: 8614, topic: "nirsal_agro_geocoop", name: "nirsal-agro-geocoop-go" },
  { path: "agri-iot-sensor", port: 8615, topic: "agri_iot_sensor", name: "agri-iot-sensor-rs" },
  { path: "agri-reinsurance", port: 8616, topic: "agri_reinsurance", name: "agri-reinsurance-go" },
  { path: "quality-certification", port: 8617, topic: "quality_certification", name: "quality-certification-go" },
  { path: "agri-esg-impact", port: 8618, topic: "agri_esg_impact", name: "agri-esg-impact-py" },
  { path: "crossborder-agri-trade", port: 8619, topic: "crossborder_agri_trade", name: "crossborder-agri-trade-rs" },
  { path: "cooperative-meetings", port: 8620, topic: "cooperative_meetings", name: "cooperative-meetings-go" },
  { path: "cooperative-financials", port: 8621, topic: "cooperative_financials", name: "cooperative-financials-py" },
  { path: "soil-analysis", port: 8622, topic: "soil_analysis", name: "soil-analysis-py" },
  { path: "insurance-portfolio-analytics", port: 8623, topic: "insurance_portfolio_analytics", name: "insurance-portfolio-analytics-py" },
  { path: "parametric-insurance-iot", port: 8624, topic: "parametric_insurance_iot", name: "parametric-insurance-iot-rs" },
  { path: "post-harvest-loss-tracker", port: 8625, topic: "post_harvest_loss_tracker", name: "post-harvest-loss-tracker-go" },
  { path: "aggregation-center", port: 8626, topic: "aggregation_center", name: "aggregation-center-go" },
  { path: "cbn-agsmeis", port: 8627, topic: "cbn_agsmeis", name: "cbn-agsmeis-go" },
  { path: "acgsf-guarantee", port: 8628, topic: "acgsf_guarantee", name: "acgsf-guarantee-go" },
];

export function registerAgricultureEnhancementRoutes(app: Express): void {
  for (const svc of AGRI_SERVICES) {
    const proxyUrl = `http://localhost:${svc.port}/v1/${svc.topic}/list`;
    const seedData = { items: [], total: 0, service: svc.name, note: "seed-data-fallback" };

    // GET list endpoint
    app.get(`/api/agriculture-enhancement/${svc.path}/list`, async (_req, res) => {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 3000);
        const resp = await fetch(proxyUrl, { signal: ctrl.signal });
        clearTimeout(timer);
        const data = await resp.json();
        res.json(data);
      } catch {
        res.json(seedData);
      }
    });

    // GET healthz endpoint
    app.get(`/api/agriculture-enhancement/${svc.path}/healthz`, async (_req, res) => {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 3000);
        const resp = await fetch(`http://localhost:${svc.port}/healthz`, { signal: ctrl.signal });
        clearTimeout(timer);
        const data = await resp.json();
        res.json(data);
      } catch {
        res.json({ status: "unavailable", service: svc.name, fallback: true });
      }
    });
  }
}
