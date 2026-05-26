/**
 * OG-RMM Platform — Data Export Utility
 *
 * Supports: CSV, Excel (XLSX via SheetJS), JSON, PDF (via print)
 *
 * Usage:
 *   import { exportToCSV, exportToExcel, exportToJSON } from "@/lib/export";
 *   exportToCSV(data, { filename: "wells-export", headers: [...] });
 */

export interface ExportColumn {
  key: string;
  label: string;
  format?: (value: unknown) => string;
}

export interface ExportOptions {
  filename?: string;
  sheetName?: string;
  headers?: ExportColumn[];
  includeTimestamp?: boolean;
}

// ── CSV Export ────────────────────────────────────────────────────────────────

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportToCSV<T extends Record<string, unknown>>(
  data: T[],
  options: ExportOptions = {}
): void {
  const { filename = "export", headers, includeTimestamp = true } = options;
  if (!data.length) return;

  const cols: ExportColumn[] = headers ?? Object.keys(data[0]).map(k => ({ key: k, label: k }));

  const headerRow = cols.map(c => escapeCSV(c.label)).join(",");
  const dataRows = data.map(row =>
    cols.map(c => {
      const val = row[c.key];
      return escapeCSV(c.format ? c.format(val) : val);
    }).join(",")
  );

  const csv = [headerRow, ...dataRows].join("\n");
  const ts = includeTimestamp ? `_${new Date().toISOString().slice(0, 10)}` : "";
  downloadBlob(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }), `${filename}${ts}.csv`);
}

// ── JSON Export ───────────────────────────────────────────────────────────────

export function exportToJSON<T>(data: T, options: ExportOptions = {}): void {
  const { filename = "export", includeTimestamp = true } = options;
  const json = JSON.stringify(data, null, 2);
  const ts = includeTimestamp ? `_${new Date().toISOString().slice(0, 10)}` : "";
  downloadBlob(new Blob([json], { type: "application/json" }), `${filename}${ts}.json`);
}

// ── Excel (XLSX) Export ───────────────────────────────────────────────────────
// Uses SheetJS (xlsx) if available, otherwise falls back to CSV

export async function exportToExcel<T extends Record<string, unknown>>(
  data: T[],
  options: ExportOptions = {}
): Promise<void> {
  const { filename = "export", sheetName = "Sheet1", headers, includeTimestamp = true } = options;
  const ts = includeTimestamp ? `_${new Date().toISOString().slice(0, 10)}` : "";

  try {
    // Dynamic import — SheetJS is a large library, only load when needed
    const XLSX = await import("xlsx").catch(() => null);
    if (!XLSX) {
      // Fallback to CSV if xlsx not installed
      exportToCSV(data, options);
      return;
    }

    const cols: ExportColumn[] = headers ?? Object.keys(data[0] ?? {}).map(k => ({ key: k, label: k }));

    const wsData = [
      cols.map(c => c.label),
      ...data.map(row => cols.map(c => {
        const val = row[c.key];
        return c.format ? c.format(val) : (val ?? "");
      })),
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    // Auto-width columns
    const colWidths = cols.map((c, i) => ({
      wch: Math.max(
        c.label.length,
        ...data.map(row => String(row[c.key] ?? "").length),
        10
      )
    }));
    ws["!cols"] = colWidths;

    XLSX.writeFile(wb, `${filename}${ts}.xlsx`);
  } catch {
    // Fallback to CSV
    exportToCSV(data, options);
  }
}

// ── Multi-sheet Excel Export ──────────────────────────────────────────────────

export interface ExcelSheet<T extends Record<string, unknown>> {
  name: string;
  data: T[];
  headers?: ExportColumn[];
}

export async function exportToExcelMultiSheet(
  sheets: ExcelSheet<Record<string, unknown>>[],
  options: ExportOptions = {}
): Promise<void> {
  const { filename = "export", includeTimestamp = true } = options;
  const ts = includeTimestamp ? `_${new Date().toISOString().slice(0, 10)}` : "";

  try {
    const XLSX = await import("xlsx").catch(() => null);
    if (!XLSX) {
      // Fallback: export each sheet as separate CSV
      for (const sheet of sheets) {
        exportToCSV(sheet.data, { ...options, filename: `${filename}_${sheet.name}` });
      }
      return;
    }

    const wb = XLSX.utils.book_new();

    for (const sheet of sheets) {
      if (!sheet.data.length) continue;
      const cols: ExportColumn[] = sheet.headers ?? Object.keys(sheet.data[0]).map(k => ({ key: k, label: k }));
      const wsData = [
        cols.map(c => c.label),
        ...sheet.data.map(row => cols.map(c => {
          const val = row[c.key];
          return c.format ? c.format(val) : (val ?? "");
        })),
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws["!cols"] = cols.map(c => ({
        wch: Math.max(c.label.length, ...sheet.data.map(row => String(row[c.key] ?? "").length), 10)
      }));
      XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31)); // Excel sheet name max 31 chars
    }

    XLSX.writeFile(wb, `${filename}${ts}.xlsx`);
  } catch {
    for (const sheet of sheets) {
      exportToCSV(sheet.data, { ...options, filename: `${filename}_${sheet.name}` });
    }
  }
}

