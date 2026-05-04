import { parse } from 'papaparse';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ExportColumn {
  key: string;
  label: string;
  width?: number;
}

export interface ExportOptions {
  filename: string;
  columns: ExportColumn[];
  data: Record<string, any>[];
  title?: string;
  subtitle?: string;
}

/**
 * Export data to CSV format
 */
export async function exportToCSV(options: ExportOptions): Promise<Buffer> {
  const { columns, data } = options;

  // Create CSV header
  const headers = columns.map(col => col.label);
  
  // Create CSV rows
  const rows = data.map(row => 
    columns.map(col => {
      const value = row[col.key];
      // Handle different data types
      if (value === null || value === undefined) return '';
      if (typeof value === 'object') return JSON.stringify(value);
      return String(value);
    })
  );

  // Combine headers and rows
  const csvData = [headers, ...rows];
  
  // Convert to CSV string
  const csv = csvData.map(row => 
    row.map(cell => {
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      const escaped = String(cell).replace(/"/g, '""');
      return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
    }).join(',')
  ).join('\n');

  return Buffer.from(csv, 'utf-8');
}

/**
 * Export data to Excel format with formatting
 */
export async function exportToExcel(options: ExportOptions): Promise<Buffer> {
  const { filename, columns, data, title, subtitle } = options;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Payment Switch';
  workbook.created = new Date();
  
  const worksheet = workbook.addWorksheet('Data');

  let currentRow = 1;

  // Add title if provided
  if (title) {
    const titleRow = worksheet.getRow(currentRow);
    titleRow.getCell(1).value = title;
    titleRow.getCell(1).font = { size: 16, bold: true };
    titleRow.height = 25;
    currentRow += 1;
  }

  // Add subtitle if provided
  if (subtitle) {
    const subtitleRow = worksheet.getRow(currentRow);
    subtitleRow.getCell(1).value = subtitle;
    subtitleRow.getCell(1).font = { size: 12, italic: true };
    currentRow += 1;
  }

  // Add empty row if title or subtitle exists
  if (title || subtitle) {
    currentRow += 1;
  }

  // Add headers
  const headerRow = worksheet.getRow(currentRow);
  columns.forEach((col, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = col.label;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F46E5' } // Indigo color
    };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
  });
  headerRow.height = 20;
  currentRow += 1;

  // Add data rows
  data.forEach((row, rowIndex) => {
    const dataRow = worksheet.getRow(currentRow + rowIndex);
    columns.forEach((col, colIndex) => {
      const cell = dataRow.getCell(colIndex + 1);
      const value = row[col.key];
      
      // Handle different data types
      if (value === null || value === undefined) {
        cell.value = '';
      } else if (value instanceof Date) {
        cell.value = value;
        cell.numFmt = 'yyyy-mm-dd hh:mm:ss';
      } else if (typeof value === 'number') {
        cell.value = value;
        // Format currency if key contains 'amount' or 'fee'
        if (col.key.toLowerCase().includes('amount') || col.key.toLowerCase().includes('fee')) {
          cell.numFmt = '"₦"#,##0.00';
        }
      } else if (typeof value === 'boolean') {
        cell.value = value ? 'Yes' : 'No';
      } else if (typeof value === 'object') {
        cell.value = JSON.stringify(value);
      } else {
        cell.value = String(value);
      }

      // Add borders
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };

      // Alternate row colors
      if (rowIndex % 2 === 1) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF9FAFB' } // Light gray
        };
      }
    });
  });

  // Set column widths
  columns.forEach((col, index) => {
    const column = worksheet.getColumn(index + 1);
    column.width = col.width || 15;
  });

  // Auto-fit columns based on content
  worksheet.columns.forEach(column => {
    let maxLength = 0;
    column.eachCell?.({ includeEmpty: true }, cell => {
      const cellValue = cell.value ? String(cell.value) : '';
      maxLength = Math.max(maxLength, cellValue.length);
    });
    column.width = Math.min(Math.max(maxLength + 2, 10), 50);
  });

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Export data to PDF format with table
 */
