import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Globe, Building2, Server, Landmark, Users, CheckCircle2, ArrowRight,
  FileText, Upload, Shield, Clock, ChevronRight, ArrowLeft, Loader2,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

// --- Types ---
type ApplicantType = 'participant' | 'provider' | 'regulator' | 'ops' | null;
type ApplicationStep = 'select_type' | 'fill_form' | 'upload_docs' | 'review' | 'submitted';

interface ApplicationData {
  type: ApplicantType;
  companyName: string;
  registrationNumber: string;
  licenseNumber: string;
  licenseType: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  country: string;
  address: string;
  corridors: string[];
  capitalAmount: string;
  complianceOfficer: string;
  website: string;
  additionalInfo: string;
}

const stakeholderInfo = [
  {
    id: 'participant' as ApplicantType,
    title: 'Regulated Participant (Fintech/IMTO)',
    icon: Building2,
    description: 'Licensed fintech or IMTO applying to send outbound transfers via the national switch',
    timeline: '4-6 weeks',
    requirements: [
      'CBN License (IMTO/PSP/MFB)',
      'Minimum capital ₦2B',
      'AML/CFT compliance program',
      'Technical readiness (API integration)',
      'KYC/CDD procedures documentation',
    ],
  },
  {
    id: 'provider' as ApplicantType,
    title: 'External Provider (Payout Rail)',
    icon: Server,
    description: 'International payout provider seeking to be listed as a settlement rail on the switch',
    timeline: '6-8 weeks',
    requirements: [
      'License in destination country',
      'API documentation for disbursement',
      'Settlement agreement & bank details',
      'SLA commitment (latency, uptime)',
      'Compliance certification',
    ],
  },
  {
    id: 'regulator' as ApplicantType,
    title: 'Regulator (CBN/NFIU)',
    icon: Landmark,
    description: 'Regulatory body requiring oversight access to switch operations',
    timeline: '2-3 weeks',
    requirements: [
      'Official regulatory mandate',
      'Designated oversight officers',
      'Secure VPN access request',
      'Data classification agreement',
    ],
  },
  {
    id: 'ops' as ApplicantType,
    title: 'Operations Staff',
    icon: Users,
    description: 'Internal switch operators managing day-to-day platform operations',
    timeline: '1-2 weeks',
    requirements: [
      'Employment verification',
      'Background check clearance',
      'Role assignment (L1/L2/L3)',
      'Security training completion',
    ],
  },
];

