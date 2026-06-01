/**
 * IEC 62443 Compliance Gap Report PDF Generator
 * Generates auditor-ready HTML reports with remediation roadmaps
 * Uploaded to S3 and returned as a URL
 */
import { getDb } from "../db";
import { iec62443Controls, iec62443Assessments } from "../../drizzle/schema";
import { desc } from "drizzle-orm";
import { storagePut } from "../storage";

export async function generateIec62443Report(params: {
  targetSL?: number;
  organizationName?: string;
  preparedBy?: string;
}): Promise<{ url: string; filename: string; generatedAt: string }> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const { organizationName = "OG-RMM Operator", preparedBy = "Compliance Team", targetSL = 2 } = params;

  const controls = await db.select().from(iec62443Controls).limit(200);
  const assessments = await db.select()
    .from(iec62443Assessments)
    .orderBy(desc(iec62443Assessments.assessmentDate))
    .limit(10);

  const latestAssessment = assessments[0];

  // Categorize controls by status
  const compliant = controls.filter(c => c.status === "completed");
  const inProgress = controls.filter(c => c.status === "in_progress");
  const notStarted = controls.filter(c => c.status === "not_started");

  const complianceScore = controls.length > 0
    ? Math.round(((compliant.length + inProgress.length * 0.5) / controls.length) * 100)
    : 0;

  const generatedAt = new Date().toISOString();
  const filename = `iec62443-gap-report-${Date.now()}.html`;

  // Build category breakdown
  const categories = Array.from(new Set(controls.map(c => c.category)));
  const categoryRows = categories.map(cat => {
    const catControls = controls.filter(c => c.category === cat);
    const catCompliant = catControls.filter(c => c.status === "completed").length;
    const catInProgress = catControls.filter(c => c.status === "in_progress").length;
    const catNotStarted = catControls.length - catCompliant - catInProgress;
    const catScore = catControls.length > 0
      ? Math.round(((catCompliant + catInProgress * 0.5) / catControls.length) * 100)
      : 0;
    return `<tr>
      <td>${cat}</td>
      <td>${catControls.length}</td>
      <td style="color:#27ae60">${catCompliant}</td>
      <td style="color:#f39c12">${catInProgress}</td>
      <td style="color:#e74c3c">${catNotStarted}</td>
      <td><strong>${catScore}%</strong></td>
    </tr>`;
  }).join("");

  // Build controls table
  const controlRows = controls.slice(0, 60).map(c => {
    const statusColor = c.status === "completed" ? "#27ae60" : c.status === "in_progress" ? "#f39c12" : "#e74c3c";
    const statusLabel = c.status === "completed" ? "Compliant" : c.status === "in_progress" ? "In Progress" : "Not Started";
    const priority = c.status !== "completed" ? "HIGH" : "—";
    return `<tr>
      <td><strong>${c.controlId}</strong></td>
      <td>${c.zone}</td>
      <td>${c.category}</td>
      <td>${c.title}</td>
      <td><span style="background:${statusColor}20;color:${statusColor};padding:2px 8px;border-radius:10px;font-size:0.85em;font-weight:bold">${statusLabel}</span></td>
      <td>${priority}</td>
      <td>${c.targetDate ? new Date(c.targetDate).toLocaleDateString() : "TBD"}</td>
    </tr>`;
  }).join("");

  // Build remediation roadmap
  const remediationItems = [...inProgress, ...notStarted].slice(0, 20).map((c, i) => {
    const priorityClass = i < 5 ? "high" : i < 12 ? "medium" : "low";
    const effort = priorityClass === "high" ? "2-4 weeks" : priorityClass === "medium" ? "1-2 weeks" : "3-5 days";
    return `<div style="background:#f8f9fa;border-left:4px solid ${priorityClass === "high" ? "#e74c3c" : priorityClass === "medium" ? "#f39c12" : "#27ae60"};padding:12px;margin:10px 0;border-radius:0 4px 4px 0">
      <strong>[${priorityClass.toUpperCase()}] ${c.controlId} — ${c.title}</strong>
      <p style="margin:5px 0 0;color:#555">${c.description ?? c.requirement ?? "Implement control as per IEC 62443-3-3 requirements."}</p>
      <p style="margin:5px 0 0;font-size:0.85em;color:#888">Zone: ${c.zone} | Category: ${c.category} | Estimated effort: ${effort}</p>
    </div>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>IEC 62443 Compliance Gap Report — ${organizationName}</title>
<style>
  body{font-family:Arial,sans-serif;margin:40px;color:#1a1a2e;line-height:1.5}
  h1{color:#0f3460;border-bottom:3px solid #e94560;padding-bottom:10px}
  h2{color:#0f3460;margin-top:30px;border-bottom:1px solid #dee2e6;padding-bottom:6px}
  .header{background:linear-gradient(135deg,#0f3460,#16213e);color:white;padding:25px;border-radius:8px;margin-bottom:30px}
  .header h1{color:white;border-bottom:1px solid rgba(255,255,255,0.3)}
  table{width:100%;border-collapse:collapse;margin:15px 0;font-size:0.88em}
  th{background:#0f3460;color:white;padding:10px;text-align:left}
  td{padding:8px 10px;border-bottom:1px solid #dee2e6;vertical-align:top}
  tr:nth-child(even){background:#f8f9fa}
  .score{display:inline-block;background:${complianceScore>=80?"#27ae60":complianceScore>=60?"#f39c12":"#e74c3c"};color:white;padding:15px 30px;border-radius:8px;font-size:2.2em;font-weight:bold}
  .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:15px;margin:20px 0}
  .card{background:#f8f9fa;border:1px solid #dee2e6;border-radius:8px;padding:15px;text-align:center}
  .card .val{font-size:2em;font-weight:bold}
  .footer{margin-top:40px;padding-top:20px;border-top:1px solid #dee2e6;font-size:0.8em;color:#666}
  @media print{body{margin:20px}.header{-webkit-print-color-adjust:exact}}
</style>
</head>
<body>
<div class="header">
  <h1>IEC 62443 Cybersecurity Compliance Gap Report</h1>
  <p><strong>Organization:</strong> ${organizationName} &nbsp;|&nbsp; <strong>Target Security Level:</strong> SL-${targetSL} &nbsp;|&nbsp; <strong>Prepared by:</strong> ${preparedBy}</p>
  <p><strong>Report Date:</strong> ${new Date(generatedAt).toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"})} &nbsp;|&nbsp; <strong>Standard:</strong> IEC 62443-3-3:2013 / IEC 62443-2-1:2010</p>
  ${latestAssessment ? `<p><strong>Latest Assessment:</strong> ${new Date(latestAssessment.assessmentDate).toLocaleDateString()} by ${latestAssessment.assessorName ?? "Internal Team"} | Score: ${latestAssessment.overallScore?.toFixed(1) ?? "N/A"}%</p>` : ""}
</div>

<h2>Executive Summary</h2>
<div style="display:flex;align-items:flex-start;gap:30px;margin:20px 0">
  <div style="text-align:center">
    <div class="score">${complianceScore}%</div>
    <p style="margin-top:8px;font-size:0.9em;color:#555">Overall Compliance Score</p>
  </div>
  <div class="grid" style="flex:1">
    <div class="card"><div class="val">${controls.length}</div><div>Total Controls</div></div>
    <div class="card"><div class="val" style="color:#27ae60">${compliant.length}</div><div>Compliant</div></div>
    <div class="card"><div class="val" style="color:#f39c12">${inProgress.length}</div><div>In Progress</div></div>
    <div class="card"><div class="val" style="color:#e74c3c">${notStarted.length}</div><div>Not Started</div></div>
  </div>
</div>

<h2>Compliance by Category</h2>
<table>
  <thead><tr><th>Category</th><th>Total</th><th>Compliant</th><th>In Progress</th><th>Not Started</th><th>Score</th></tr></thead>
  <tbody>${categoryRows}</tbody>
</table>

<h2>Controls Assessment Detail</h2>
<table>
  <thead><tr><th>Control ID</th><th>Zone</th><th>Category</th><th>Title</th><th>Status</th><th>Priority</th><th>Target Date</th></tr></thead>
  <tbody>${controlRows}</tbody>
</table>
${controls.length > 60 ? `<p><em>Showing 60 of ${controls.length} controls. Full dataset available in the OG-RMM platform.</em></p>` : ""}

<h2>Remediation Roadmap</h2>
<p>The following actions are recommended to achieve SL-${targetSL} compliance. Items are ordered by priority (HIGH → MEDIUM → LOW).</p>
${remediationItems || "<p>No open remediation items. All controls are compliant.</p>"}

<h2>Certification Pathway</h2>
<table>
  <thead><tr><th>Phase</th><th>Activities</th><th>Timeline</th><th>Deliverable</th></tr></thead>
  <tbody>
    <tr><td><strong>Phase 1</strong></td><td>Complete all HIGH priority controls, document evidence</td><td>0-4 weeks</td><td>Evidence package</td></tr>
    <tr><td><strong>Phase 2</strong></td><td>Internal audit, gap closure for MEDIUM items</td><td>4-8 weeks</td><td>Internal audit report</td></tr>
    <tr><td><strong>Phase 3</strong></td><td>Third-party assessment by accredited body</td><td>8-12 weeks</td><td>Assessment report</td></tr>
    <tr><td><strong>Phase 4</strong></td><td>Certificate issuance, ongoing monitoring</td><td>12-16 weeks</td><td>IEC 62443 Certificate</td></tr>
  </tbody>
</table>

<div class="footer">
  <p>Generated by OG-RMM Platform on ${new Date(generatedAt).toLocaleString()} | Classification: CONFIDENTIAL</p>
  <p>IEC 62443 is the international standard for cybersecurity in industrial automation and control systems (IACS).</p>
  <p>This report is intended for internal use and authorized auditors only. Unauthorized distribution is prohibited.</p>
</div>
</body>
</html>`;

  const key = `compliance-reports/iec62443/${filename}`;
  const { url } = await storagePut(key, Buffer.from(html, "utf-8"), "text/html");

  return { url, filename, generatedAt };
}
