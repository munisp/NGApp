# Database Schema Documentation

## Overview

The Document Intelligence Platform uses MySQL/TiDB with Drizzle ORM for database management. The schema supports user authentication, document management, OCR processing, and batch operations.

---

## Tables

### 1. `users`

Stores user authentication and profile information.

**Columns:**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INT | PRIMARY KEY, AUTO_INCREMENT | Unique user identifier |
| `openId` | VARCHAR(64) | NOT NULL, UNIQUE | Manus OAuth identifier |
| `name` | TEXT | NULL | User's full name |
| `email` | VARCHAR(320) | NULL | User's email address |
| `loginMethod` | VARCHAR(64) | NULL | Authentication method used |
| `role` | ENUM('user', 'admin') | NOT NULL, DEFAULT 'user' | User role for access control |
| `createdAt` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Account creation timestamp |
| `updatedAt` | TIMESTAMP | NOT NULL, DEFAULT NOW(), ON UPDATE NOW() | Last update timestamp |
| `lastSignedIn` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Last login timestamp |

**Indexes:**
- PRIMARY KEY on `id`
- UNIQUE INDEX on `openId`

**Sample Data:**
```sql
INSERT INTO users (openId, name, email, loginMethod, role) VALUES
('oauth_123456', 'John Doe', 'john@example.com', 'google', 'user'),
('oauth_789012', 'Admin User', 'admin@example.com', 'email', 'admin');
```

---

### 2. `documents`

Stores uploaded documents and their processing status.

**Columns:**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INT | PRIMARY KEY, AUTO_INCREMENT | Unique document identifier |
| `userId` | INT | NOT NULL, FOREIGN KEY → users(id) | Owner of the document |
| `batchId` | INT | NULL, FOREIGN KEY → batches(id) | Associated batch (if part of batch upload) |
| `filename` | VARCHAR(255) | NOT NULL | Original filename |
| `fileUrl` | TEXT | NOT NULL | S3 URL to the stored file |
| `fileKey` | TEXT | NOT NULL | S3 object key |
| `category` | ENUM | NOT NULL | Document category (see categories below) |
| `status` | ENUM('pending', 'processing', 'completed', 'failed') | NOT NULL, DEFAULT 'pending' | Processing status |
| `uploadedAt` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Upload timestamp |
| `processedAt` | TIMESTAMP | NULL | Processing completion timestamp |

**Document Categories (ENUM values):**
- `citizenship_identity` - Birth certificates, passports
- `immigration_status` - Visas, green cards, work permits
- `income_employment` - Pay stubs, W-2 forms, tax returns
- `health_coverage` - Insurance cards, coverage letters
- `tribal_aian` - Tribal enrollment certificates
- `household_relationship` - Marriage certificates, divorce decrees
- `other_supporting` - Bank statements, utility bills, address verification

**Indexes:**
- PRIMARY KEY on `id`
- FOREIGN KEY on `userId` → `users(id)` ON DELETE CASCADE
- FOREIGN KEY on `batchId` → `batches(id)` ON DELETE CASCADE
- INDEX on `userId, status` for efficient filtering
- INDEX on `batchId` for batch queries

**Sample Data:**
```sql
INSERT INTO documents (userId, filename, fileUrl, fileKey, category, status) VALUES
(1, 'passport.jpg', 'https://s3.../passport.jpg', 'user-1/passport-abc123.jpg', 'citizenship_identity', 'completed'),
(1, 'w2_2024.pdf', 'https://s3.../w2.pdf', 'user-1/w2-def456.pdf', 'income_employment', 'processing');
```

---

### 3. `ocr_results`

Stores OCR processing results and extracted data.

**Columns:**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INT | PRIMARY KEY, AUTO_INCREMENT | Unique result identifier |
| `documentId` | INT | NOT NULL, UNIQUE, FOREIGN KEY → documents(id) | Associated document |
| `extractedText` | TEXT | NOT NULL | Full OCR extracted text |
| `confidence` | INT | NOT NULL | Confidence score (0-100) |
| `selectedEngine` | VARCHAR(50) | NULL | OCR engine used (deepseek, paddle, easy, tesseract) |
| `strategy` | VARCHAR(50) | NULL | Ensemble strategy used |
| `processingTimeMs` | INT | NULL | Processing time in milliseconds |
| `extractedData` | JSON | NULL | Structured extracted fields (JSON) |
| `metadata` | JSON | NULL | Additional metadata (JSON) |
| `createdAt` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Result creation timestamp |

