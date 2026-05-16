import React, { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const DEMO_MODE = process.env.NODE_ENV === 'development'; // Or a specific environment variable

interface KYCStatusData {
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'IN_REVIEW';
  documents: {
    id: string;
    name: string;
    status: 'UPLOADED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
    reason?: string;
  }[];
  lastSubmissionDate?: string;
}

const demoKycStatus: KYCStatusData = {
  status: 'PENDING',
  documents: [
    { id: 'doc1', name: 'National ID Card', status: 'UPLOADED' },
    { id: 'doc2', name: 'Utility Bill', status: 'PENDING' },
    { id: 'doc3', name: 'Bank Statement', status: 'REJECTED', reason: 'Outdated statement' },
  ],
  lastSubmissionDate: '2024-02-28',
};

const KYCStatus: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const utils = trpc.useUtils();

  const { data: kycStatus, isLoading, isError, error } = trpc.kyc.status.useQuery(undefined, {
    enabled: isAuthenticated && !DEMO_MODE,
  });

  const { mutate: submitKyc, isLoading: isSubmitting } = trpc.kyc.submit.useMutation({
    onSuccess: () => {
      toast.success('KYC documents submitted successfully!');
      utils.kyc.status.invalidate();
      setDocumentType('');
      setDocumentFile(null);
    },
    onError: (err) => {
      toast.error(`Failed to submit KYC: ${err.message}`);
    },
  });

  const [documentType, setDocumentType] = useState<string>('');
  const [documentFile, setDocumentFile] = useState<File | null>(null);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2">Loading authentication...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Card className="w-full max-w-2xl mx-auto mt-8">
        <CardHeader>
          <CardTitle>Access Denied</CardTitle>
          <CardDescription>Please log in to view your KYC status.</CardDescription>
        </CardHeader>
        <CardContent>
          <p>You need to be authenticated to access this page.</p>
        </CardContent>
      </Card>
    );
  }

  const currentKycData = DEMO_MODE ? demoKycStatus : kycStatus;

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setDocumentFile(event.target.files[0]);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!documentType || !documentFile) {
      toast.error('Please select a document type and upload a file.');
      return;
    }

    // In a real application, you would convert the File to a format suitable for your API,
    // e.g., FormData or base64 string. For this example, we'll simulate the submission.
    console.log('Submitting KYC:', { documentType, fileName: documentFile.name });

    if (DEMO_MODE) {
      toast.success('KYC document submitted successfully in DEMO MODE!');
      // Simulate invalidation
      // For demo, we might update the local demoKycStatus or just show a success message
      setDocumentType('');
      setDocumentFile(null);
    } else {
      // Assuming submitKyc expects an object with documentType and file content
      // This part needs to be adapted based on the actual trpc.kyc.submit input type
      submitKyc({ documentType, file: documentFile.name }); // Placeholder for actual file upload logic
    }
  };

  if (isLoading && !DEMO_MODE) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2">Loading KYC status...</p>
      </div>
    );
  }

  if (isError && !DEMO_MODE) {
    return (
      <Card className="w-full max-w-2xl mx-auto mt-8">
        <CardHeader>
          <CardTitle>Error</CardTitle>
          <CardDescription>Failed to load KYC status.</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Error: {error?.message || 'Unknown error'}</p>
          <Button onClick={() => utils.kyc.status.invalidate()} className="mt-4">Retry</Button>
        </CardContent>
      </Card>
    );
  }

  const getStatusBadgeVariant = (status: KYCStatusData['status'] | string) => {
    switch (status) {
      case 'APPROVED':
        return 'default';
      case 'PENDING':
      case 'IN_REVIEW':
        return 'secondary';
      case 'REJECTED':
        return 'destructive';
      case 'UPLOADED':
        return 'outline';
      case 'VERIFIED':
        return 'default';
      default:
        return 'outline';
    }
  };

  return (
    <div className="container mx-auto py-8">
      <Card className="w-full max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>KYC Status</CardTitle>
          <CardDescription>View your Know Your Customer (KYC) verification status and submit required documents.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-2">Overall Status:</h3>
            <Badge variant={getStatusBadgeVariant(currentKycData?.status || 'PENDING')} className="text-base py-1 px-3">
              {currentKycData?.status || 'PENDING'}
            </Badge>
            {currentKycData?.lastSubmissionDate && (
              <p className="text-sm text-muted-foreground mt-2">
                Last Submission: {new Date(currentKycData.lastSubmissionDate).toLocaleDateString()}
              </p>
            )}
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">Required Documents:</h3>
            <div className="space-y-3">
              {(currentKycData?.documents || []).length > 0 ? (
                currentKycData?.documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-3 border rounded-md">
                    <span className="font-medium">{doc.name}</span>
                    <div className="flex items-center space-x-2">
                      <Badge variant={getStatusBadgeVariant(doc.status)}>{doc.status}</Badge>
                      {doc.reason && <span className="text-sm text-red-500">({doc.reason})</span>}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground">No documents listed.</p>
              )}
            </div>
          </div>

          <Card className="p-4">
            <CardTitle className="text-lg mb-3">Submit New Document</CardTitle>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="documentType">Document Type</Label>
                <Select value={documentType} onValueChange={setDocumentType}>
                  <SelectTrigger id="documentType">
                    <SelectValue placeholder="Select a document type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="national_id">National ID Card</SelectItem>
                    <SelectItem value="utility_bill">Utility Bill</SelectItem>
                    <SelectItem value="bank_statement">Bank Statement</SelectItem>
                    <SelectItem value="passport">International Passport</SelectItem>
                    <SelectItem value="drivers_license">Driver's License</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="documentFile">Upload Document</Label>
                <Input id="documentFile" type="file" onChange={handleFileChange} />
              </div>
              <Button type="submit" disabled={isSubmitting || !documentType || !documentFile}>
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Submit Document
              </Button>
            </form>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
};

export default KYCStatus;