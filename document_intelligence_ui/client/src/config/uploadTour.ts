import { Step } from 'react-joyride';

export const uploadTourSteps: Step[] = [
  {
    target: 'body',
    content: 'Welcome to the Document Upload page! Let\'s walk through how to upload and process your documents with our intelligent OCR system.',
    placement: 'center',
    disableBeacon: true,
  },
  {
    target: '[data-tour="category-selector"]',
    content: 'First, select the document category. We support 7 types: Citizenship & Identity, Immigration Status, Income & Employment, Tribal/AIAN, Health Coverage, and Supporting Documents.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="upload-zone"]',
    content: 'Drag and drop your document here, or click to browse. We support PDF, PNG, JPG, and JPEG formats up to 10MB.',
    placement: 'top',
  },
  {
    target: '[data-tour="upload-button"]',
    content: 'Once you\'ve selected a file and category, click here to start OCR processing. You\'ll see real-time progress updates.',
    placement: 'top',
  },
  {
    target: 'body',
    content: 'That\'s it! After upload, you\'ll be redirected to the document detail page where you can view OCR results and extracted data.',
    placement: 'center',
  },
];
