# Document Intelligence Platform UI

A modern web interface for uploading and analyzing health insurance marketplace documents using intelligent OCR processing with multi-engine ensemble technology.

## Features

### Core Functionality
- **Single Document Upload**: Drag-and-drop interface supporting JPG, PNG, WEBP, and PDF files up to 50MB
- **Batch Upload**: Upload and process multiple documents simultaneously with parallel processing
- **7 Document Categories**: 
  - Citizenship & Identity (birth certificates, passports)
  - Immigration Status (visas, green cards, work permits)
  - Income & Employment (pay stubs, W-2 forms, tax returns)
  - Tribal/AIAN Documentation
  - Employer Health Coverage
  - Household & Relationship
  - Other Supporting Documents
- **Real-time OCR Processing**: Automatic processing with status updates
- **Results Visualization**: View extracted text and structured data fields
- **Confidence Scoring**: Visual confidence indicators for OCR results
- **Export Capabilities**: Download results as JSON

### Batch Processing Features
- **Multi-file Upload**: Select or drag-and-drop multiple files at once
- **Concurrent Processing**: Process up to 5 files simultaneously with automatic queuing
- **Progress Tracking**: Real-time progress visualization for each file and overall batch
- **Batch Management**: View, monitor, and manage all batch uploads
- **Bulk Operations**: 
  - Retry failed documents in a batch
  - Delete entire batches with all documents
  - Download batch results as JSON
- **Queue Management**: Add, remove, and clear files before processing
- **Status Indicators**: Visual feedback for queued, uploading, processing, completed, and failed states

### Technical Highlights
- **96% Accuracy**: Using highest_confidence ensemble strategy
- **425ms Average Processing Time**: Lightning-fast document processing
- **150+ Document Types**: Comprehensive support across all categories
- **Multi-Engine OCR**: Ensemble of DeepSeek-OCR, PaddleOCR, EasyOCR, and Tesseract
- **Parallel Processing**: Up to 5 concurrent uploads per batch with automatic queuing
- **Scalable Architecture**: Batch processing with progress tracking and error recovery

## Technology Stack

### Frontend
- **React 19** with TypeScript
- **Tailwind CSS 4** for styling
- **tRPC 11** for type-safe API calls
- **Wouter** for routing
- **shadcn/ui** components
- **date-fns** for date formatting
- **Sonner** for toast notifications

### Backend
- **Express 4** server
- **tRPC** for API layer
- **Drizzle ORM** with MySQL/TiDB
- **S3-compatible storage** for file uploads
- **Manus OAuth** for authentication

### Database Schema
- **users**: User accounts with role-based access
- **documents**: Document metadata and processing status
- **ocrResults**: OCR extraction results and confidence scores
- **batches**: Batch upload tracking with progress statistics

## Project Structure

```
client/
├── src/
│   ├── pages/
│   │   ├── Home.tsx              # Landing page
│   │   ├── Upload.tsx            # Single document upload
│   │   ├── BatchUpload.tsx       # Batch upload interface
│   │   ├── Documents.tsx         # Document list view
│   │   ├── DocumentDetail.tsx    # OCR results viewer
│   │   ├── Batches.tsx           # Batch list view
│   │   └── BatchDetail.tsx       # Batch progress viewer
│   ├── hooks/
│   │   └── useBatchQueue.ts      # Batch queue manager
│   ├── components/ui/            # shadcn/ui components
│   └── lib/trpc.ts              # tRPC client setup
server/
├── db.ts                         # Database helpers
├── routers.ts                    # tRPC procedures
└── storage.ts                    # S3 storage helpers
drizzle/
└── schema.ts                     # Database schema
shared/
└── documentCategories.ts         # Shared constants
```

## Getting Started

### Prerequisites
- Node.js 22+
- pnpm
- MySQL/TiDB database
- S3-compatible storage

### Installation

```bash
# Install dependencies
pnpm install

# Push database schema
pnpm db:push

# Start development server
pnpm dev
```

The application will be available at `http://localhost:3000`

### Environment Variables

Required environment variables (automatically configured in Manus platform):
- `DATABASE_URL`: MySQL/TiDB connection string
- `JWT_SECRET`: Session cookie signing secret
- `VITE_APP_ID`: OAuth application ID
- `OAUTH_SERVER_URL`: OAuth backend URL
- `VITE_OAUTH_PORTAL_URL`: OAuth login portal URL
- `VITE_APP_TITLE`: Application title
- `VITE_APP_LOGO`: Logo image URL
- Storage credentials (S3-compatible)

Optional:
- `OCR_SERVICE_URL`: OCR ensemble service endpoint (default: `http://ensemble-ocr:8001`)

## Usage

### Single Document Upload

1. Navigate to the Upload page
2. Select a document category from the dropdown
3. Drag and drop a file or click to browse
4. File is automatically uploaded and queued for processing
5. View processing status in real-time

### Batch Upload

