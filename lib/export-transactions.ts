import { Share, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { Transaction } from './api/services-mock';

/**
 * Generate CSV content from transactions
 */
export function generateCSV(transactions: Transaction[]): string {
  const headers = ['Date', 'Type', 'Amount', 'Currency', 'Status', 'Description'];
  const rows = transactions.map(tx => [
    new Date(tx.created_at).toLocaleString(),
    tx.type,
    tx.amount.toFixed(2),
    tx.currency,
    tx.status,
    tx.description || '',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');

  return csvContent;
}

/**
 * Generate simple text-based PDF content from transactions
 */
export function generatePDFContent(transactions: Transaction[]): string {
  const title = 'Transaction History Report';
  const date = new Date().toLocaleDateString();
  const totalAmount = transactions.reduce((sum, tx) => sum + tx.amount, 0);

  let content = `${title}\n`;
  content += `Generated: ${date}\n`;
  content += `Total Transactions: ${transactions.length}\n`;
  content += `Total Amount: $${totalAmount.toFixed(2)}\n`;
  content += `\n${'='.repeat(80)}\n\n`;

  transactions.forEach((tx, index) => {
    content += `Transaction #${index + 1}\n`;
    content += `Date: ${new Date(tx.created_at).toLocaleString()}\n`;
    content += `Type: ${tx.type}\n`;
    content += `Amount: $${tx.amount.toFixed(2)} ${tx.currency}\n`;
    content += `Status: ${tx.status}\n`;
    content += `Description: ${tx.description || 'N/A'}\n`;
    content += `\n${'-'.repeat(80)}\n\n`;
  });

  return content;
}

/**
 * Export transactions as CSV file
 */
export async function exportAsCSV(transactions: Transaction[]): Promise<void> {
  try {
    const csvContent = generateCSV(transactions);
    const fileName = `transactions_${Date.now()}.csv`;

    if (Platform.OS === 'web') {
      // Web: Create download link
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
    } else {
      // Mobile: Save to file system and share
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, csvContent);

      await Share.share({
        url: fileUri,
        title: 'Export Transactions',
      });
    }
  } catch (error) {
    console.error('Failed to export CSV:', error);
    throw new Error('Failed to export transactions as CSV');
  }
}

/**
 * Export transactions as PDF file (text-based)
 */
export async function exportAsPDF(transactions: Transaction[]): Promise<void> {
  try {
    const pdfContent = generatePDFContent(transactions);
    const fileName = `transactions_${Date.now()}.txt`; // Using .txt for simplicity

    if (Platform.OS === 'web') {
      // Web: Create download link
      const blob = new Blob([pdfContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
    } else {
      // Mobile: Save to file system and share
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, pdfContent);

      await Share.share({
        url: fileUri,
        title: 'Export Transactions',
      });
    }
  } catch (error) {
    console.error('Failed to export PDF:', error);
    throw new Error('Failed to export transactions as PDF');
  }
}
