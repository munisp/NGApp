import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ExportData {
  merchantName: string;
  dateRange: string;
  summary?: {
    totalRevenue: number;
    totalTransactions: number;
    completedTransactions: number;
    failedTransactions: number;
    successRate: number;
    averageTransactionValue: number;
  };
  revenueData?: Array<{ period: string; revenue: number; refunds: number; netRevenue: number }>;
  volumeData?: Array<{ period: string; count: number; totalAmount: number }>;
  paymentMethods?: Array<{ paymentMethod: string; count: number; totalAmount: number; percentage: string }>;
  statusBreakdown?: Array<{ status: string; count: number }>;
}

/**
 * Generate PDF export of analytics data
 */
export function exportAnalyticsToPDF(data: ExportData) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 20;

  // Title
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Transaction Analytics Report', pageWidth / 2, yPos, { align: 'center' });
  yPos += 10;

  // Merchant and date range
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Merchant: ${data.merchantName}`, 14, yPos);
  yPos += 7;
  doc.text(`Period: ${data.dateRange}`, 14, yPos);
  yPos += 7;
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, yPos);
  yPos += 15;

  // Summary Statistics
  if (data.summary) {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Summary Statistics', 14, yPos);
    yPos += 7;

    const summaryData = [
      ['Total Revenue', `$${(data.summary.totalRevenue / 100).toFixed(2)}`],
      ['Total Transactions', data.summary.totalTransactions.toString()],
      ['Completed Transactions', data.summary.completedTransactions.toString()],
      ['Failed Transactions', data.summary.failedTransactions.toString()],
      ['Success Rate', `${data.summary.successRate.toFixed(2)}%`],
      ['Average Transaction Value', `$${(data.summary.averageTransactionValue / 100).toFixed(2)}`],
    ];

    autoTable(doc, {
      startY: yPos,
      head: [['Metric', 'Value']],
      body: summaryData,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] },
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;
  }

  // Revenue Over Time
  if (data.revenueData && data.revenueData.length > 0) {
    if (yPos > 240) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Revenue Over Time', 14, yPos);
    yPos += 7;

    const revenueTableData = data.revenueData.map(item => [
      item.period,
      `$${(item.revenue / 100).toFixed(2)}`,
      `$${(item.refunds / 100).toFixed(2)}`,
      `$${(item.netRevenue / 100).toFixed(2)}`,
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Period', 'Revenue', 'Refunds', 'Net Revenue']],
      body: revenueTableData,
      theme: 'striped',
      headStyles: { fillColor: [16, 185, 129] },
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;
  }

  // Transaction Volume
  if (data.volumeData && data.volumeData.length > 0) {
    if (yPos > 240) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Transaction Volume', 14, yPos);
    yPos += 7;

    const volumeTableData = data.volumeData.map(item => [
      item.period,
      item.count.toString(),
      `$${(item.totalAmount / 100).toFixed(2)}`,
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Period', 'Transaction Count', 'Total Amount']],
      body: volumeTableData,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;
  }

  // Payment Methods
  if (data.paymentMethods && data.paymentMethods.length > 0) {
    if (yPos > 240) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Payment Method Distribution', 14, yPos);
    yPos += 7;

    const methodTableData = data.paymentMethods.map(item => [
      item.paymentMethod,
      item.count.toString(),
      `$${(item.totalAmount / 100).toFixed(2)}`,
      item.percentage,
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Payment Method', 'Count', 'Total Amount', 'Percentage']],
      body: methodTableData,
      theme: 'striped',
      headStyles: { fillColor: [139, 92, 246] },
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;
  }

  // Status Breakdown
  if (data.statusBreakdown && data.statusBreakdown.length > 0) {
    if (yPos > 240) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Transaction Status Breakdown', 14, yPos);
    yPos += 7;

    const statusTableData = data.statusBreakdown.map(item => [
      item.status,
      item.count.toString(),
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Status', 'Count']],
      body: statusTableData,
      theme: 'striped',
      headStyles: { fillColor: [245, 158, 11] },
    });
  }

  // Footer on last page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(128);
    doc.text(
      `Page ${i} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  // Save the PDF
  const filename = `analytics_${data.merchantName.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
  doc.save(filename);
}

/**
 * Download CSV data
 */
export function downloadCSV(csvContent: string, filename: string) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}
