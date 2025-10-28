# API Endpoints Documentation

## Excel Upload and Program Management

### Upload Excel File

**Endpoint:** `POST /api/programs/:id/upload-sme-data`

**Description:** Upload an Excel file containing SME curriculum data

**Request:**
- Method: POST
- Content-Type: multipart/form-data
- Body: 
  - `file`: Excel file (.xlsx or .xls)
- Max file size: 50MB

**Response (201):**
```json
{
  "message": "File uploaded successfully",
  "data": {
    "uploadId": "uuid",
    "programId": "uuid",
    "filename": "curriculum.xlsx",
    "fileSize": 1024000,
    "uploadStatus": "completed",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Errors:**
- 400: Invalid file type or size exceeded
- 500: Upload failed

---

### Validate Excel Data

**Endpoint:** `POST /api/programs/uploads/:uploadId/validate`

**Description:** Validate the structure and content of an uploaded Excel file

**Request:**
- Method: POST
- No body required

**Response (200):**
```json
{
  "isValid": true,
  "errors": [],
  "warnings": [
    {
      "sheet": "Learning Outcomes",
      "row": 3,
      "field": "Outcome Text",
      "message": "Learning outcome should start with a Bloom's Taxonomy verb",
      "severity": "warning"
    }
  ],
  "summary": {
    "totalErrors": 0,
    "totalWarnings": 1,
    "sheetsProcessed": [
      "Program Overview",
      "Competency Framework",
      "Learning Outcomes",
      "Course Framework",
      "Topic Sources",
      "Reading Lists",
      "Assessments",
      "Glossary",
      "Case Studies",
      "Delivery Specifications"
    ]
  }
}
```

**Errors:**
- 404: Upload not found
- 422: Validation failed (missing required sheets)

---

### Process and Store Excel Data

**Endpoint:** `POST /api/programs/uploads/:uploadId/process`

**Description:** Parse, validate, and store Excel data in the database

**Request:**
- Method: POST
- No body required

**Response (201):**
```json
{
  "message": "Program \"Business Intelligence Certificate\" created successfully",
  "data": {
    "programId": "uuid",
    "stats": {
      "modulesCreated": 5,
      "learningOutcomesCreated": 8,
      "assessmentsCreated": 25
    }
  }
}
```

**Errors:**
- 404: Upload not found
- 422: Validation failed (data errors)
- 500: Storage failed

---

### List Programs

**Endpoint:** `GET /api/programs`

**Description:** Get a list of all programs

**Query Parameters:**
- `status` (optional): Filter by status (draft, submitted, approved)
- `limit` (optional): Number of results to return
- `offset` (optional): Pagination offset

**Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "programName": "Business Intelligence Certificate",
      "qualificationLevel": "Level 5",
      "qualificationType": "Certificate",
      "totalCredits": 120,
      "industrySector": "Technology",
      "status": "draft",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "limit": 10,
    "offset": 0
  }
}
```

---

### Get Program Details

**Endpoint:** `GET /api/programs/:id`

**Description:** Get complete program details including modules, outcomes, and assessments

**Response (200):**
```json
{
  "data": {
    "id": "uuid",
    "programName": "Business Intelligence Certificate",
    "qualificationLevel": "Level 5",
    "qualificationType": "Certificate",
    "totalCredits": 120,
    "industrySector": "Technology",
    "status": "draft",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "modules": [
      {
        "id": "uuid",
        "module_code": "MOD001",
        "module_title": "Introduction to BI",
        "hours": 24,
        "module_aim": "Introduce students to BI concepts",
        "core_elective": "Core",
        "sequence_order": 1,
        "learningOutcomes": [...],
        "assessments": [...]
      }
    ]
  }
}
```

**Errors:**
- 404: Program not found

---

### Delete Program

**Endpoint:** `DELETE /api/programs/:id`

**Description:** Delete a program and all related data

**Response (200):**
```json
{
  "message": "Program deleted successfully"
}
```

---

### Get Program Uploads

**Endpoint:** `GET /api/programs/:id/uploads`

**Description:** Get all file uploads for a specific program

**Response (200):**
```json
{
  "data": [
    {
      "uploadId": "uuid",
      "filename": "curriculum.xlsx",
      "fileSize": 1024000,
      "uploadStatus": "completed",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

---

### Get Upload Metadata

**Endpoint:** `GET /api/programs/uploads/:uploadId`

**Description:** Get metadata for a specific upload

**Response (200):**
```json
{
  "data": {
    "uploadId": "uuid",
    "programId": "uuid",
    "filename": "curriculum.xlsx",
    "fileSize": 1024000,
    "mimeType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "uploadStatus": "completed",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Errors:**
- 404: Upload not found

---

### Delete Upload

**Endpoint:** `DELETE /api/programs/uploads/:uploadId`

**Description:** Delete an uploaded file and its metadata

**Response (200):**
```json
{
  "message": "Upload deleted successfully"
}
```

**Errors:**
- 404: Upload not found

---

## Error Response Format

All error responses follow this format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {},
    "timestamp": "2024-01-01T00:00:00.000Z",
    "requestId": "req-123456"
  }
}
```

## Common Error Codes

- `FILE_REQUIRED`: No file was uploaded
- `VALIDATION_ERROR`: File validation failed
- `UPLOAD_NOT_FOUND`: Upload ID not found
- `PROGRAM_NOT_FOUND`: Program ID not found
- `VALIDATION_FAILED`: Excel data validation failed
- `STORAGE_FAILED`: Database storage failed
- `INTERNAL_ERROR`: Unexpected server error