export async function exportToPDF(options: ExportOptions): Promise<Buffer> {
  const { columns, data, title, subtitle } = options;

  const doc = new jsPDF({
    orientation: columns.length > 6 ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  let yPosition = 20;

  // Add title
  if (title) {
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 14, yPosition);
    yPosition += 10;
  }

  // Add subtitle
  if (subtitle) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'italic');
    doc.text(subtitle, 14, yPosition);
    yPosition += 10;
  }

  // Add metadata
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, yPosition);
  doc.text(`Total Records: ${data.length}`, 14, yPosition + 5);
  yPosition += 15;

  // Prepare table data
  const headers = columns.map(col => col.label);
  const rows = data.map(row =>
    columns.map(col => {
      const value = row[col.key];
      if (value === null || value === undefined) return '';
      if (value instanceof Date) return value.toLocaleString();
      if (typeof value === 'boolean') return value ? 'Yes' : 'No';
      if (typeof value === 'object') return JSON.stringify(value);
      return String(value);
    })
  );

  // Add table
  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: yPosition,
    theme: 'striped',
    headStyles: {
      fillColor: [79, 70, 229], // Indigo color
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left'
    },
    styles: {
      fontSize: 8,
      cellPadding: 3,
      overflow: 'linebreak',
      halign: 'left'
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251] // Light gray
    },
    margin: { top: 10, right: 14, bottom: 10, left: 14 },
    didDrawPage: (data) => {
      // Add page number
      const pageCount = doc.getNumberOfPages();
      const pageSize = doc.internal.pageSize;
      const pageHeight = pageSize.height || pageSize.getHeight();
      doc.setFontSize(8);
      doc.text(
        `Page ${data.pageNumber} of ${pageCount}`,
        data.settings.margin.left,
        pageHeight - 10
      );
    }
  });

  // Generate buffer
  const pdfBuffer = doc.output('arraybuffer');
  return Buffer.from(pdfBuffer);
}

/**
 * Format remittance data for export
 */
export function formatRemittanceForExport(remittances: any[]) {
  return remittances.map(r => ({
    id: r.id,
    status: r.status,
    fromCurrency: r.fromCurrency,
    fromAmount: r.fromAmount,
    toCurrency: r.toCurrency,
    toAmount: r.toAmount,
    exchangeRate: r.exchangeRate,
    fee: r.fee,
    deliveryMethod: r.deliveryMethod,
    recipientName: r.recipientName,
    recipientPhone: r.recipientPhone,
    createdAt: r.createdAt,
    completedAt: r.completedAt
  }));
}

/**
 * Get default columns for remittance export
 */
export function getRemittanceExportColumns(): ExportColumn[] {
  return [
    { key: 'id', label: 'Transaction ID', width: 20 },
    { key: 'status', label: 'Status', width: 15 },
    { key: 'fromCurrency', label: 'From Currency', width: 12 },
    { key: 'fromAmount', label: 'From Amount', width: 15 },
    { key: 'toCurrency', label: 'To Currency', width: 12 },
    { key: 'toAmount', label: 'To Amount', width: 15 },
    { key: 'exchangeRate', label: 'Exchange Rate', width: 15 },
    { key: 'fee', label: 'Fee', width: 12 },
    { key: 'deliveryMethod', label: 'Delivery Method', width: 18 },
    { key: 'recipientName', label: 'Recipient Name', width: 20 },
    { key: 'recipientPhone', label: 'Recipient Phone', width: 18 },
    { key: 'createdAt', label: 'Created At', width: 20 },
    { key: 'completedAt', label: 'Completed At', width: 20 }
  ];
}

/**
 * Format rate alert data for export
 */
export function formatRateAlertsForExport(alerts: any[]) {
  return alerts.map(a => ({
    id: a.id,
    fromCurrency: a.fromCurrency,
    toCurrency: a.toCurrency,
    targetRate: a.targetRate,
    condition: a.condition,
    status: a.status,
    isActive: a.isActive ? 'Yes' : 'No',
    notifyEmail: a.notifyEmail ? 'Yes' : 'No',
    notifySms: a.notifySms ? 'Yes' : 'No',
    notifyPush: a.notifyPush ? 'Yes' : 'No',
    triggeredAt: a.triggeredAt,
    triggeredRate: a.triggeredRate,
    createdAt: a.createdAt
  }));
}

/**
 * Get default columns for rate alert export
 */
export function getRateAlertExportColumns(): ExportColumn[] {
  return [
    { key: 'id', label: 'Alert ID', width: 15 },
    { key: 'fromCurrency', label: 'From Currency', width: 12 },
    { key: 'toCurrency', label: 'To Currency', width: 12 },
    { key: 'targetRate', label: 'Target Rate', width: 15 },
    { key: 'condition', label: 'Condition', width: 12 },
    { key: 'status', label: 'Status', width: 12 },
    { key: 'isActive', label: 'Active', width: 10 },
    { key: 'notifyEmail', label: 'Email', width: 10 },
    { key: 'notifySms', label: 'SMS', width: 10 },
    { key: 'notifyPush', label: 'Push', width: 10 },
    { key: 'triggeredAt', label: 'Triggered At', width: 20 },
    { key: 'triggeredRate', label: 'Triggered Rate', width: 15 },
    { key: 'createdAt', label: 'Created At', width: 20 }
  ];
}
