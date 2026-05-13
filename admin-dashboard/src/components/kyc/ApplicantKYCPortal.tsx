'use client';

import React, { useState, useRef } from 'react';
import {
import { createLogger } from '@/lib/logger';
const log = createLogger('ApplicantKYCPortal');
  User,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Upload,
  Camera,
  Shield,
  Globe,
  Calendar,
  CreditCard,
  FileImage,
  AlertCircle,
  Check,
  ChevronRight,
  ChevronLeft,
  Fingerprint,
  Eye,
  Trash2,
  RefreshCw,
} from 'lucide-react';

// Types
type DocumentType = 'PASSPORT' | 'NATIONAL_ID' | 'DRIVERS_LICENSE' | 'PROOF_OF_ADDRESS' | 'UTILITY_BILL' | 'SELFIE';
type StepStatus = 'pending' | 'current' | 'completed' | 'error';

interface UploadedDocument {
  id: string;
  type: DocumentType;
  file: File;
  preview?: string;
  status: 'uploading' | 'uploaded' | 'processing' | 'verified' | 'rejected';
  extractedData?: Record<string, string>;
  error?: string;
}

interface PersonalInfo {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  nationality: string;
  email: string;
  phone: string;
  address: string;
}

const documentTypeLabels: Record<DocumentType, { label: string; description: string; icon: React.ReactNode }> = {
  PASSPORT: {
    label: 'Passport',
    description: 'Upload the photo page of your valid passport',
    icon: <Globe className="h-6 w-6" />,
  },
  NATIONAL_ID: {
    label: 'National ID',
    description: 'Upload front and back of your national ID card',
    icon: <CreditCard className="h-6 w-6" />,
  },
  DRIVERS_LICENSE: {
    label: "Driver's License",
    description: 'Upload front and back of your valid driver\'s license',
    icon: <CreditCard className="h-6 w-6" />,
  },
  PROOF_OF_ADDRESS: {
    label: 'Proof of Address',
    description: 'Bank statement, utility bill, or government letter (less than 3 months old)',
    icon: <FileText className="h-6 w-6" />,
  },
  UTILITY_BILL: {
    label: 'Utility Bill',
    description: 'Recent utility bill showing your name and address',
    icon: <FileText className="h-6 w-6" />,
  },
  SELFIE: {
    label: 'Selfie Photo',
    description: 'Take a clear photo of your face for identity verification',
    icon: <Camera className="h-6 w-6" />,
  },
};

const steps = [
  { id: 'personal', label: 'Personal Info', icon: User },
  { id: 'identity', label: 'Identity Document', icon: CreditCard },
  { id: 'address', label: 'Proof of Address', icon: FileText },
  { id: 'selfie', label: 'Selfie & Liveness', icon: Camera },
  { id: 'review', label: 'Review & Submit', icon: CheckCircle },
];

