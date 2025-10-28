# Excel Upload and Validation Service

This document describes the Excel upload and validation service implementation for the Curriculum Generator App.

## Overview

The service handles the complete workflow of uploading, validating, and storing SME-submitted Excel templates containing curriculum data.

## Components Implemented

### 1. File Upload and Storage (Task 4.1)

**Files Created:**
- `src/services/storageService.ts` - Handles file storage (local/S3)
- `src/services/uploadService.ts` - Manages file upload metadata
- `migrations/1761596425771_add-file-uploads-table.js` - Database schema for file tracking

**Features:**
- Multipart file upload with 50MB size limit
- File type validation (only .xlsx and .xls files)
- Local storage with S3 support placeholder
- File metadata tracking in database
- Unique file identifiers for storage

**API Endpoints:**
- `POST /api/programs/:id/upload-sme-data` - Upload Excel file
- `GET /api/programs/:id/uploads` - List uploads for a program
- `GET /api/programs/uploads/:uploadId` - Get upload metadata
- `DELETE /api/programs/uploads/:uploadId` - Delete an upload

### 2. Excel Parsing and Validation (Task 4.2)

**Files Created:**
- `src/types/excel.ts` - TypeScript types for all Excel sheet data
- `src/services/excelParserService.ts` - Excel file parsing logic
- `src/services/excelValidationService.ts` - Comprehensive validation rules

**Supported Sheets (15 total):**
1. Program Overview
2. Competency Framework
3. Learning Outcomes
4. Course Framework
5. Topic Sources
6. Reading Lists
7. Assessments
8. Glossary
9. Case Studies
10. Delivery Specifications

**Validation Features:**
- Required sheet validation
- Field-level validation with row/column references
- Data type validation
- Business rule validation (e.g., total hours = 120)
- Bloom's Taxonomy verb checking
- URL format validation
- Source recency validation (5-year rule)
- Duplicate detection
- Detailed error and warning messages

**API Endpoints:**
- `POST /api/programs/uploads/:uploadId/validate` - Validate Excel structure and data

### 3. Store Parsed Program Data (Task 4.3)

**Files Created:**
- `src/services/programService.ts` - Program data storage and retrieval

**Features:**
- Transactional data storage (all-or-nothing)
- Stores data across multiple tables:
  - programs
  - modules
  - learning_outcomes
  - assessments
  - knowledge_base (for topic sources)
- Automatic relationship mapping
- Program status tracking
- Comprehensive error handling with rollback

**API Endpoints:**
- `POST /api/programs/uploads/:uploadId/process` - Process and store validated data
- `GET /api/programs` - List all programs
- `GET /api/programs/:id` - Get program with full details
- `DELETE /api/programs/:id` - Delete a program

## Usage Flow

1. **Upload Excel File**
   ```
   POST /api/programs/:programId/upload-sme-data
   Content-Type: multipart/form-data
   Body: file (Excel file)
   ```

2. **Validate Excel Data**
   ```
   POST /api/programs/uploads/:uploadId/validate
   ```
   Returns validation results with errors and warnings

3. **Process and Store Data**
   ```
   POST /api/programs/uploads/:uploadId/process
   ```
   Stores validated data in database and returns program ID

4. **Retrieve Program**
   ```
   GET /api/programs/:programId
   ```
   Returns complete program with modules, outcomes, and assessments

## Error Handling

The service provides detailed error responses:

- **400 Bad Request** - Invalid file type or size
- **404 Not Found** - Upload or program not found
- **422 Unprocessable Entity** - Validation failed
- **500 Internal Server Error** - Storage or processing failure

All errors include:
- Error code
- Descriptive message
- Timestamp
- Request ID for tracking

## Database Schema

### file_uploads Table
- Tracks uploaded Excel files
- Links to programs
- Stores file metadata (size, type, path)
- Tracks upload status

### Programs, Modules, Learning Outcomes, Assessments
- Existing tables used to store parsed curriculum data
- Cascade delete for data integrity

## Security Features

- File size limits (50MB)
- File type validation
- Audit logging for all operations
- User tracking for uploads
- Transaction safety for data integrity

## Future Enhancements

- AWS S3 integration for production storage
- Batch upload support
- Excel template generation
- Advanced validation rules
- Real-time validation feedback
- Version control for uploaded files

## Testing

To test the service:

1. Ensure database is running and migrated
2. Start the backend server
3. Use Postman or curl to test endpoints
4. Check validation with various Excel files

## Dependencies

- `exceljs` - Excel file parsing
- `multer` - File upload handling
- `pg` - PostgreSQL database client