export default function OutboundApply() {
  const [step, setStep] = useState<ApplicationStep>('select_type');
  const [formData, setFormData] = useState<ApplicationData>({
    type: null,
    companyName: '',
    registrationNumber: '',
    licenseNumber: '',
    licenseType: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    country: 'Nigeria',
    address: '',
    corridors: [],
    capitalAmount: '',
    complianceOfficer: '',
    website: '',
    additionalInfo: '',
  });
  const [uploadedDocs, setUploadedDocs] = useState<string[]>([]);
  const [applicationRef, setApplicationRef] = useState('');

  const selectedStakeholder = stakeholderInfo.find(s => s.id === formData.type);

  function handleSelectType(type: ApplicantType) {
    setFormData(prev => ({ ...prev, type }));
    setStep('fill_form');
  }

  function handleSubmitForm() {
    setStep('upload_docs');
  }

  function handleUploadComplete() {
    setStep('review');
  }

  const [submitting, setSubmitting] = useState(false);

  const submitApplication = trpc.outboundRemittance.submitApplication.useMutation({
    onSuccess: (data) => {
      setApplicationRef(data.applicationRef);
      setStep('submitted');
      toast.success(`Application ${data.applicationRef} submitted successfully!`);
    },
    onError: (err) => {
      setSubmitting(false);
      toast.error(err.message);
    },
  });

  function handleFinalSubmit() {
    if (!formData.type) return;
    setSubmitting(true);
    submitApplication.mutate({
      type: formData.type,
      companyName: formData.companyName,
      registrationNumber: formData.registrationNumber,
      licenseNumber: formData.licenseNumber || undefined,
      licenseType: formData.licenseType || undefined,
      contactName: formData.contactName,
      contactEmail: formData.contactEmail,
      contactPhone: formData.contactPhone,
      country: formData.country,
      address: formData.address,
      corridors: formData.corridors.length > 0 ? formData.corridors : undefined,
      capitalAmount: formData.capitalAmount || undefined,
      complianceOfficer: formData.complianceOfficer || undefined,
      documents: uploadedDocs.map(name => ({ name, type: 'application/pdf', size: 0 })),
    });
  }

  // --- Step: Select Type ---
  if (step === 'select_type') {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b bg-card">
          <div className="max-w-5xl mx-auto px-6 py-4">
            <div className="flex items-center gap-3">
              <Globe className="h-6 w-6 text-blue-600" />
              <div>
                <h1 className="font-semibold text-lg">National Outbound Remittance Platform</h1>
                <p className="text-sm text-muted-foreground">Apply for Switch Access</p>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-6 py-8">
          <div className="mb-8">
            <h2 className="text-2xl font-bold">Apply for Platform Access</h2>
            <p className="text-muted-foreground mt-1">
              Select your organization type to begin the application process. No account is required to apply.
            </p>
          </div>

          {/* Progress indicator */}
          <div className="flex items-center gap-2 mb-8 text-sm text-muted-foreground">
            <span className="flex items-center gap-1 text-blue-600 font-medium">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">1</span>
              Select Type
            </span>
            <ChevronRight className="h-4 w-4" />
            <span className="flex items-center gap-1">
              <span className="w-6 h-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs">2</span>
              Details
            </span>
            <ChevronRight className="h-4 w-4" />
            <span className="flex items-center gap-1">
              <span className="w-6 h-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs">3</span>
              Documents
            </span>
            <ChevronRight className="h-4 w-4" />
            <span className="flex items-center gap-1">
              <span className="w-6 h-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs">4</span>
              Review & Submit
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stakeholderInfo.map((s) => {
              const Icon = s.icon;
              return (
                <Card
                  key={s.id}
                  className="cursor-pointer hover:border-blue-300 hover:shadow-md transition-all"
                  onClick={() => handleSelectType(s.id)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-blue-50">
                        <Icon className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-base">{s.title}</CardTitle>
                        <CardDescription className="mt-1">{s.description}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="text-xs">
                        <Clock className="h-3 w-3 mr-1" />{s.timeline}
                      </Badge>
                      <Button variant="ghost" size="sm" className="text-blue-600">
                        Apply <ArrowRight className="h-3 w-3 ml-1" />
                      </Button>
                    </div>
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-xs text-muted-foreground font-medium mb-2">Requirements:</p>
                      <ul className="space-y-1">
                        {s.requirements.slice(0, 3).map((r, i) => (
                          <li key={i} className="text-xs text-muted-foreground flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />{r}
                          </li>
                        ))}
                        {s.requirements.length > 3 && (
                          <li className="text-xs text-muted-foreground">
                            +{s.requirements.length - 3} more...
                          </li>
                        )}
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card className="mt-8 bg-muted/30">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Already have an account?</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    If you already have platform credentials, <a href="/outbound-remittance" className="text-blue-600 underline">sign in to your operations dashboard</a> to track your onboarding progress.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // --- Step: Fill Form ---
  if (step === 'fill_form') {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="max-w-4xl mx-auto px-6 py-4">
            <div className="flex items-center gap-3">
              <Globe className="h-6 w-6 text-blue-600" />
              <div>
                <h1 className="font-semibold text-lg">National Outbound Remittance Platform</h1>
                <p className="text-sm text-muted-foreground">Application — {selectedStakeholder?.title}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-6 py-8">
          <Button variant="ghost" size="sm" onClick={() => setStep('select_type')} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>

          {/* Progress */}
          <div className="flex items-center gap-2 mb-8 text-sm text-muted-foreground">
            <span className="flex items-center gap-1 text-green-600">
              <CheckCircle2 className="h-4 w-4" /> Select Type
            </span>
            <ChevronRight className="h-4 w-4" />
            <span className="flex items-center gap-1 text-blue-600 font-medium">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">2</span>
              Details
            </span>
            <ChevronRight className="h-4 w-4" />
            <span className="flex items-center gap-1">
              <span className="w-6 h-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs">3</span>
              Documents
            </span>
            <ChevronRight className="h-4 w-4" />
            <span className="flex items-center gap-1">
              <span className="w-6 h-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs">4</span>
              Review & Submit
            </span>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Organization Details</CardTitle>
              <CardDescription>Provide your organization's information for the application</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Company Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold border-b pb-2">Company Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Company Name *</Label>
                    <Input
                      id="companyName"
                      value={formData.companyName}
                      onChange={e => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                      placeholder="e.g. PayApp Nigeria Ltd"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="regNumber">Registration Number (RC) *</Label>
                    <Input
                      id="regNumber"
                      value={formData.registrationNumber}
                      onChange={e => setFormData(prev => ({ ...prev, registrationNumber: e.target.value }))}
                      placeholder="e.g. RC-1234567"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="licenseType">License Type *</Label>
                    <Select
                      value={formData.licenseType}
                      onValueChange={v => setFormData(prev => ({ ...prev, licenseType: v }))}
                    >
                      <SelectTrigger id="licenseType">
                        <SelectValue placeholder="Select license type" />
                      </SelectTrigger>
                      <SelectContent>
                        {formData.type === 'participant' && (
                          <>
                            <SelectItem value="IMTO">IMTO License</SelectItem>
                            <SelectItem value="PSP">PSP License</SelectItem>
                            <SelectItem value="MFB">MFB License</SelectItem>
                            <SelectItem value="DMB">DMB License</SelectItem>
                          </>
                        )}
                        {formData.type === 'provider' && (
                          <>
                            <SelectItem value="FCA">FCA (UK)</SelectItem>
                            <SelectItem value="MAS">MAS (Singapore)</SelectItem>
                            <SelectItem value="FinCEN">FinCEN MSB (USA)</SelectItem>
                            <SelectItem value="AUSTRAC">AUSTRAC (Australia)</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </>
                        )}
                        {formData.type === 'regulator' && (
                          <>
                            <SelectItem value="CBN">CBN</SelectItem>
                            <SelectItem value="NFIU">NFIU</SelectItem>
                            <SelectItem value="SEC">SEC</SelectItem>
                            <SelectItem value="EFCC">EFCC</SelectItem>
                          </>
                        )}
                        {formData.type === 'ops' && (
                          <>
                            <SelectItem value="L1">L1 — Support</SelectItem>
                            <SelectItem value="L2">L2 — Operations</SelectItem>
                            <SelectItem value="L3">L3 — Engineering</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="licenseNumber">License Number *</Label>
                    <Input
                      id="licenseNumber"
                      value={formData.licenseNumber}
                      onChange={e => setFormData(prev => ({ ...prev, licenseNumber: e.target.value }))}
                      placeholder="e.g. CBN/IMTO/2024/012"
                    />
                  </div>
                </div>
                {formData.type === 'participant' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="capitalAmount">Paid-up Capital (NGN) *</Label>
                      <Input
                        id="capitalAmount"
                        value={formData.capitalAmount}
                        onChange={e => setFormData(prev => ({ ...prev, capitalAmount: e.target.value }))}
                        placeholder="e.g. 2,000,000,000"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="website">Company Website</Label>
                      <Input
                        id="website"
                        value={formData.website}
                        onChange={e => setFormData(prev => ({ ...prev, website: e.target.value }))}
                        placeholder="https://"
                      />
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="address">Registered Address *</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Full registered address"
                  />
                </div>
              </div>

              {/* Contact Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold border-b pb-2">Primary Contact</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contactName">Full Name *</Label>
                    <Input
                      id="contactName"
                      value={formData.contactName}
                      onChange={e => setFormData(prev => ({ ...prev, contactName: e.target.value }))}
                      placeholder="Full name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contactEmail">Email *</Label>
                    <Input
                      id="contactEmail"
                      type="email"
                      value={formData.contactEmail}
                      onChange={e => setFormData(prev => ({ ...prev, contactEmail: e.target.value }))}
                      placeholder="name@company.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contactPhone">Phone *</Label>
                    <Input
                      id="contactPhone"
                      value={formData.contactPhone}
                      onChange={e => setFormData(prev => ({ ...prev, contactPhone: e.target.value }))}
                      placeholder="+234..."
                    />
                  </div>
                </div>
                {formData.type === 'participant' && (
                  <div className="space-y-2">
                    <Label htmlFor="complianceOfficer">Chief Compliance Officer Name *</Label>
                    <Input
                      id="complianceOfficer"
                      value={formData.complianceOfficer}
                      onChange={e => setFormData(prev => ({ ...prev, complianceOfficer: e.target.value }))}
                      placeholder="Name of designated compliance officer"
                    />
                  </div>
                )}
              </div>

              {/* Corridors (for participants) */}
              {formData.type === 'participant' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold border-b pb-2">Requested Corridors</h3>
                  <p className="text-xs text-muted-foreground">Select the corridors you intend to operate on</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {['NG-GH', 'NG-SN', 'NG-CI', 'NG-CM', 'NG-GB', 'NG-US', 'NG-CA', 'NG-IN', 'NG-TR', 'NG-CN', 'NG-AE', 'NG-KE', 'NG-ZA'].map(c => (
                      <label key={c} className="flex items-center gap-2 p-2 border rounded text-sm cursor-pointer hover:bg-muted/50">
                        <input
                          type="checkbox"
                          checked={formData.corridors.includes(c)}
                          onChange={e => {
                            if (e.target.checked) {
                              setFormData(prev => ({ ...prev, corridors: [...prev.corridors, c] }));
                            } else {
                              setFormData(prev => ({ ...prev, corridors: prev.corridors.filter(x => x !== c) }));
                            }
                          }}
                          className="rounded"
                        />
                        {c}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-4 border-t">
                <Button onClick={handleSubmitForm} className="bg-blue-600 hover:bg-blue-700">
                  Continue to Documents <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // --- Step: Upload Documents ---
  if (step === 'upload_docs') {
    const requiredDocs = formData.type === 'participant'
      ? ['CBN License Certificate', 'Certificate of Incorporation', 'AML/CFT Policy Document', 'Board Resolution', 'Audited Financial Statements (2 years)', 'KYC/CDD Procedures Manual']
      : formData.type === 'provider'
      ? ['License in Destination Country', 'API Technical Documentation', 'Company Registration', 'Compliance Certification', 'Insurance Certificate']
      : formData.type === 'regulator'
      ? ['Official Mandate Letter', 'List of Designated Officers', 'Data Classification Requirements']
      : ['Employment Letter', 'Government-issued ID', 'Background Check Consent Form'];

    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="max-w-4xl mx-auto px-6 py-4">
            <div className="flex items-center gap-3">
              <Globe className="h-6 w-6 text-blue-600" />
              <div>
                <h1 className="font-semibold text-lg">National Outbound Remittance Platform</h1>
                <p className="text-sm text-muted-foreground">Application — Document Upload</p>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-6 py-8">
          <Button variant="ghost" size="sm" onClick={() => setStep('fill_form')} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>

          {/* Progress */}
          <div className="flex items-center gap-2 mb-8 text-sm text-muted-foreground">
            <span className="flex items-center gap-1 text-green-600">
              <CheckCircle2 className="h-4 w-4" /> Select Type
            </span>
            <ChevronRight className="h-4 w-4" />
            <span className="flex items-center gap-1 text-green-600">
              <CheckCircle2 className="h-4 w-4" /> Details
            </span>
            <ChevronRight className="h-4 w-4" />
            <span className="flex items-center gap-1 text-blue-600 font-medium">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">3</span>
              Documents
            </span>
            <ChevronRight className="h-4 w-4" />
            <span className="flex items-center gap-1">
              <span className="w-6 h-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs">4</span>
              Review & Submit
            </span>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Required Documents</CardTitle>
              <CardDescription>
                Upload the following documents to support your application. All documents must be in PDF format.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {requiredDocs.map((doc, i) => (
                <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{doc}</p>
                      <p className="text-xs text-muted-foreground">PDF, max 10MB</p>
                    </div>
                  </div>
                  {uploadedDocs.includes(doc) ? (
                    <Badge variant="default" className="bg-green-600">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Uploaded
                    </Badge>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setUploadedDocs(prev => [...prev, doc])}
                    >
                      <Upload className="h-3 w-3 mr-1" /> Upload
                    </Button>
                  )}
                </div>
              ))}

              <div className="flex justify-between pt-4 border-t">
                <p className="text-xs text-muted-foreground self-center">
                  {uploadedDocs.length} of {requiredDocs.length} documents uploaded
                </p>
                <Button onClick={handleUploadComplete} className="bg-blue-600 hover:bg-blue-700">
                  Continue to Review <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // --- Step: Review & Submit ---
  if (step === 'review') {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="max-w-4xl mx-auto px-6 py-4">
            <div className="flex items-center gap-3">
              <Globe className="h-6 w-6 text-blue-600" />
              <div>
                <h1 className="font-semibold text-lg">National Outbound Remittance Platform</h1>
                <p className="text-sm text-muted-foreground">Application — Review & Submit</p>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-6 py-8">
          <Button variant="ghost" size="sm" onClick={() => setStep('upload_docs')} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>

          {/* Progress */}
          <div className="flex items-center gap-2 mb-8 text-sm text-muted-foreground">
            <span className="flex items-center gap-1 text-green-600">
              <CheckCircle2 className="h-4 w-4" /> Select Type
            </span>
            <ChevronRight className="h-4 w-4" />
            <span className="flex items-center gap-1 text-green-600">
              <CheckCircle2 className="h-4 w-4" /> Details
            </span>
            <ChevronRight className="h-4 w-4" />
            <span className="flex items-center gap-1 text-green-600">
              <CheckCircle2 className="h-4 w-4" /> Documents
            </span>
            <ChevronRight className="h-4 w-4" />
            <span className="flex items-center gap-1 text-blue-600 font-medium">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">4</span>
              Review & Submit
            </span>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Review Your Application</CardTitle>
              <CardDescription>Please verify all information before submitting</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">Organization</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Type</span>
                      <span className="font-medium">{selectedStakeholder?.title}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Company</span>
                      <span className="font-medium">{formData.companyName || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">RC Number</span>
                      <span className="font-medium">{formData.registrationNumber || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">License</span>
                      <span className="font-medium">{formData.licenseNumber || '—'}</span>
                    </div>
                    {formData.capitalAmount && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Capital</span>
                        <span className="font-medium">₦{formData.capitalAmount}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">Primary Contact</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Name</span>
                      <span className="font-medium">{formData.contactName || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Email</span>
                      <span className="font-medium">{formData.contactEmail || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Phone</span>
                      <span className="font-medium">{formData.contactPhone || '—'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {formData.corridors.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Requested Corridors</h3>
                  <div className="flex flex-wrap gap-2">
                    {formData.corridors.map(c => (
                      <Badge key={c} variant="secondary">{c}</Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Documents ({uploadedDocs.length} uploaded)</h3>
                <div className="flex flex-wrap gap-2">
                  {uploadedDocs.map(d => (
                    <Badge key={d} variant="outline" className="text-xs">
                      <FileText className="h-3 w-3 mr-1" />{d}
                    </Badge>
                  ))}
                </div>
              </div>

              <Card className="bg-muted/30 border-blue-200">
                <CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium">What happens next?</p>
                      <ol className="mt-2 space-y-1 text-muted-foreground text-xs list-decimal list-inside">
                        <li>Your application is received and assigned a reference number</li>
                        <li>Our team reviews your submission (typically 2-5 business days)</li>
                        <li>If approved, you receive platform credentials via secure email</li>
                        <li>You log in and complete remaining onboarding steps (sandbox testing, certification)</li>
                        <li>Final approval for production access</li>
                      </ol>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Estimated timeline: <strong>{selectedStakeholder?.timeline}</strong>
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end pt-4 border-t">
                <Button onClick={handleFinalSubmit} className="bg-blue-600 hover:bg-blue-700">
                  Submit Application <CheckCircle2 className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // --- Step: Submitted ---
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <Globe className="h-6 w-6 text-blue-600" />
            <div>
              <h1 className="font-semibold text-lg">National Outbound Remittance Platform</h1>
              <p className="text-sm text-muted-foreground">Application Submitted</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <Card className="max-w-2xl mx-auto">
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold">Application Submitted</h2>
            <p className="text-muted-foreground mt-2">
              Your application has been received and is being reviewed by our team.
            </p>

            <Card className="mt-6 bg-muted/30 text-left">
              <CardContent className="py-4">
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Reference Number</span>
                    <span className="font-mono font-bold text-blue-600">{applicationRef}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Applicant</span>
                    <span className="font-medium">{formData.companyName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Type</span>
                    <span className="font-medium">{selectedStakeholder?.title}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant="secondary">Under Review</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Expected Timeline</span>
                    <span className="font-medium">{selectedStakeholder?.timeline}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg text-left text-sm">
              <p className="font-medium text-blue-800">Next steps:</p>
              <ul className="mt-2 space-y-1 text-blue-700 text-xs">
                <li>1. Confirmation email sent to <strong>{formData.contactEmail}</strong></li>
                <li>2. Application assigned to review team (2-5 business days)</li>
                <li>3. You may be contacted for additional documentation</li>
                <li>4. Upon approval, platform credentials sent via secure channel</li>
              </ul>
            </div>

            <p className="mt-6 text-xs text-muted-foreground">
              Track your application status at any time using reference: <strong>{applicationRef}</strong>
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