1. Navigate to the Batch Upload page
2. (Optional) Enter a batch name for easy reference
3. Select a document category (applies to all files in batch)
4. Drag and drop multiple files or click to browse
5. Review the queue and remove any unwanted files
6. Click "Process Batch" to start uploading and processing
7. Monitor real-time progress for each file
8. Navigate to batch detail page to view results

### Managing Batches

1. Navigate to My Batches to view all batch uploads
2. Click "View Details" on any batch to see:
   - Overall progress and statistics
   - Individual document status
   - Processing metrics
3. For completed batches:
   - Download results as JSON
   - View individual document results
4. For batches with failures:
   - Retry failed documents
   - Delete the entire batch

### Viewing Results

1. Navigate to My Documents or batch detail page
2. Click "View Results" on completed documents
3. Review:
   - Confidence score with visual indicator
   - OCR engine used and processing time
   - Extracted raw text
   - Structured data fields (SSN, dates, amounts, etc.)
4. Download results as JSON

## OCR Processing

The platform integrates with a multi-engine OCR ensemble service that:

1. Accepts document uploads via tRPC mutation
2. Stores files in S3-compatible storage
3. Calls the OCR ensemble service asynchronously
4. Updates document status (pending → processing → completed/failed)
5. Stores extracted text, confidence scores, and structured data
6. Supports real-time status polling on the frontend

### Batch Processing Architecture

**Concurrent Upload**: Files are uploaded in chunks of 5 simultaneously to balance speed and resource usage.

**Progress Tracking**: Each file in the batch has its own status (queued, uploading, processing, completed, failed) with real-time updates.

**Error Handling**: Failed uploads are tracked separately and can be retried individually or as a group.

**Database Integration**: Batches are stored with metadata including total files, completed count, and failed count for easy monitoring.

### OCR Service Integration

The backend expects an OCR service at `OCR_SERVICE_URL` with the following API:

```
POST /ocr
Content-Type: application/json

{
  "image_url": "https://...",
  "document_type": "citizenship_identity",
  "strategy": "highest_confidence"
}

Response:
{
  "text": "extracted text...",
  "confidence": 0.96,
  "processing_time_ms": 425,
  "metadata": {
    "selected_engine": "deepseek-ocr",
    "strategy": "highest_confidence",
    "fields_extracted": {
      "ssn": "123-45-6789",
      "date_of_birth": "1990-01-01"
    }
  }
}
```

## Development

### Database Migrations

```bash
# Generate migration
pnpm db:push

# View database in Manus UI
# Navigate to Management UI → Database panel
```

### Adding New Features

1. Update `todo.md` with new tasks
2. Modify database schema in `drizzle/schema.ts`
3. Add database helpers in `server/db.ts`
4. Create tRPC procedures in `server/routers.ts`
5. Build UI components in `client/src/pages/`
6. Update routes in `client/src/App.tsx`
7. Mark tasks as complete in `todo.md`

### Code Quality

- TypeScript strict mode enabled
- ESLint for code linting
- Prettier for code formatting
- Type-safe API calls with tRPC
- Superjson for Date serialization

## Deployment

### Via Manus Platform

1. Save checkpoint: Creates deployment-ready snapshot
2. Click "Publish" in Management UI
3. Access via auto-generated domain or custom domain

### Manual Deployment

```bash
# Build for production
pnpm build

# Start production server
pnpm start
```

## Performance

- **Client-side**: Code splitting, lazy loading, optimistic updates
- **Server-side**: Async OCR processing, connection pooling, concurrent uploads
- **Database**: Indexed queries, efficient schema design
- **Storage**: S3 for scalable file storage
- **Real-time**: Polling with smart refetch intervals
- **Batch Processing**: Chunked uploads with concurrency limits (5 files at a time)

## Security

- **Authentication**: Manus OAuth with session cookies
- **Authorization**: User-owned documents, role-based access
- **File Upload**: Type and size validation, S3 isolation
- **Data Privacy**: User data segregation, secure storage
- **API Security**: tRPC input validation, CSRF protection
- **Batch Operations**: Ownership verification for all batch operations

## Browser Support

- Chrome/Edge (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Mobile browsers (iOS Safari, Chrome Android)

## API Reference

### Document Operations
- `documents.upload`: Upload a single document
- `documents.list`: List all user documents
- `documents.getById`: Get document with OCR results

### Batch Operations
- `batches.uploadBatch`: Upload multiple documents as a batch
- `batches.list`: List all user batches
- `batches.getById`: Get batch with documents and statistics
- `batches.cancel`: Cancel a batch (stops processing)
- `batches.retryFailed`: Retry all failed documents in a batch
- `batches.delete`: Delete a batch and all its documents

## License

Proprietary - Part of the Document Intelligence Platform

## Support

For issues or questions:
- Check the todo.md for known limitations
- Review the technical context in session documentation
- Contact the development team

---

**Built with ❤️ using the Manus Platform**