// ── Print / PDF Export ────────────────────────────────────────────────────────

export function printElement(elementId: string, title?: string): void {
  const element = document.getElementById(elementId);
  if (!element) return;

  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  const styles = Array.from(document.styleSheets)
    .map(sheet => {
      try {
        return Array.from(sheet.cssRules).map(rule => rule.cssText).join("\n");
      } catch {
        return "";
      }
    })
    .join("\n");

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title ?? "OG-RMM Export"}</title>
      <style>
        ${styles}
        @media print {
          body { margin: 0; padding: 20px; }
          .no-print { display: none !important; }
          button { display: none !important; }
        }
      </style>
    </head>
    <body>
      <h1 style="font-size:18px;margin-bottom:16px;">${title ?? "OG-RMM Platform Export"}</h1>
      <p style="font-size:12px;color:#666;margin-bottom:16px;">Generated: ${new Date().toLocaleString()}</p>
      ${element.innerHTML}
    </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 500);
}

// ── Utility ───────────────────────────────────────────────────────────────────

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Pre-built export configs for common OG-RMM data types ────────────────────

export const WELL_EXPORT_COLUMNS: ExportColumn[] = [
  { key: "wellId", label: "Well ID" },
  { key: "wellName", label: "Well Name" },
  { key: "field", label: "Field" },
  { key: "wellType", label: "Type" },
  { key: "status", label: "Status" },
  { key: "oilRateBopd", label: "Oil Rate (BOPD)", format: v => v != null ? Number(v).toFixed(1) : "" },
  { key: "gasRateMmscfd", label: "Gas Rate (MMSCFD)", format: v => v != null ? Number(v).toFixed(3) : "" },
  { key: "waterCutPct", label: "Water Cut (%)", format: v => v != null ? Number(v).toFixed(1) : "" },
  { key: "tubingPressurePsi", label: "Tubing Pressure (PSI)" },
  { key: "casingPressurePsi", label: "Casing Pressure (PSI)" },
  { key: "latitude", label: "Latitude" },
  { key: "longitude", label: "Longitude" },
  { key: "createdAt", label: "Created At", format: v => v ? new Date(v as string).toLocaleDateString() : "" },
];

export const ALARM_EXPORT_COLUMNS: ExportColumn[] = [
  { key: "alarmId", label: "Alarm ID" },
  { key: "wellId", label: "Well ID" },
  { key: "severity", label: "Severity" },
  { key: "alarmType", label: "Type" },
  { key: "message", label: "Message" },
  { key: "status", label: "Status" },
  { key: "triggeredAt", label: "Triggered At", format: v => v ? new Date(v as string).toLocaleString() : "" },
  { key: "acknowledgedAt", label: "Acknowledged At", format: v => v ? new Date(v as string).toLocaleString() : "" },
  { key: "resolvedAt", label: "Resolved At", format: v => v ? new Date(v as string).toLocaleString() : "" },
  { key: "acknowledgedBy", label: "Acknowledged By" },
];

export const PRODUCTION_EXPORT_COLUMNS: ExportColumn[] = [
  { key: "wellId", label: "Well ID" },
  { key: "reportDate", label: "Date", format: v => v ? new Date(v as string).toLocaleDateString() : "" },
  { key: "oilVolumeBbl", label: "Oil Volume (BBL)", format: v => v != null ? Number(v).toFixed(1) : "" },
  { key: "gasVolumeMMscf", label: "Gas Volume (MMscf)", format: v => v != null ? Number(v).toFixed(3) : "" },
  { key: "waterVolumeBbl", label: "Water Volume (BBL)", format: v => v != null ? Number(v).toFixed(1) : "" },
  { key: "uptimePct", label: "Uptime (%)", format: v => v != null ? Number(v).toFixed(1) : "" },
  { key: "downtime", label: "Downtime Reason" },
];

export const INCIDENT_EXPORT_COLUMNS: ExportColumn[] = [
  { key: "incidentId", label: "Incident ID" },
  { key: "incidentType", label: "Type" },
  { key: "severity", label: "Severity" },
  { key: "location", label: "Location" },
  { key: "description", label: "Description" },
  { key: "reportedBy", label: "Reported By" },
  { key: "incidentDate", label: "Date", format: v => v ? new Date(v as string).toLocaleDateString() : "" },
  { key: "status", label: "Status" },
  { key: "correctiveActions", label: "Corrective Actions" },
];