**Indexes:**
- PRIMARY KEY on `id`
- UNIQUE INDEX on `documentId`
- FOREIGN KEY on `documentId` → `documents(id)` ON DELETE CASCADE

**Extracted Data JSON Structure:**
```json
{
  "full_name": "John Doe",
  "date_of_birth": "1990-01-15",
  "document_number": "P123456789",
  "issue_date": "2020-05-20",
  "expiry_date": "2030-05-20",
  "ssn_last_4": "1234",
  "employer_name": "Acme Corp",
  "annual_income": "$75,000"
}
```

**Metadata JSON Structure:**
```json
{
  "selected_engine": "deepseek",
  "strategy": "highest_confidence",
  "engine_results": {
    "deepseek": {"confidence": 0.95, "text": "..."},
    "paddle": {"confidence": 0.87, "text": "..."}
  },
  "fields_extracted": ["full_name", "date_of_birth", "document_number"]
}
```

**Sample Data:**
```sql
INSERT INTO ocr_results (documentId, extractedText, confidence, selectedEngine, strategy, processingTimeMs, extractedData, metadata) VALUES
(1, 'PASSPORT\nUnited States of America\nJohn Doe\n...', 95, 'deepseek', 'highest_confidence', 425, 
 '{"full_name":"John Doe","document_number":"P123456789"}',
 '{"selected_engine":"deepseek","strategy":"highest_confidence"}');
```

---

### 4. `batches`

Stores batch upload information and progress tracking.

**Columns:**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INT | PRIMARY KEY, AUTO_INCREMENT | Unique batch identifier |
| `userId` | INT | NOT NULL, FOREIGN KEY → users(id) | Owner of the batch |
| `name` | VARCHAR(255) | NULL | User-defined batch name |
| `totalFiles` | INT | NOT NULL | Total number of files in batch |
| `completedFiles` | INT | NOT NULL, DEFAULT 0 | Number of successfully processed files |
| `failedFiles` | INT | NOT NULL, DEFAULT 0 | Number of failed files |
| `status` | ENUM('pending', 'processing', 'completed', 'failed', 'cancelled') | NOT NULL, DEFAULT 'pending' | Overall batch status |
| `createdAt` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Batch creation timestamp |
| `updatedAt` | TIMESTAMP | NOT NULL, DEFAULT NOW(), ON UPDATE NOW() | Last update timestamp |

**Indexes:**
- PRIMARY KEY on `id`
- FOREIGN KEY on `userId` → `users(id)` ON DELETE CASCADE
- INDEX on `userId, status` for efficient filtering

**Sample Data:**
```sql
INSERT INTO batches (userId, name, totalFiles, completedFiles, failedFiles, status) VALUES
(1, 'Health Insurance Documents - January 2025', 5, 3, 0, 'processing'),
(1, 'Income Verification Package', 4, 4, 0, 'completed');
```

---

## Relationships

```
users (1) ──< (N) documents
users (1) ──< (N) batches
batches (1) ──< (N) documents
documents (1) ── (1) ocr_results
```

**Cascade Rules:**
- Deleting a user deletes all their documents, batches, and OCR results
- Deleting a batch deletes all associated documents and their OCR results
- Deleting a document deletes its OCR result

---

## Queries

### Common Query Patterns

**1. Get all documents for a user with OCR results:**
```sql
SELECT 
  d.*,
  o.extractedText,
  o.confidence,
  o.extractedData
FROM documents d
LEFT JOIN ocr_results o ON d.id = o.documentId
WHERE d.userId = ?
ORDER BY d.uploadedAt DESC;
```

**2. Get batch with progress statistics:**
```sql
SELECT 
  b.*,
  COUNT(d.id) as total_documents,
  SUM(CASE WHEN d.status = 'completed' THEN 1 ELSE 0 END) as completed,
  SUM(CASE WHEN d.status = 'failed' THEN 1 ELSE 0 END) as failed,
  SUM(CASE WHEN d.status = 'processing' THEN 1 ELSE 0 END) as processing
FROM batches b
LEFT JOIN documents d ON b.id = d.batchId
WHERE b.id = ?
GROUP BY b.id;
```

