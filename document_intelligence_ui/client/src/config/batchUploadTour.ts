import { Step } from 'react-joyride';

export const batchUploadTourSteps: Step[] = [
  {
    target: 'body',
    content: 'Welcome to Batch Upload! Process multiple documents simultaneously with our intelligent queue system. Let\'s explore how it works.',
    placement: 'center',
    disableBeacon: true,
  },
  {
    target: '[data-tour="category-selector"]',
    content: 'First, select the document category for your batch. All files in this batch will be processed as the same document type.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="file-selector"]',
    content: 'Click here to select multiple files at once. You can choose up to 50 files per batch. Supported formats: PDF, PNG, JPG, JPEG (max 10MB each).',
    placement: 'bottom',
  },
  {
    target: '[data-tour="selected-files"]',
    content: 'All selected files appear here. You can review the list and remove any files before uploading. Each file shows its name and size.',
    placement: 'top',
  },
  {
    target: '[data-tour="upload-button"]',
    content: 'Click "Upload Batch" to start processing. The system will automatically queue your files and process up to 5 documents concurrently.',
    placement: 'top',
  },
  {
    target: '[data-tour="queue-stats"]',
    content: 'Monitor your batch progress here. See total files, completed count, failed count, and overall progress percentage in real-time.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="queue-list"]',
    content: 'Watch individual file progress in the queue. Each file shows its status: Queued (waiting), Processing (active), Completed (success), or Failed (error).',
    placement: 'top',
  },
  {
    target: '[data-tour="concurrent-info"]',
    content: 'The system processes 5 files concurrently for optimal performance. Remaining files wait in the queue and start automatically as slots become available.',
    placement: 'top',
  },
  {
    target: '[data-tour="file-actions"]',
    content: 'For completed files, click to view detailed OCR results. For failed files, you can retry processing or remove them from the batch.',
    placement: 'left',
  },
  {
    target: '[data-tour="batch-actions"]',
    content: 'Use bulk actions to retry all failed documents at once or cancel the entire batch. These buttons appear when relevant.',
    placement: 'left',
  },
  {
    target: 'body',
    content: 'You\'re ready to batch process! Upload multiple documents and let the system handle concurrent processing automatically. Check the Batches page to view all your batch history.',
    placement: 'center',
  },
];