// File Upload Component
function FileUpload({
  documentType,
  onUpload,
  uploadedDoc,
  onRemove,
}: {
  documentType: DocumentType;
  onUpload: (file: File) => void;
  uploadedDoc?: UploadedDocument;
  onRemove: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { label, description, icon } = documentTypeLabels[documentType];

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) onUpload(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onUpload(file);
  };

  if (uploadedDoc) {
    return (
      <div className={`border-2 rounded-lg p-4 ${
        uploadedDoc.status === 'verified' ? 'border-green-300 bg-green-50' :
        uploadedDoc.status === 'rejected' ? 'border-red-300 bg-red-50' :
        uploadedDoc.status === 'processing' ? 'border-blue-300 bg-blue-50' :
        'border-gray-300 bg-gray-50'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {uploadedDoc.preview ? (
              <img src={uploadedDoc.preview} alt="Preview" className="h-16 w-16 object-cover rounded" />
            ) : (
              <div className="h-16 w-16 bg-gray-200 rounded flex items-center justify-center">
                <FileImage className="h-8 w-8 text-gray-400" />
              </div>
            )}
            <div>
              <p className="font-medium text-gray-900">{label}</p>
              <p className="text-sm text-gray-500">{uploadedDoc.file.name}</p>
              <div className="flex items-center space-x-2 mt-1">
                {uploadedDoc.status === 'uploading' && (
                  <span className="text-xs text-blue-600 flex items-center">
                    <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> Uploading...
                  </span>
                )}
                {uploadedDoc.status === 'processing' && (
                  <span className="text-xs text-blue-600 flex items-center">
                    <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> Processing with AI...
                  </span>
                )}
                {uploadedDoc.status === 'verified' && (
                  <span className="text-xs text-green-600 flex items-center">
                    <CheckCircle className="h-3 w-3 mr-1" /> Verified
                  </span>
                )}
                {uploadedDoc.status === 'rejected' && (
                  <span className="text-xs text-red-600 flex items-center">
                    <XCircle className="h-3 w-3 mr-1" /> {uploadedDoc.error || 'Rejected'}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onRemove}
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        </div>
        {uploadedDoc.extractedData && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-xs font-medium text-gray-500 mb-2">Extracted Information:</p>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(uploadedDoc.extractedData).slice(0, 4).map(([key, value]) => (
                <div key={key} className="text-sm">
                  <span className="text-gray-500">{key.replace(/_/g, ' ')}: </span>
                  <span className="font-medium text-gray-900">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer"
      onClick={() => fileInputRef.current?.click()}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        onChange={handleFileSelect}
        className="hidden"
      />
      <div className="flex flex-col items-center">
        <div className="h-12 w-12 bg-primary-100 rounded-full flex items-center justify-center text-primary-600 mb-4">
          {icon}
        </div>
        <p className="font-medium text-gray-900 mb-1">{label}</p>
        <p className="text-sm text-gray-500 mb-4">{description}</p>
        <button className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
          <Upload className="h-4 w-4 inline mr-2" />
          Upload Document
        </button>
        <p className="text-xs text-gray-400 mt-2">or drag and drop</p>
      </div>
    </div>
  );
}

// Selfie Capture Component
function SelfieCapture({
  onCapture,
  capturedImage,
  onRetake,
}: {
  onCapture: (blob: Blob) => void;
  capturedImage?: string;
  onRetake: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [livenessStep, setLivenessStep] = useState<'ready' | 'center' | 'left' | 'right' | 'smile' | 'complete'>('ready');

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsStreaming(true);
        setLivenessStep('center');
      }
    } catch (err) {
      log.error('Error accessing camera:', err);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) {
            onCapture(blob);
            setLivenessStep('complete');
            // Stop the stream
            const stream = videoRef.current?.srcObject as MediaStream;
            stream?.getTracks().forEach(track => track.stop());
            setIsStreaming(false);
          }
        }, 'image/jpeg', 0.9);
      }
    }
  };

  const livenessInstructions: Record<string, string> = {
    ready: 'Click "Start Camera" to begin liveness verification',
    center: 'Position your face in the center of the frame',
    left: 'Slowly turn your head to the left',
    right: 'Slowly turn your head to the right',
    smile: 'Now smile!',
    complete: 'Liveness check complete!',
  };

  if (capturedImage) {
    return (
      <div className="border-2 border-green-300 bg-green-50 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <img src={capturedImage} alt="Selfie" className="h-24 w-24 object-cover rounded-full" />
            <div>
              <p className="font-medium text-gray-900">Selfie Captured</p>
              <p className="text-sm text-green-600 flex items-center">
                <CheckCircle className="h-4 w-4 mr-1" /> Liveness verified
              </p>
            </div>
          </div>
          <button
            onClick={onRetake}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Retake
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-2 border-gray-300 rounded-lg p-6">
      <div className="text-center mb-4">
        <Fingerprint className="h-8 w-8 text-primary-600 mx-auto mb-2" />
        <h3 className="font-medium text-gray-900">Liveness Verification</h3>
        <p className="text-sm text-gray-500">We need to verify you're a real person</p>
      </div>

      {isStreaming ? (
        <div className="space-y-4">
          <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-48 h-48 border-4 border-white rounded-full opacity-50" />
            </div>
          </div>
          <div className="bg-primary-50 rounded-lg p-3 text-center">
            <p className="text-sm font-medium text-primary-800">{livenessInstructions[livenessStep]}</p>
          </div>
          <div className="flex justify-center space-x-4">
            {livenessStep === 'center' && (
              <button
                onClick={() => setLivenessStep('left')}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Continue
              </button>
            )}
            {livenessStep === 'left' && (
              <button
                onClick={() => setLivenessStep('right')}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Continue
              </button>
            )}
            {livenessStep === 'right' && (
              <button
                onClick={() => setLivenessStep('smile')}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Continue
              </button>
            )}
            {livenessStep === 'smile' && (
              <button
                onClick={capturePhoto}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center"
              >
                <Camera className="h-5 w-5 mr-2" />
                Capture Photo
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <div className="h-32 w-32 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
            <Camera className="h-12 w-12 text-gray-400" />
          </div>
          <button
            onClick={startCamera}
            className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <Camera className="h-5 w-5 inline mr-2" />
            Start Camera
          </button>
          <p className="text-xs text-gray-500 mt-4">
            You'll need to allow camera access in your browser
          </p>
        </div>
      )}
    </div>
  );
}

export function ApplicantKYCPortal() {
  const [currentStep, setCurrentStep] = useState(0);
  const [personalInfo, setPersonalInfo] = useState<PersonalInfo>({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    nationality: '',
    email: '',
    phone: '',
    address: '',
  });
  const [identityDoc, setIdentityDoc] = useState<UploadedDocument | null>(null);
  const [addressDoc, setAddressDoc] = useState<UploadedDocument | null>(null);
  const [selfieImage, setSelfieImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleIdentityUpload = (file: File) => {
    const doc: UploadedDocument = {
      id: Date.now().toString(),
      type: 'PASSPORT',
      file,
      preview: URL.createObjectURL(file),
      status: 'uploading',
    };
    setIdentityDoc(doc);

    // Simulate upload and processing
    setTimeout(() => {
      setIdentityDoc(prev => prev ? { ...prev, status: 'processing' } : null);
      setTimeout(() => {
        setIdentityDoc(prev => prev ? {
          ...prev,
          status: 'verified',
          extractedData: {
            full_name: 'JOHN DOE',
            document_number: 'A12345678',
            date_of_birth: '1990-01-15',
            expiry_date: '2028-06-30',
          },
        } : null);
      }, 2000);
    }, 1000);
  };

  const handleAddressUpload = (file: File) => {
    const doc: UploadedDocument = {
      id: Date.now().toString(),
      type: 'PROOF_OF_ADDRESS',
      file,
      preview: URL.createObjectURL(file),
      status: 'uploading',
    };
    setAddressDoc(doc);

    // Simulate upload and processing
    setTimeout(() => {
      setAddressDoc(prev => prev ? { ...prev, status: 'processing' } : null);
      setTimeout(() => {
        setAddressDoc(prev => prev ? {
          ...prev,
          status: 'verified',
          extractedData: {
            name: 'JOHN DOE',
            address: '123 Main Street, Lagos',
            document_date: '2024-12-01',
          },
        } : null);
      }, 2000);
    }, 1000);
  };

  const handleSelfieCapture = (blob: Blob) => {
    setSelfieImage(URL.createObjectURL(blob));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsSubmitting(false);
    setIsSubmitted(true);
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return personalInfo.firstName && personalInfo.lastName && personalInfo.dateOfBirth && personalInfo.nationality && personalInfo.email;
      case 1:
        return identityDoc?.status === 'verified';
      case 2:
        return addressDoc?.status === 'verified';
      case 3:
        return selfieImage !== null;
      case 4:
        return true;
      default:
        return false;
    }
  };

  if (isSubmitted) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <div className="text-center">
          <div className="h-20 w-20 bg-green-100 rounded-full mx-auto mb-6 flex items-center justify-center">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">KYC Submitted Successfully!</h1>
          <p className="text-gray-600 mb-8">
            Your identity verification documents have been submitted. We'll review them and notify you within 24-48 hours.
          </p>
          <div className="bg-gray-50 rounded-lg p-6 text-left">
            <h3 className="font-medium text-gray-900 mb-4">What happens next?</h3>
            <ul className="space-y-3">
              <li className="flex items-start">
                <CheckCircle className="h-5 w-5 text-green-500 mr-3 mt-0.5" />
                <span className="text-sm text-gray-600">Our AI system will verify your documents</span>
              </li>
              <li className="flex items-start">
                <Clock className="h-5 w-5 text-blue-500 mr-3 mt-0.5" />
                <span className="text-sm text-gray-600">A compliance officer will review your application</span>
              </li>
              <li className="flex items-start">
                <Shield className="h-5 w-5 text-purple-500 mr-3 mt-0.5" />
                <span className="text-sm text-gray-600">We'll run background screening checks</span>
              </li>
              <li className="flex items-start">
                <AlertCircle className="h-5 w-5 text-yellow-500 mr-3 mt-0.5" />
                <span className="text-sm text-gray-600">You'll receive an email with the verification result</span>
              </li>
            </ul>
          </div>
          <p className="text-sm text-gray-500 mt-6">
            Reference ID: <span className="font-mono font-medium">KYC-{Date.now().toString(36).toUpperCase()}</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Identity Verification</h1>
        <p className="text-gray-600 mt-2">Complete your KYC verification to access the payment platform</p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const status: StepStatus = index < currentStep ? 'completed' : index === currentStep ? 'current' : 'pending';
            return (
              <React.Fragment key={step.id}>
                <div className="flex flex-col items-center">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                    status === 'completed' ? 'bg-green-600 text-white' :
                    status === 'current' ? 'bg-primary-600 text-white' :
                    'bg-gray-200 text-gray-500'
                  }`}>
                    {status === 'completed' ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  </div>
                  <span className={`text-xs mt-2 ${
                    status === 'current' ? 'text-primary-600 font-medium' : 'text-gray-500'
                  }`}>
                    {step.label}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div className={`flex-1 h-1 mx-2 ${
                    index < currentStep ? 'bg-green-600' : 'bg-gray-200'
                  }`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        {currentStep === 0 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900">Personal Information</h2>
            <p className="text-sm text-gray-500">Please provide your personal details as they appear on your ID document.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                <input
                  type="text"
                  value={personalInfo.firstName}
                  onChange={(e) => setPersonalInfo({ ...personalInfo, firstName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="John"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                <input
                  type="text"
                  value={personalInfo.lastName}
                  onChange={(e) => setPersonalInfo({ ...personalInfo, lastName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth *</label>
                <input
                  type="date"
                  value={personalInfo.dateOfBirth}
                  onChange={(e) => setPersonalInfo({ ...personalInfo, dateOfBirth: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nationality *</label>
                <select
                  value={personalInfo.nationality}
                  onChange={(e) => setPersonalInfo({ ...personalInfo, nationality: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">Select nationality</option>
                  <option value="Nigerian">Nigerian</option>
                  <option value="Kenyan">Kenyan</option>
                  <option value="Ghanaian">Ghanaian</option>
                  <option value="South African">South African</option>
                  <option value="Ugandan">Ugandan</option>
                  <option value="Tanzanian">Tanzanian</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                <input
                  type="email"
                  value={personalInfo.email}
                  onChange={(e) => setPersonalInfo({ ...personalInfo, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="john@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={personalInfo.phone}
                  onChange={(e) => setPersonalInfo({ ...personalInfo, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="+234 800 000 0000"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Residential Address</label>
                <textarea
                  value={personalInfo.address}
                  onChange={(e) => setPersonalInfo({ ...personalInfo, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  rows={2}
                  placeholder="123 Main Street, Lagos, Nigeria"
                />
              </div>
            </div>
          </div>
        )}

        {currentStep === 1 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900">Identity Document</h2>
            <p className="text-sm text-gray-500">Upload a valid government-issued ID document (passport, national ID, or driver's license).</p>
            
            <div className="grid grid-cols-3 gap-4 mb-6">
              {(['PASSPORT', 'NATIONAL_ID', 'DRIVERS_LICENSE'] as DocumentType[]).map((type) => (
                <button
                  key={type}
                  className={`p-4 border-2 rounded-lg text-center transition-colors ${
                    identityDoc?.type === type ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setIdentityDoc(prev => prev ? { ...prev, type } : null)}
                >
                  <div className="flex justify-center mb-2">
                    {documentTypeLabels[type].icon}
                  </div>
                  <span className="text-sm font-medium">{documentTypeLabels[type].label}</span>
                </button>
              ))}
            </div>

            <FileUpload
              documentType={identityDoc?.type || 'PASSPORT'}
              onUpload={handleIdentityUpload}
              uploadedDoc={identityDoc || undefined}
              onRemove={() => setIdentityDoc(null)}
            />

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mr-3 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <p className="font-medium">Document Requirements:</p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Document must be valid and not expired</li>
                    <li>All text must be clearly visible</li>
                    <li>Photo must be in color (no black & white)</li>
                    <li>No glare, blur, or obstructions</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900">Proof of Address</h2>
            <p className="text-sm text-gray-500">Upload a document that shows your name and current residential address (issued within the last 3 months).</p>

            <FileUpload
              documentType="PROOF_OF_ADDRESS"
              onUpload={handleAddressUpload}
              uploadedDoc={addressDoc || undefined}
              onRemove={() => setAddressDoc(null)}
            />

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 text-blue-600 mr-3 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium">Accepted Documents:</p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Utility bill (electricity, water, gas)</li>
                    <li>Bank statement</li>
                    <li>Government-issued letter</li>
                    <li>Tenancy agreement</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900">Selfie & Liveness Check</h2>
            <p className="text-sm text-gray-500">Take a selfie to verify your identity. You'll need to follow some simple instructions to prove you're a real person.</p>

            <SelfieCapture
              onCapture={handleSelfieCapture}
              capturedImage={selfieImage || undefined}
              onRetake={() => setSelfieImage(null)}
            />

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-start">
                <Fingerprint className="h-5 w-5 text-purple-600 mr-3 mt-0.5" />
                <div className="text-sm text-purple-800">
                  <p className="font-medium">Why do we need this?</p>
                  <p className="mt-1">
                    Liveness verification ensures that you are physically present and prevents fraud. 
                    Your selfie will be matched against your ID document photo.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900">Review & Submit</h2>
            <p className="text-sm text-gray-500">Please review your information before submitting.</p>

            <div className="space-y-4">
              {/* Personal Info Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-3 flex items-center">
                  <User className="h-5 w-5 mr-2 text-primary-600" />
                  Personal Information
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Name: </span>
                    <span className="font-medium">{personalInfo.firstName} {personalInfo.lastName}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Date of Birth: </span>
                    <span className="font-medium">{personalInfo.dateOfBirth}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Nationality: </span>
                    <span className="font-medium">{personalInfo.nationality}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Email: </span>
                    <span className="font-medium">{personalInfo.email}</span>
                  </div>
                </div>
              </div>

              {/* Documents Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-3 flex items-center">
                  <FileText className="h-5 w-5 mr-2 text-primary-600" />
                  Documents
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Identity Document</span>
                    {identityDoc?.status === 'verified' ? (
                      <span className="text-green-600 flex items-center">
                        <CheckCircle className="h-4 w-4 mr-1" /> Verified
                      </span>
                    ) : (
                      <span className="text-yellow-600 flex items-center">
                        <Clock className="h-4 w-4 mr-1" /> Pending
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Proof of Address</span>
                    {addressDoc?.status === 'verified' ? (
                      <span className="text-green-600 flex items-center">
                        <CheckCircle className="h-4 w-4 mr-1" /> Verified
                      </span>
                    ) : (
                      <span className="text-yellow-600 flex items-center">
                        <Clock className="h-4 w-4 mr-1" /> Pending
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Selfie & Liveness</span>
                    {selfieImage ? (
                      <span className="text-green-600 flex items-center">
                        <CheckCircle className="h-4 w-4 mr-1" /> Completed
                      </span>
                    ) : (
                      <span className="text-yellow-600 flex items-center">
                        <Clock className="h-4 w-4 mr-1" /> Pending
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Consent */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <label className="flex items-start">
                  <input type="checkbox" className="mt-1 mr-3" defaultChecked />
                  <span className="text-sm text-blue-800">
                    I confirm that all information provided is accurate and I consent to the processing of my personal data for identity verification purposes in accordance with the privacy policy.
                  </span>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
          disabled={currentStep === 0}
          className={`px-4 py-2 border border-gray-300 rounded-lg flex items-center ${
            currentStep === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'
          }`}
        >
          <ChevronLeft className="h-5 w-5 mr-1" />
          Back
        </button>

        {currentStep < steps.length - 1 ? (
          <button
            onClick={() => setCurrentStep(currentStep + 1)}
            disabled={!canProceed()}
            className={`px-6 py-2 bg-primary-600 text-white rounded-lg flex items-center ${
              !canProceed() ? 'opacity-50 cursor-not-allowed' : 'hover:bg-primary-700'
            }`}
          >
            Continue
            <ChevronRight className="h-5 w-5 ml-1" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-6 py-2 bg-green-600 text-white rounded-lg flex items-center hover:bg-green-700"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <CheckCircle className="h-5 w-5 mr-2" />
                Submit KYC
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

export default ApplicantKYCPortal;