**3. Get documents by category and status:**
```sql
SELECT d.*, o.confidence
FROM documents d
LEFT JOIN ocr_results o ON d.id = o.documentId
WHERE d.userId = ?
  AND d.category = 'income_employment'
  AND d.status = 'completed'
ORDER BY o.confidence DESC;
```

**4. Get average confidence by document category:**
```sql
SELECT 
  d.category,
  COUNT(*) as document_count,
  AVG(o.confidence) as avg_confidence,
  MIN(o.confidence) as min_confidence,
  MAX(o.confidence) as max_confidence
FROM documents d
INNER JOIN ocr_results o ON d.id = o.documentId
WHERE d.userId = ? AND d.status = 'completed'
GROUP BY d.category;
```

**5. Get recent failed documents for retry:**
```sql
SELECT d.*
FROM documents d
WHERE d.batchId = ?
  AND d.status = 'failed'
ORDER BY d.uploadedAt DESC;
```

---

## Migrations

### Initial Schema Creation

```sql
-- Create users table
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  openId VARCHAR(64) NOT NULL UNIQUE,
  name TEXT,
  email VARCHAR(320),
  loginMethod VARCHAR(64),
  role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  lastSignedIn TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create batches table
CREATE TABLE batches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  name VARCHAR(255),
  totalFiles INT NOT NULL,
  completedFiles INT NOT NULL DEFAULT 0,
  failedFiles INT NOT NULL DEFAULT 0,
  status ENUM('pending', 'processing', 'completed', 'failed', 'cancelled') NOT NULL DEFAULT 'pending',
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

-- Create documents table
CREATE TABLE documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  batchId INT,
  filename VARCHAR(255) NOT NULL,
  fileUrl TEXT NOT NULL,
  fileKey TEXT NOT NULL,
  category ENUM('citizenship_identity', 'immigration_status', 'income_employment', 'health_coverage', 'tribal_aian', 'household_relationship', 'other_supporting') NOT NULL,
  status ENUM('pending', 'processing', 'completed', 'failed') NOT NULL DEFAULT 'pending',
  uploadedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processedAt TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (batchId) REFERENCES batches(id) ON DELETE CASCADE
);

-- Create ocr_results table
CREATE TABLE ocr_results (
  id INT AUTO_INCREMENT PRIMARY KEY,
  documentId INT NOT NULL UNIQUE,
  extractedText TEXT NOT NULL,
  confidence INT NOT NULL,
  selectedEngine VARCHAR(50),
  strategy VARCHAR(50),
  processingTimeMs INT,
  extractedData JSON,
  metadata JSON,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (documentId) REFERENCES documents(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX idx_documents_user_status ON documents(userId, status);
CREATE INDEX idx_documents_batch ON documents(batchId);
CREATE INDEX idx_batches_user_status ON batches(userId, status);
```

---

## Performance Considerations

1. **Indexes**: All foreign keys have indexes for efficient joins
2. **JSON Fields**: Use JSON functions for querying extracted data
3. **Cascade Deletes**: Automatic cleanup of related records
4. **Timestamps**: Automatic tracking of creation and updates
5. **Status Filtering**: Composite indexes on (userId, status) for fast filtering

---

## Data Retention

- **Documents**: Retained indefinitely unless explicitly deleted by user
- **OCR Results**: Tied to document lifecycle, deleted with document
- **Batches**: Retained with all associated documents
- **Users**: Soft delete recommended (add `deletedAt` column)

---

## Backup Strategy

1. **Daily Backups**: Full database backup at midnight UTC
2. **Point-in-Time Recovery**: Transaction log backups every hour
3. **S3 Files**: Separate backup of S3 bucket with versioning enabled
4. **Retention**: 30 days for daily backups, 7 days for transaction logs

---

## Security

1. **Row-Level Security**: All queries filtered by `userId`
2. **Role-Based Access**: Admin role for system operations
3. **Encrypted Storage**: S3 files encrypted at rest
4. **Audit Logging**: Track all document access and modifications
5. **PII Protection**: Sensitive data in `extractedData` JSON field

---

## Future Enhancements

1. Add `document_versions` table for version history
2. Add `audit_logs` table for compliance tracking
3. Add `sharing_permissions` table for document sharing
4. Add `processing_queue` table for async job management
5. Add `analytics_events` table for usage tracking
