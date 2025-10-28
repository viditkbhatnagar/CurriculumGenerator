'use client';

import { useState, useRef, useCallback } from 'react';

interface ValidationError {
  sheet: string;
  row?: number;
  column?: string;
  message: string;
  severity: 'error' | 'warning';
}

interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  summary?: {
    totalErrors: number;
    totalWarnings: number;
    sheetsProcessed: string[];
  };
}

interface ExcelUploadInterfaceProps {
  programId: string;
  onUploadSuccess?: (uploadId: string) => void;
  onValidationSuccess?: () => void;
}

export function ExcelUploadInterface({ 
  programId, 
  onUploadSuccess,
  onValidationSuccess 
}: ExcelUploadInterfaceProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      validateFileType(droppedFile);
    }
  }, []);

  const validateFileType = (selectedFile: File) => {
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];

    if (!validTypes.includes(selectedFile.type)) {
      setError('Invalid file type. Please upload an Excel file (.xlsx or .xls)');
      return false;
    }

    if (selectedFile.size > 50 * 1024 * 1024) {
      setError('File size exceeds 50MB limit');
      return false;
    }

    setFile(selectedFile);
    setError(null);
    setValidationResult(null);
    return true;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      validateFileType(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(progress);
        }
      });

      xhr.addEventListener('load', async () => {
        if (xhr.status === 201) {
          const response = JSON.parse(xhr.responseText);
          const newUploadId = response.data.uploadId;
          setUploadId(newUploadId);
          
          if (onUploadSuccess) {
            onUploadSuccess(newUploadId);
          }

          // Automatically validate after upload
          await validateUpload(newUploadId);
        } else {
          const errorData = JSON.parse(xhr.responseText);
          throw new Error(errorData.error?.message || 'Upload failed');
        }
      });

      xhr.addEventListener('error', () => {
        throw new Error('Network error during upload');
      });

      xhr.open('POST', `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/programs/${programId}/upload-sme-data`);
      xhr.send(formData);
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to upload file');
    } finally {
      setIsUploading(false);
    }
  };

  const validateUpload = async (uploadIdToValidate: string) => {
    setIsValidating(true);
    setError(null);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/programs/uploads/${uploadIdToValidate}/validate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Validation failed');
      }

      const result = await response.json();
      setValidationResult(result);

      if (result.isValid && onValidationSuccess) {
        onValidationSuccess();
      }
    } catch (err: any) {
      console.error('Validation error:', err);
      setError(err.message || 'Failed to validate file');
    } finally {
      setIsValidating(false);
    }
  };

  const handleDownloadTemplate = () => {
    // In a real implementation, this would download an actual template file
    window.open('/templates/sme-curriculum-template.xlsx', '_blank');
  };

  const handleReset = () => {
    setFile(null);
    setUploadId(null);
    setValidationResult(null);
    setError(null);
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Template Download */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3 flex-1">
            <h3 className="text-sm font-medium text-blue-800">Need the template?</h3>
            <p className="mt-1 text-sm text-blue-700">
              Download the Excel template with all required sheets and formatting.
            </p>
            <button
              onClick={handleDownloadTemplate}
              className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-500"
            >
              Download Template →
            </button>
          </div>
        </div>
      </div>

      {/* Upload Area */}
      {!uploadId && (
        <div
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
          />

          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
          >
            <path
              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          {file ? (
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-900">{file.name}</p>
              <p className="text-sm text-gray-500">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
              <div className="mt-4 flex justify-center space-x-4">
                <button
                  onClick={handleReset}
                  className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
                >
                  Remove
                </button>
                <button
                  onClick={handleUpload}
                  disabled={isUploading}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading ? 'Uploading...' : 'Upload File'}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <p className="text-sm text-gray-600">
                Drag and drop your Excel file here, or
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-500"
              >
                browse to upload
              </button>
              <p className="mt-2 text-xs text-gray-500">
                Excel files only (.xlsx, .xls) • Max 50MB
              </p>
            </div>
          )}
        </div>
      )}

      {/* Upload Progress */}
      {isUploading && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-700">Uploading...</span>
            <span className="text-gray-900 font-medium">{uploadProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Validation Progress */}
      {isValidating && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center">
            <svg className="animate-spin h-5 w-5 text-yellow-600 mr-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-sm text-yellow-800">Validating Excel file...</span>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <p className="ml-3 text-sm text-red-800">{error}</p>
          </div>
        </div>
      )}

      {/* Validation Results */}
      {validationResult && (
        <div className="space-y-4">
          {/* Summary */}
          <div className={`border rounded-lg p-4 ${
            validationResult.isValid 
              ? 'bg-green-50 border-green-200' 
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-start">
              {validationResult.isValid ? (
                <svg className="h-6 w-6 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="h-6 w-6 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              )}
              <div className="ml-3 flex-1">
                <h3 className={`text-sm font-medium ${
                  validationResult.isValid ? 'text-green-800' : 'text-red-800'
                }`}>
                  {validationResult.isValid ? 'Validation Passed' : 'Validation Failed'}
                </h3>
                {validationResult.summary && (
                  <div className="mt-2 text-sm text-gray-700">
                    <p>Errors: {validationResult.summary.totalErrors}</p>
                    <p>Warnings: {validationResult.summary.totalWarnings}</p>
                    <p>Sheets Processed: {validationResult.summary.sheetsProcessed.length}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Errors */}
          {validationResult.errors.length > 0 && (
            <div className="bg-white border border-red-200 rounded-lg overflow-hidden">
              <div className="bg-red-50 px-4 py-3 border-b border-red-200">
                <h4 className="text-sm font-medium text-red-900">
                  Errors ({validationResult.errors.length})
                </h4>
              </div>
              <div className="max-h-64 overflow-y-auto">
                <ul className="divide-y divide-gray-200">
                  {validationResult.errors.map((error, index) => (
                    <li key={index} className="px-4 py-3">
                      <div className="flex items-start">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                          {error.sheet}
                        </span>
                        <div className="ml-3 flex-1">
                          <p className="text-sm text-gray-900">{error.message}</p>
                          {(error.row || error.column) && (
                            <p className="text-xs text-gray-500 mt-1">
                              {error.row && `Row ${error.row}`}
                              {error.row && error.column && ' • '}
                              {error.column && `Column ${error.column}`}
                            </p>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Warnings */}
          {validationResult.warnings.length > 0 && (
            <div className="bg-white border border-yellow-200 rounded-lg overflow-hidden">
              <div className="bg-yellow-50 px-4 py-3 border-b border-yellow-200">
                <h4 className="text-sm font-medium text-yellow-900">
                  Warnings ({validationResult.warnings.length})
                </h4>
              </div>
              <div className="max-h-64 overflow-y-auto">
                <ul className="divide-y divide-gray-200">
                  {validationResult.warnings.map((warning, index) => (
                    <li key={index} className="px-4 py-3">
                      <div className="flex items-start">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                          {warning.sheet}
                        </span>
                        <div className="ml-3 flex-1">
                          <p className="text-sm text-gray-900">{warning.message}</p>
                          {(warning.row || warning.column) && (
                            <p className="text-xs text-gray-500 mt-1">
                              {warning.row && `Row ${warning.row}`}
                              {warning.row && warning.column && ' • '}
                              {warning.column && `Column ${warning.column}`}
                            </p>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-4">
            <button
              onClick={handleReset}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Upload Different File
            </button>
            {validationResult.isValid && (
              <button
                onClick={() => onValidationSuccess?.()}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Continue to Generation
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
