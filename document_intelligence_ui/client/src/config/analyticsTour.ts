import { Step } from 'react-joyride';

export const analyticsTourSteps: Step[] = [
  {
    target: 'body',
    content: 'Welcome to Analytics Dashboard! Let\'s take a quick tour of the powerful analytics features available to track your document processing performance.',
    placement: 'center',
    disableBeacon: true,
  },
  {
    target: '[data-tour="kpi-cards"]',
    content: 'Get a quick overview of your document processing metrics including total documents processed, success rate, average processing time, and confidence scores.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="period-selector"]',
    content: 'Filter your analytics data by different time periods: last 7 days, 30 days, or 90 days to see trends over time.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="trends-chart"]',
    content: 'Visualize your document processing trends over time. Track successful vs failed documents, processing times, and confidence scores with interactive charts.',
    placement: 'top',
  },
  {
    target: '[data-tour="category-stats"]',
    content: 'See how different document categories perform. Compare processing volumes, success rates, and average confidence scores across all 7 document types.',
    placement: 'top',
  },
  {
    target: '[data-tour="error-patterns"]',
    content: 'Identify common errors and issues in your document processing. Use this data to improve upload quality and reduce failures.',
    placement: 'top',
  },
  {
    target: '[data-tour="refresh-button"]',
    content: 'Click here to refresh all analytics data and get the most up-to-date insights on your document processing performance.',
    placement: 'left',
  },
  {
    target: 'body',
    content: 'Tour Complete! 🎉 You\'re now ready to explore your analytics dashboard. You can restart this tour anytime from the help menu.',
    placement: 'center',
  },
];
