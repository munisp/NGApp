'use client';

import React, { useState, useCallback } from 'react';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  AlertCircle,
  Download,
  Loader2,
  RefreshCw,
  Eye,
  Trash2,
} from 'lucide-react';
import { createLogger } from '@/lib/logger';
const log = createLogger('BulkOnboarding');

interface BulkOnboardingResult {
  rowNumber: number;
  organizationName: string;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'PENDING';
  caseId?: string;
  errors?: string[];
}

interface BulkOnboardingRequest {
  id: string;
  fileName: string;
  uploadedBy: string;
  totalRecords: number;
  processedRecords: number;
  successCount: number;
  failureCount: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  createdAt: string;
  completedAt?: string;
  results: BulkOnboardingResult[];
}

const API_BASE = process.env.NEXT_PUBLIC_ONBOARDING_API || 'http://localhost:8082';

export function BulkOnboarding() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentRequest, setCurrentRequest] = useState<BulkOnboardingRequest | null>(null);
  const [requests, setRequests] = useState<BulkOnboardingRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<BulkOnboardingRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === 'text/csv' || droppedFile.name.endsWith('.csv')) {
        setFile(droppedFile);
        setError(null);
      } else {
        setError('Please upload a CSV file');
      }
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type === 'text/csv' || selectedFile.name.endsWith('.csv')) {
        setFile(selectedFile);
        setError(null);
      } else {
        setError('Please upload a CSV file');
      }
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      const response = await fetch(`${API_BASE}/api/v1/onboarding/bulk`, {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        throw new Error('Failed to upload file');
      }

      const data = await response.json();
      setCurrentRequest(data);
      setRequests((prev) => [data, ...prev]);
      setFile(null);

      // Poll for status updates
      pollStatus(data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const pollStatus = async (requestId: string) => {
    const poll = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/v1/onboarding/bulk/${requestId}`);
        if (response.ok) {
          const data = await response.json();
          setCurrentRequest(data);
          setRequests((prev) =>
            prev.map((r) => (r.id === requestId ? data : r))
          );

          if (data.status === 'PROCESSING') {
            setTimeout(poll, 2000);
          }
        }
      } catch (err) {
        log.error('Failed to poll status:', err);
      }
    };
    poll();
  };

  const downloadTemplate = () => {
    const template = `organization_name,stakeholder_type,registration_number,country,contact_name,contact_email,contact_phone,address,website
"Example Bank Ltd",BANK,RC-123456,Nigeria,John Doe,john@example.com,+2348012345678,"123 Main St, Lagos",https://example.com
"Mobile Money Co",MOBILE_MONEY_OPERATOR,RC-789012,Kenya,Jane Smith,jane@example.com,+254712345678,"456 Central Ave, Nairobi",https://mobilemoney.co`;

    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bulk_onboarding_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'SUCCESS':
      case 'COMPLETED':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'FAILED':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'PROCESSING':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'PENDING':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'SKIPPED':
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SUCCESS':
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'FAILED':
        return 'bg-red-100 text-red-800';
      case 'PROCESSING':
        return 'bg-blue-100 text-blue-800';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'SKIPPED':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Bulk Onboarding</h2>
          <p className="text-sm text-gray-500 mt-1">
            Upload a CSV file to onboard multiple organizations at once
          </p>
        </div>
        <button
          onClick={downloadTemplate}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100"
        >
          <Download className="h-4 w-4" />
          Download Template
        </button>
      </div>

      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive
            ? 'border-primary-500 bg-primary-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        {file ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-3">
              <FileSpreadsheet className="h-12 w-12 text-green-500" />
              <div className="text-left">
                <p className="font-medium text-gray-900">{file.name}</p>
                <p className="text-sm text-gray-500">
                  {(file.size / 1024).toFixed(2)} KB
                </p>
              </div>
              <button
                onClick={() => setFile(null)}
                className="p-2 text-gray-400 hover:text-red-500"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
            {isUploading ? (
              <div className="space-y-2">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-sm text-gray-500">
                  Uploading... {uploadProgress}%
                </p>
              </div>
            ) : (
              <button
                onClick={handleUpload}
                className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
              >
                Start Processing
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <Upload className="h-12 w-12 text-gray-400 mx-auto" />
            <div>
              <p className="text-gray-600">
                Drag and drop your CSV file here, or{' '}
                <label className="text-primary-600 hover:text-primary-700 cursor-pointer font-medium">
                  browse
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Supports CSV files up to 10MB
              </p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <XCircle className="h-5 w-5 text-red-500" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Current Processing */}
      {currentRequest && currentRequest.status === 'PROCESSING' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
              <span className="font-medium text-blue-900">Processing...</span>
            </div>
            <span className="text-sm text-blue-700">
              {currentRequest.processedRecords} / {currentRequest.totalRecords} records
            </span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{
                width: `${(currentRequest.processedRecords / currentRequest.totalRecords) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Results Summary */}
      {currentRequest && currentRequest.status === 'COMPLETED' && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Processing Complete
          </h3>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">
                {currentRequest.totalRecords}
              </p>
              <p className="text-sm text-gray-500">Total Records</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-green-600">
                {currentRequest.successCount}
              </p>
              <p className="text-sm text-gray-500">Successful</p>
            </div>
            <div className="bg-red-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-red-600">
                {currentRequest.failureCount}
              </p>
              <p className="text-sm text-gray-500">Failed</p>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-yellow-600">
                {currentRequest.totalRecords - currentRequest.successCount - currentRequest.failureCount}
              </p>
              <p className="text-sm text-gray-500">Skipped</p>
            </div>
          </div>

          {/* Results Table */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Row
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Organization
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Case ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Errors
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentRequest.results?.map((result) => (
                  <tr key={result.rowNumber}>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {result.rowNumber}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {result.organizationName}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                          result.status
                        )}`}
                      >
                        {getStatusIcon(result.status)}
                        {result.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 font-mono">
                      {result.caseId || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-red-600">
                      {result.errors?.join(', ') || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Previous Requests */}
      {requests.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Previous Uploads
            </h3>
          </div>
          <div className="divide-y divide-gray-200">
            {requests.map((request) => (
              <div
                key={request.id}
                className="px-6 py-4 flex items-center justify-between hover:bg-gray-50"
              >
                <div className="flex items-center gap-4">
                  <FileSpreadsheet className="h-8 w-8 text-gray-400" />
                  <div>
                    <p className="font-medium text-gray-900">{request.fileName}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(request.createdAt).toLocaleString()} •{' '}
                      {request.totalRecords} records
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                      request.status
                    )}`}
                  >
                    {getStatusIcon(request.status)}
                    {request.status}
                  </span>
                  {request.status === 'COMPLETED' && (
                    <div className="text-sm text-gray-500">
                      <span className="text-green-600">{request.successCount}</span>
                      {' / '}
                      <span className="text-red-600">{request.failureCount}</span>
                    </div>
                  )}
                  <button
                    onClick={() => setSelectedRequest(request)}
                    className="p-2 text-gray-400 hover:text-gray-600"
                  >
                    <Eye className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CSV Format Guide */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          CSV Format Guide
        </h3>
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Required Columns</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                'organization_name',
                'stakeholder_type',
                'registration_number',
                'country',
                'contact_name',
                'contact_email',
              ].map((col) => (
                <code
                  key={col}
                  className="px-2 py-1 bg-white border border-gray-200 rounded text-sm text-gray-700"
                >
                  {col}
                </code>
              ))}
            </div>
          </div>
          <div>
            <h4 className="font-medium text-gray-700 mb-2">
              Stakeholder Types
            </h4>
            <div className="flex flex-wrap gap-2">
              {[
                'BANK',
                'MOBILE_MONEY_OPERATOR',
                'FINTECH',
                'MICROFINANCE_INSTITUTION',
                'GOVERNMENT_AGENCY',
                'MERCHANT',
              ].map((type) => (
                <span
                  key={type}
                  className="px-2 py-1 bg-primary-50 text-primary-700 rounded text-sm"
                >
                  {type}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BulkOnboarding;
