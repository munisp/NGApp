import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { AlertTriangle, Upload, Camera, FileText, ChevronRight, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import api from '@/api/client';
import type { DisputeReason } from '@/types';

const DISPUTE_REASONS: { value: DisputeReason; label: string; description: string }[] = [
  { value: 'item_not_received', label: 'Item Not Received', description: 'I paid but never received the item' },
  { value: 'item_not_as_described', label: 'Item Not As Described', description: 'The item is different from what was advertised' },
  { value: 'item_damaged', label: 'Item Damaged', description: 'The item arrived damaged or broken' },
  { value: 'wrong_item', label: 'Wrong Item', description: 'I received a different item than ordered' },
  { value: 'seller_unresponsive', label: 'Seller Unresponsive', description: 'The seller is not responding to messages' },
  { value: 'other', label: 'Other', description: 'Other issue not listed above' },
];

export function DisputeForm() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const escrowId = searchParams.get('escrow');

  const [reason, setReason] = useState<DisputeReason | ''>('');
  const [description, setDescription] = useState('');
  const [evidence, setEvidence] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setEvidence([...evidence, ...Array.from(e.target.files)]);
    }
  };

  const handleSubmit = async () => {
    if (!escrowId || !reason || !description) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await api.openDispute(escrowId, reason, description);
      if (result.success) {
        // Upload evidence if any
        for (const file of evidence) {
          const reader = new FileReader();
          reader.onload = async () => {
            await api.submitEvidence(result.dispute_id, {
              type: file.type.startsWith('image/') ? 'image' : 'document',
              content: reader.result as string,
            });
          };
          reader.readAsDataURL(file);
        }
        navigate(`/dispute/${result.dispute_id}`);
      }
    } catch (err) {
      setError('Failed to open dispute. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-semibold text-slate-800">Open Dispute</h1>
              <p className="text-xs text-slate-500">Escrow: {escrowId}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Info Card */}
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-medium">Before opening a dispute</p>
                <p className="mt-1">Please try to resolve the issue directly with the seller first. Disputes should be a last resort.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Reason Selection */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">What's the issue?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={reason} onValueChange={(v) => setReason(v as DisputeReason)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {DISPUTE_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    <div>
                      <p className="font-medium">{r.label}</p>
                      <p className="text-xs text-slate-500">{r.description}</p>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Description */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Describe the issue</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Please provide details about what happened..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
            <p className="text-xs text-slate-500 mt-2">
              Be specific and include relevant dates, communications, and any other details.
            </p>
          </CardContent>
        </Card>

        {/* Evidence Upload */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Upload Evidence</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-600">
              Upload photos, screenshots, or documents that support your claim.
            </p>
            
            <div className="grid grid-cols-3 gap-2">
              <label className="aspect-square border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors">
                <Camera className="w-6 h-6 text-slate-400" />
                <span className="text-xs text-slate-500 mt-1">Photo</span>
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
              </label>
              <label className="aspect-square border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors">
                <Upload className="w-6 h-6 text-slate-400" />
                <span className="text-xs text-slate-500 mt-1">Upload</span>
                <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileChange} />
              </label>
              <label className="aspect-square border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors">
                <FileText className="w-6 h-6 text-slate-400" />
                <span className="text-xs text-slate-500 mt-1">Document</span>
                <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={handleFileChange} />
              </label>
            </div>

            {evidence.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Uploaded files ({evidence.length})</p>
                {evidence.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-slate-100 rounded">
                    <span className="text-sm truncate">{file.name}</span>
                    <Button variant="ghost" size="sm" onClick={() => setEvidence(evidence.filter((_, i) => i !== index))}>
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Submit */}
        <Button 
          className="w-full bg-red-600 hover:bg-red-700" 
          size="lg" 
          onClick={handleSubmit}
          disabled={loading || !reason || !description}
        >
          {loading ? 'Submitting...' : 'Submit Dispute'}
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>

        <p className="text-xs text-center text-slate-500">
          By submitting, you agree to our dispute resolution process. Both parties will have 48 hours to submit evidence.
        </p>
      </div>
    </div>
  );
}

export default DisputeForm;
