/**
 * Utility functions for exporting analytics data
 */

interface CSVRow {
  [key: string]: string | number | Date | null | undefined;
}

/**
 * Convert array of objects to CSV string
 */
export function arrayToCSV(data: CSVRow[], headers?: string[]): string {
  if (data.length === 0) return '';

  // Use provided headers or extract from first object
  const columnHeaders = headers || Object.keys(data[0]);
  
  // Create header row
  const headerRow = columnHeaders.join(',');
  
  // Create data rows
  const dataRows = data.map(row => {
    return columnHeaders.map(header => {
      const value = row[header];
      
      // Handle different value types
      if (value === null || value === undefined) {
        return '';
      }
      
      if (value instanceof Date) {
        return value.toISOString();
      }
      
      // Escape commas and quotes in strings
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      
      return stringValue;
    }).join(',');
  });
  
  return [headerRow, ...dataRows].join('\n');
}

/**
 * Format transaction data for CSV export
 */
export function formatTransactionsForCSV(transactions: any[]): string {
  const formatted = transactions.map(txn => ({
    'Transaction ID': txn.transactionId,
    'Amount': txn.amount / 100,
    'Currency': txn.currency,
    'Status': txn.status,
    'Payment Method': txn.paymentMethod,
    'Customer Email': txn.customerEmail || '',
    'Created At': new Date(txn.createdAt),
    'Updated At': new Date(txn.updatedAt),
  }));
  
  return arrayToCSV(formatted);
}

/**
 * Format analytics summary for CSV export
 */
export function formatAnalyticsSummaryForCSV(summary: any): string {
  const data = [
    { Metric: 'Total Revenue', Value: (summary.totalRevenue / 100).toFixed(2), Currency: 'USD' },
    { Metric: 'Total Transactions', Value: summary.totalTransactions, Currency: '' },
    { Metric: 'Completed Transactions', Value: summary.completedTransactions, Currency: '' },
    { Metric: 'Failed Transactions', Value: summary.failedTransactions, Currency: '' },
    { Metric: 'Success Rate', Value: summary.successRate.toFixed(2) + '%', Currency: '' },
    { Metric: 'Average Transaction Value', Value: (summary.averageTransactionValue / 100).toFixed(2), Currency: 'USD' },
  ];
  
  return arrayToCSV(data);
}

/**
 * Format time series data for CSV export
 */
export function formatTimeSeriesForCSV(data: any[], type: 'revenue' | 'volume'): string {
  if (type === 'revenue') {
    const formatted = data.map(item => ({
      'Period': item.period,
      'Revenue': item.revenue / 100,
      'Refunds': item.refunds / 100,
      'Net Revenue': item.netRevenue / 100,
    }));
    return arrayToCSV(formatted);
  } else {
    const formatted = data.map(item => ({
      'Period': item.period,
      'Transaction Count': item.count,
      'Total Amount': item.totalAmount / 100,
    }));
    return arrayToCSV(formatted);
  }
}

/**
 * Format payment method distribution for CSV export
 */
export function formatPaymentMethodsForCSV(data: any[]): string {
  const total = data.reduce((sum, item) => sum + item.count, 0);
  
  const formatted = data.map(item => ({
    'Payment Method': item.paymentMethod,
    'Transaction Count': item.count,
    'Total Amount': item.totalAmount / 100,
    'Percentage': total > 0 ? ((item.count / total) * 100).toFixed(2) + '%' : '0%',
  }));
  
  return arrayToCSV(formatted);
}

/**
 * Format status breakdown for CSV export
 */
export function formatStatusBreakdownForCSV(data: any[]): string {
  const formatted = data.map(item => ({
    'Status': item.status,
    'Count': item.count,
  }));
  
  return arrayToCSV(formatted);
}
