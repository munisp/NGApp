'use client';

import React, { useState } from 'react';
import {
  Building2,
  FileText,
  CheckCircle,
  Upload,
  ChevronRight,
  ChevronLeft,
  Globe,
  CreditCard,
  Shield,
  Server,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { createLogger } from '@/lib/logger';
const log = createLogger('ApplicantPortal');

// Types
interface ApplicationData {
  // Step 1: Organization Info
  organizationName: string;
  stakeholderType: string;
  registrationNumber: string;
  taxId: string;
  country: string;
  address: string;
  website: string;
  description: string;
  // Step 2: Contact Info
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  contactTitle: string;
  // Step 3: Documents
  documents: File[];
  // Step 4: Technical Profile
  apiEndpoint: string;
  callbackUrl: string;
  ipWhitelist: string;
  preferredEnvironment: string;
}

const stakeholderTypes = [
  { id: 'BANK', name: 'Bank', icon: <Building2 className="h-6 w-6" />, description: 'Commercial or central bank' },
  { id: 'MOBILE_MONEY_OPERATOR', name: 'Mobile Money Operator', icon: <CreditCard className="h-6 w-6" />, description: 'Mobile money service provider' },
  { id: 'FINTECH', name: 'Fintech', icon: <Globe className="h-6 w-6" />, description: 'Financial technology company' },
  { id: 'MICROFINANCE_INSTITUTION', name: 'Microfinance Institution', icon: <Building2 className="h-6 w-6" />, description: 'Microfinance or credit union' },
  { id: 'GOVERNMENT_AGENCY', name: 'Government Agency', icon: <Shield className="h-6 w-6" />, description: 'Government or regulatory body' },
  { id: 'MERCHANT', name: 'Merchant', icon: <CreditCard className="h-6 w-6" />, description: 'Business accepting payments' },
  { id: 'REGULATOR', name: 'Regulator', icon: <Shield className="h-6 w-6" />, description: 'Financial regulator' },
  { id: 'NOC_OPERATOR', name: 'NOC Operator', icon: <Server className="h-6 w-6" />, description: 'Network operations center' },
  { id: 'DEVELOPER', name: 'Developer', icon: <Server className="h-6 w-6" />, description: 'API developer or integrator' },
];

const countries = [
  'Nigeria', 'Kenya', 'Ghana', 'South Africa', 'Tanzania', 'Uganda', 'Rwanda', 'Ethiopia', 'Senegal', 'Ivory Coast',
];

const requiredDocuments: Record<string, string[]> = {
  BANK: ['Certificate of Incorporation', 'Banking License', 'AML/CFT Policy', 'Board Resolution', 'Financial Statements (3 years)', 'IT Security Assessment'],
  MOBILE_MONEY_OPERATOR: ['Certificate of Incorporation', 'Mobile Money License', 'AML/CFT Policy', 'Board Resolution', 'Financial Statements (2 years)'],
  FINTECH: ['Certificate of Incorporation', 'Operating License', 'AML/CFT Policy', 'Financial Statements (2 years)', 'Data Protection Policy'],
  MICROFINANCE_INSTITUTION: ['Certificate of Incorporation', 'MFI License', 'AML/CFT Policy', 'Financial Statements (2 years)'],
  GOVERNMENT_AGENCY: ['Authorization Letter', 'Government ID', 'Data Protection Policy'],
  MERCHANT: ['Business Registration', 'Tax Certificate', 'Bank Statement (6 months)'],
  REGULATOR: ['Authorization Letter', 'Government ID'],
  NOC_OPERATOR: ['Certificate of Incorporation', 'Service Agreement', 'Security Clearance'],
  DEVELOPER: ['Business Registration', 'API Use Case Document'],
};

const API_BASE = process.env.NEXT_PUBLIC_ONBOARDING_API || 'http://localhost:8082';

export function ApplicantPortal() {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [formData, setFormData] = useState<ApplicationData>({
    organizationName: '',
    stakeholderType: '',
    registrationNumber: '',
    taxId: '',
    country: '',
    address: '',
    website: '',
    description: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    contactTitle: '',
    documents: [],
    apiEndpoint: '',
    callbackUrl: '',
    ipWhitelist: '',
    preferredEnvironment: 'sandbox',
  });

  const updateFormData = (field: keyof ApplicationData, value: string | File[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!formData.organizationName) newErrors.organizationName = 'Organization name is required';
      if (!formData.stakeholderType) newErrors.stakeholderType = 'Please select a stakeholder type';
      if (!formData.registrationNumber) newErrors.registrationNumber = 'Registration number is required';
      if (!formData.country) newErrors.country = 'Country is required';
      if (!formData.address) newErrors.address = 'Address is required';
    }

    if (step === 2) {
      if (!formData.contactName) newErrors.contactName = 'Contact name is required';
      if (!formData.contactEmail) newErrors.contactEmail = 'Contact email is required';
      if (formData.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contactEmail)) {
        newErrors.contactEmail = 'Please enter a valid email address';
      }
      if (!formData.contactPhone) newErrors.contactPhone = 'Contact phone is required';
      if (!formData.contactTitle) newErrors.contactTitle = 'Contact title is required';
    }

    if (step === 4) {
      if (!formData.apiEndpoint) newErrors.apiEndpoint = 'API endpoint is required';
      if (formData.apiEndpoint && !formData.apiEndpoint.startsWith('https://')) {
        newErrors.apiEndpoint = 'API endpoint must use HTTPS';
      }
      if (!formData.callbackUrl) newErrors.callbackUrl = 'Callback URL is required';
      if (formData.callbackUrl && !formData.callbackUrl.startsWith('https://')) {
        newErrors.callbackUrl = 'Callback URL must use HTTPS';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 5));
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      updateFormData('documents', [...formData.documents, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    const newFiles = formData.documents.filter((_, i) => i !== index);
    updateFormData('documents', newFiles);
  };

  const handleSubmit = async () => {
    if (!validateStep(4)) return;

    setIsSubmitting(true);
    try {
      // Create case
      const caseResponse = await fetch(`${API_BASE}/api/v1/onboarding/cases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stakeholder_type: formData.stakeholderType,
          organization_name: formData.organizationName,
          country: formData.country,
          contact_email: formData.contactEmail,
        }),
      });

      if (!caseResponse.ok) {
        throw new Error('Failed to create application');
      }

      const caseData = await caseResponse.json();
      const newCaseId = caseData.id;

      // Set technical profile
      await fetch(`${API_BASE}/api/v1/onboarding/cases/${newCaseId}/technical-profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_endpoint: formData.apiEndpoint,
          callback_url: formData.callbackUrl,
          ip_whitelist: formData.ipWhitelist.split(',').map((ip) => ip.trim()).filter(Boolean),
          preferred_environment: formData.preferredEnvironment,
        }),
      });

      // Submit case
      await fetch(`${API_BASE}/api/v1/onboarding/cases/${newCaseId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      setCaseId(newCaseId);
      setIsSubmitted(true);
      setCurrentStep(5);
    } catch (error) {
      log.error('Submission error:', error);
      setErrors({ submit: 'Failed to submit application. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps = [
    { number: 1, title: 'Organization', description: 'Basic information' },
    { number: 2, title: 'Contact', description: 'Primary contact' },
    { number: 3, title: 'Documents', description: 'Required documents' },
    { number: 4, title: 'Technical', description: 'API configuration' },
    { number: 5, title: 'Review', description: 'Submit application' },
  ];

  if (isSubmitted) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Application Submitted</h2>
          <p className="text-gray-600 mb-6">
            Your application has been submitted successfully. Our team will review your application and contact you within 3-5 business days.
          </p>
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-500">Application Reference</p>
            <p className="text-lg font-mono font-bold text-gray-900">{caseId}</p>
          </div>
          <p className="text-sm text-gray-500">
            A confirmation email has been sent to <strong>{formData.contactEmail}</strong>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <React.Fragment key={step.number}>
              <div className="flex flex-col items-center">
                <div
                  className={`h-10 w-10 rounded-full flex items-center justify-center font-medium ${
                    currentStep > step.number
                      ? 'bg-green-600 text-white'
                      : currentStep === step.number
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {currentStep > step.number ? <CheckCircle className="h-5 w-5" /> : step.number}
                </div>
                <div className="mt-2 text-center">
                  <p className={`text-sm font-medium ${currentStep >= step.number ? 'text-gray-900' : 'text-gray-500'}`}>
                    {step.title}
                  </p>
                  <p className="text-xs text-gray-500 hidden sm:block">{step.description}</p>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-1 mx-4 ${currentStep > step.number ? 'bg-green-600' : 'bg-gray-200'}`} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Form Content */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {/* Step 1: Organization Info */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Organization Information</h2>
              <p className="text-sm text-gray-500">Tell us about your organization</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Stakeholder Type *</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {stakeholderTypes.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => updateFormData('stakeholderType', type.id)}
                    className={`p-4 rounded-lg border-2 text-left transition-colors ${
                      formData.stakeholderType === type.id
                        ? 'border-primary-600 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className={`mb-2 ${formData.stakeholderType === type.id ? 'text-primary-600' : 'text-gray-400'}`}>
                      {type.icon}
                    </div>
                    <p className="font-medium text-gray-900">{type.name}</p>
                    <p className="text-xs text-gray-500">{type.description}</p>
                  </button>
                ))}
              </div>
              {errors.stakeholderType && <p className="mt-1 text-sm text-red-600">{errors.stakeholderType}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Organization Name *</label>
                <input
                  type="text"
                  value={formData.organizationName}
                  onChange={(e) => updateFormData('organizationName', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg text-sm ${errors.organizationName ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="Enter organization name"
                />
                {errors.organizationName && <p className="mt-1 text-sm text-red-600">{errors.organizationName}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Registration Number *</label>
                <input
                  type="text"
                  value={formData.registrationNumber}
                  onChange={(e) => updateFormData('registrationNumber', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg text-sm ${errors.registrationNumber ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="e.g., RC-123456"
                />
                {errors.registrationNumber && <p className="mt-1 text-sm text-red-600">{errors.registrationNumber}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tax ID</label>
                <input
                  type="text"
                  value={formData.taxId}
                  onChange={(e) => updateFormData('taxId', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="e.g., TIN-987654321"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Country *</label>
                <select
                  value={formData.country}
                  onChange={(e) => updateFormData('country', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg text-sm ${errors.country ? 'border-red-500' : 'border-gray-300'}`}
                >
                  <option value="">Select country</option>
                  {countries.map((country) => (
                    <option key={country} value={country}>{country}</option>
                  ))}
                </select>
                {errors.country && <p className="mt-1 text-sm text-red-600">{errors.country}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => updateFormData('address', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg text-sm ${errors.address ? 'border-red-500' : 'border-gray-300'}`}
                placeholder="Enter full address"
              />
              {errors.address && <p className="mt-1 text-sm text-red-600">{errors.address}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => updateFormData('website', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="https://www.example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => updateFormData('description', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                rows={3}
                placeholder="Brief description of your organization"
              />
            </div>
          </div>
        )}

        {/* Step 2: Contact Info */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Primary Contact</h2>
              <p className="text-sm text-gray-500">Who should we contact about this application?</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  value={formData.contactName}
                  onChange={(e) => updateFormData('contactName', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg text-sm ${errors.contactName ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="Enter full name"
                />
                {errors.contactName && <p className="mt-1 text-sm text-red-600">{errors.contactName}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Job Title *</label>
                <input
                  type="text"
                  value={formData.contactTitle}
                  onChange={(e) => updateFormData('contactTitle', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg text-sm ${errors.contactTitle ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="e.g., Head of Integration"
                />
                {errors.contactTitle && <p className="mt-1 text-sm text-red-600">{errors.contactTitle}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                <input
                  type="email"
                  value={formData.contactEmail}
                  onChange={(e) => updateFormData('contactEmail', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg text-sm ${errors.contactEmail ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="email@example.com"
                />
                {errors.contactEmail && <p className="mt-1 text-sm text-red-600">{errors.contactEmail}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                <input
                  type="tel"
                  value={formData.contactPhone}
                  onChange={(e) => updateFormData('contactPhone', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg text-sm ${errors.contactPhone ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="+234 1 234 5678"
                />
                {errors.contactPhone && <p className="mt-1 text-sm text-red-600">{errors.contactPhone}</p>}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Documents */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Required Documents</h2>
              <p className="text-sm text-gray-500">Upload the required documents for your application</p>
            </div>

            {formData.stakeholderType && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 mb-2">Required for {stakeholderTypes.find((t) => t.id === formData.stakeholderType)?.name}</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  {requiredDocuments[formData.stakeholderType]?.map((doc, idx) => (
                    <li key={idx} className="flex items-center">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-600 mr-2" />
                      {doc}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Upload Documents</label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <Upload className="h-10 w-10 text-gray-400 mx-auto mb-4" />
                <p className="text-sm text-gray-600 mb-2">Drag and drop files here, or click to browse</p>
                <p className="text-xs text-gray-500 mb-4">PDF, DOC, DOCX, XLS, XLSX up to 10MB each</p>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 cursor-pointer"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Browse Files
                </label>
              </div>
            </div>

            {formData.documents.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Uploaded Files ({formData.documents.length})</h3>
                <div className="space-y-2">
                  {formData.documents.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center">
                        <FileText className="h-5 w-5 text-gray-400 mr-3" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{file.name}</p>
                          <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeFile(idx)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Technical Profile */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Technical Configuration</h2>
              <p className="text-sm text-gray-500">Configure your API integration settings</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">API Endpoint *</label>
              <input
                type="url"
                value={formData.apiEndpoint}
                onChange={(e) => updateFormData('apiEndpoint', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg text-sm font-mono ${errors.apiEndpoint ? 'border-red-500' : 'border-gray-300'}`}
                placeholder="https://api.yourcompany.com/payment-switch"
              />
              {errors.apiEndpoint && <p className="mt-1 text-sm text-red-600">{errors.apiEndpoint}</p>}
              <p className="mt-1 text-xs text-gray-500">The endpoint where we will send payment requests</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Callback URL *</label>
              <input
                type="url"
                value={formData.callbackUrl}
                onChange={(e) => updateFormData('callbackUrl', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg text-sm font-mono ${errors.callbackUrl ? 'border-red-500' : 'border-gray-300'}`}
                placeholder="https://api.yourcompany.com/callbacks/payment-switch"
              />
              {errors.callbackUrl && <p className="mt-1 text-sm text-red-600">{errors.callbackUrl}</p>}
              <p className="mt-1 text-xs text-gray-500">The endpoint where we will send async notifications</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">IP Whitelist</label>
              <input
                type="text"
                value={formData.ipWhitelist}
                onChange={(e) => updateFormData('ipWhitelist', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                placeholder="192.168.1.0/24, 10.0.0.0/8"
              />
              <p className="mt-1 text-xs text-gray-500">Comma-separated list of IP addresses or CIDR ranges</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Preferred Environment</label>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="environment"
                    value="sandbox"
                    checked={formData.preferredEnvironment === 'sandbox'}
                    onChange={(e) => updateFormData('preferredEnvironment', e.target.value)}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Sandbox (Testing)</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="environment"
                    value="production"
                    checked={formData.preferredEnvironment === 'production'}
                    onChange={(e) => updateFormData('preferredEnvironment', e.target.value)}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Production</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Review */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Review & Submit</h2>
              <p className="text-sm text-gray-500">Please review your application before submitting</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-3">Organization</h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Name</dt>
                    <dd className="font-medium text-gray-900">{formData.organizationName}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Type</dt>
                    <dd className="font-medium text-gray-900">{stakeholderTypes.find((t) => t.id === formData.stakeholderType)?.name}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Country</dt>
                    <dd className="font-medium text-gray-900">{formData.country}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Registration</dt>
                    <dd className="font-medium text-gray-900">{formData.registrationNumber}</dd>
                  </div>
                </dl>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-3">Contact</h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Name</dt>
                    <dd className="font-medium text-gray-900">{formData.contactName}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Title</dt>
                    <dd className="font-medium text-gray-900">{formData.contactTitle}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Email</dt>
                    <dd className="font-medium text-gray-900">{formData.contactEmail}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Phone</dt>
                    <dd className="font-medium text-gray-900">{formData.contactPhone}</dd>
                  </div>
                </dl>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-3">Documents</h3>
                <p className="text-sm text-gray-600">{formData.documents.length} files uploaded</p>
                {formData.documents.length === 0 && (
                  <p className="text-sm text-yellow-600 flex items-center mt-2">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    No documents uploaded
                  </p>
                )}
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-3">Technical</h3>
                <dl className="space-y-2 text-sm">
                  <div>
                    <dt className="text-gray-500">API Endpoint</dt>
                    <dd className="font-mono text-xs text-gray-900 break-all">{formData.apiEndpoint}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Callback URL</dt>
                    <dd className="font-mono text-xs text-gray-900 break-all">{formData.callbackUrl}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Environment</dt>
                    <dd className="font-medium text-gray-900 capitalize">{formData.preferredEnvironment}</dd>
                  </div>
                </dl>
              </div>
            </div>

            {errors.submit && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center">
                <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                <p className="text-sm text-red-600">{errors.submit}</p>
              </div>
            )}

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                By submitting this application, you confirm that all information provided is accurate and complete. 
                Our team will review your application and contact you within 3-5 business days.
              </p>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
          <button
            onClick={handleBack}
            disabled={currentStep === 1}
            className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium ${
              currentStep === 1
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </button>

          {currentStep < 5 ? (
            <button
              onClick={handleNext}
              className="flex items-center px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Submit Application
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
