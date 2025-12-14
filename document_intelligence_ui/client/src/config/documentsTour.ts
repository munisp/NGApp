import { Step } from 'react-joyride';

export const documentsTourSteps: Step[] = [
  {
    target: 'body',
    content: 'Welcome to the Documents page! Here you can view, search, filter, and manage all your processed documents.',
    placement: 'center',
    disableBeacon: true,
  },
  {
    target: '[data-tour="search-bar"]',
    content: 'Search for documents by filename. The search updates in real-time as you type.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="filter-bar"]',
    content: 'Filter documents by category (Passport, Pay Stub, etc.) and status (Completed, Processing, Failed). You can select multiple filters.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="sort-options"]',
    content: 'Sort your documents by date, name, or status in ascending or descending order.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="documents-table"]',
    content: 'View all your documents with their status, category, confidence score, and processing time. Click any row to see detailed OCR results.',
    placement: 'top',
  },
  {
    target: '[data-tour="compare-button"]',
    content: 'Compare multiple documents side-by-side to identify differences in extracted data and confidence scores.',
    placement: 'left',
  },
  {
    target: 'body',
    content: 'You\'re all set! Use these tools to efficiently manage and analyze your document collection.',
    placement: 'center',
  },
];
