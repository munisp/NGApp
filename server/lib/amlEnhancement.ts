// AML Enhancement — Express proxy routes for 15 AML services
// Auto-generated: ports 8574-8588
import type { Express, Request, Response } from "express";

const proxyOrSeed = async (serviceUrl: string, path: string, seed: unknown, _req: Request, res: Response) => {
  try {
    const resp = await fetch(`${serviceUrl}${path}`);
    if (resp.ok) { res.json(await resp.json()); return; }
    throw new Error(`Service returned ${resp.status}`);
  } catch {
    res.json(seed);
  }
};

export function registerAMLEnhancementRoutes(app: Express) {
  const AML_RISK_SCORING_URL = process.env.AML_RISK_SCORING_URL || "http://localhost:8574";
  const SAR_FILING_URL = process.env.SAR_FILING_URL || "http://localhost:8575";
  const CTR_AUTO_FILER_URL = process.env.CTR_AUTO_FILER_URL || "http://localhost:8576";
  const AML_CASE_MANAGER_URL = process.env.AML_CASE_MANAGER_URL || "http://localhost:8577";
  const WATCHLIST_MANAGER_URL = process.env.WATCHLIST_MANAGER_URL || "http://localhost:8578";
  const ADVERSE_MEDIA_SCANNER_URL = process.env.ADVERSE_MEDIA_SCANNER_URL || "http://localhost:8579";
  const BENEFICIAL_OWNERSHIP_URL = process.env.BENEFICIAL_OWNERSHIP_URL || "http://localhost:8580";
  const TXN_PATTERN_ANALYZER_URL = process.env.TXN_PATTERN_ANALYZER_URL || "http://localhost:8581";
  const GOAML_INTEGRATION_URL = process.env.GOAML_INTEGRATION_URL || "http://localhost:8582";
  const AML_COMPLIANCE_DASHBOARD_URL = process.env.AML_COMPLIANCE_DASHBOARD_URL || "http://localhost:8583";
  const SANCTIONS_BATCH_RESCREENER_URL = process.env.SANCTIONS_BATCH_RESCREENER_URL || "http://localhost:8584";
  const AML_TRAINING_TRACKER_URL = process.env.AML_TRAINING_TRACKER_URL || "http://localhost:8585";
  const WIRE_TRANSFER_MONITOR_URL = process.env.WIRE_TRANSFER_MONITOR_URL || "http://localhost:8586";
  const REGULATORY_REPORTING_URL = process.env.REGULATORY_REPORTING_URL || "http://localhost:8587";
  const TYPOLOGY_DETECTOR_URL = process.env.TYPOLOGY_DETECTOR_URL || "http://localhost:8588";

  app.get("/api/aml-enhancement/aml-risk-scoring/list", (req, res) => { void proxyOrSeed(AML_RISK_SCORING_URL, "/v1/aml-risk-scoring/list", { total: 0, risk_scores: [] }, req, res); });
  app.get("/api/aml-enhancement/aml-risk-scoring/stats", (req, res) => { void proxyOrSeed(AML_RISK_SCORING_URL, "/v1/aml-risk-scoring/stats", { total: 0, service: "aml-risk-scoring" }, req, res); });
  app.get("/api/aml-enhancement/sar-filing/list", (req, res) => { void proxyOrSeed(SAR_FILING_URL, "/v1/sar-filing/list", { total: 0, sar_reports: [] }, req, res); });
  app.get("/api/aml-enhancement/sar-filing/stats", (req, res) => { void proxyOrSeed(SAR_FILING_URL, "/v1/sar-filing/stats", { total: 0, service: "sar-filing" }, req, res); });
  app.get("/api/aml-enhancement/ctr-auto-filer/list", (req, res) => { void proxyOrSeed(CTR_AUTO_FILER_URL, "/v1/ctr-auto-filer/list", { total: 0, ctr_reports: [] }, req, res); });
  app.get("/api/aml-enhancement/ctr-auto-filer/stats", (req, res) => { void proxyOrSeed(CTR_AUTO_FILER_URL, "/v1/ctr-auto-filer/stats", { total: 0, service: "ctr-auto-filer" }, req, res); });
  app.get("/api/aml-enhancement/aml-case-manager/list", (req, res) => { void proxyOrSeed(AML_CASE_MANAGER_URL, "/v1/aml-case-manager/list", { total: 0, aml_cases: [] }, req, res); });
  app.get("/api/aml-enhancement/aml-case-manager/stats", (req, res) => { void proxyOrSeed(AML_CASE_MANAGER_URL, "/v1/aml-case-manager/stats", { total: 0, service: "aml-case-manager" }, req, res); });
  app.get("/api/aml-enhancement/watchlist-manager/list", (req, res) => { void proxyOrSeed(WATCHLIST_MANAGER_URL, "/v1/watchlist-manager/list", { total: 0, watchlists: [] }, req, res); });
  app.get("/api/aml-enhancement/watchlist-manager/stats", (req, res) => { void proxyOrSeed(WATCHLIST_MANAGER_URL, "/v1/watchlist-manager/stats", { total: 0, service: "watchlist-manager" }, req, res); });
  app.get("/api/aml-enhancement/adverse-media-scanner/list", (req, res) => { void proxyOrSeed(ADVERSE_MEDIA_SCANNER_URL, "/v1/adverse-media-scanner/list", { total: 0, media_scans: [] }, req, res); });
  app.get("/api/aml-enhancement/adverse-media-scanner/stats", (req, res) => { void proxyOrSeed(ADVERSE_MEDIA_SCANNER_URL, "/v1/adverse-media-scanner/stats", { total: 0, service: "adverse-media-scanner" }, req, res); });
  app.get("/api/aml-enhancement/beneficial-ownership/list", (req, res) => { void proxyOrSeed(BENEFICIAL_OWNERSHIP_URL, "/v1/beneficial-ownership/list", { total: 0, ownership_chains: [] }, req, res); });
  app.get("/api/aml-enhancement/beneficial-ownership/stats", (req, res) => { void proxyOrSeed(BENEFICIAL_OWNERSHIP_URL, "/v1/beneficial-ownership/stats", { total: 0, service: "beneficial-ownership" }, req, res); });
  app.get("/api/aml-enhancement/txn-pattern-analyzer/list", (req, res) => { void proxyOrSeed(TXN_PATTERN_ANALYZER_URL, "/v1/txn-pattern-analyzer/list", { total: 0, pattern_analyses: [] }, req, res); });
  app.get("/api/aml-enhancement/txn-pattern-analyzer/stats", (req, res) => { void proxyOrSeed(TXN_PATTERN_ANALYZER_URL, "/v1/txn-pattern-analyzer/stats", { total: 0, service: "txn-pattern-analyzer" }, req, res); });
  app.get("/api/aml-enhancement/goaml-integration/list", (req, res) => { void proxyOrSeed(GOAML_INTEGRATION_URL, "/v1/goaml-integration/list", { total: 0, goaml_reports: [] }, req, res); });
  app.get("/api/aml-enhancement/goaml-integration/stats", (req, res) => { void proxyOrSeed(GOAML_INTEGRATION_URL, "/v1/goaml-integration/stats", { total: 0, service: "goaml-integration" }, req, res); });
  app.get("/api/aml-enhancement/aml-compliance-dashboard/list", (req, res) => { void proxyOrSeed(AML_COMPLIANCE_DASHBOARD_URL, "/v1/aml-compliance-dashboard/list", { total: 0, compliance_metrics: [] }, req, res); });
  app.get("/api/aml-enhancement/aml-compliance-dashboard/stats", (req, res) => { void proxyOrSeed(AML_COMPLIANCE_DASHBOARD_URL, "/v1/aml-compliance-dashboard/stats", { total: 0, service: "aml-compliance-dashboard" }, req, res); });
  app.get("/api/aml-enhancement/sanctions-batch-rescreener/list", (req, res) => { void proxyOrSeed(SANCTIONS_BATCH_RESCREENER_URL, "/v1/sanctions-batch-rescreener/list", { total: 0, batch_runs: [] }, req, res); });
  app.get("/api/aml-enhancement/sanctions-batch-rescreener/stats", (req, res) => { void proxyOrSeed(SANCTIONS_BATCH_RESCREENER_URL, "/v1/sanctions-batch-rescreener/stats", { total: 0, service: "sanctions-batch-rescreener" }, req, res); });
  app.get("/api/aml-enhancement/aml-training-tracker/list", (req, res) => { void proxyOrSeed(AML_TRAINING_TRACKER_URL, "/v1/aml-training-tracker/list", { total: 0, training_records: [] }, req, res); });
  app.get("/api/aml-enhancement/aml-training-tracker/stats", (req, res) => { void proxyOrSeed(AML_TRAINING_TRACKER_URL, "/v1/aml-training-tracker/stats", { total: 0, service: "aml-training-tracker" }, req, res); });
  app.get("/api/aml-enhancement/wire-transfer-monitor/list", (req, res) => { void proxyOrSeed(WIRE_TRANSFER_MONITOR_URL, "/v1/wire-transfer-monitor/list", { total: 0, wire_transfers: [] }, req, res); });
  app.get("/api/aml-enhancement/wire-transfer-monitor/stats", (req, res) => { void proxyOrSeed(WIRE_TRANSFER_MONITOR_URL, "/v1/wire-transfer-monitor/stats", { total: 0, service: "wire-transfer-monitor" }, req, res); });
  app.get("/api/aml-enhancement/regulatory-reporting/list", (req, res) => { void proxyOrSeed(REGULATORY_REPORTING_URL, "/v1/regulatory-reporting/list", { total: 0, regulatory_reports: [] }, req, res); });
  app.get("/api/aml-enhancement/regulatory-reporting/stats", (req, res) => { void proxyOrSeed(REGULATORY_REPORTING_URL, "/v1/regulatory-reporting/stats", { total: 0, service: "regulatory-reporting" }, req, res); });
  app.get("/api/aml-enhancement/typology-detector/list", (req, res) => { void proxyOrSeed(TYPOLOGY_DETECTOR_URL, "/v1/typology-detector/list", { total: 0, typology_matches: [] }, req, res); });
  app.get("/api/aml-enhancement/typology-detector/stats", (req, res) => { void proxyOrSeed(TYPOLOGY_DETECTOR_URL, "/v1/typology-detector/stats", { total: 0, service: "typology-detector" }, req, res); });
}
