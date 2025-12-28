import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { RefreshCw, ArrowLeft, AlertTriangle, ChevronRight, Clock, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import api from '@/api/client';
import type { RefundReason } from '@/types';

const REFUND_REASONS: { value: RefundReason; label: string; description: string; autoApprove: boolean }[] = [
  { value: 'buyer_cancelled', label: 'I want to cancel', description: 'Cancel the order before seller ships', autoApprove: true },
  { value: 'seller_cancelled', label: 'Seller cancelled', description: 'The seller cancelled the order', autoApprove: true },
  { value: 'expired', label: 'Order expired', description: 'The seller did not respond in time', autoApprove: true },
  { value: 'dispute_resolved', label: 'Dispute resolution', description: 'Refund from dispute resolution', autoApprove: false },
];

const formatCurrency = (amount: number, currency: string = 'NGN') => {
  if (currency === 'NGN') return `₦${amount.toLocaleString()}`;
  return `${currency} ${amount.toLocaleString()}`;
};

export function RefundRequest() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const escrowId = searchParams.get('escrow');

  const [reason, setReason] = useState<RefundReason | ''>('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [refundId, setRefundId] = useState<string | null>(null);

  // Mock escrow data - in production, fetch from API
  const escrowAmount = 375000;
  const escrowCurrency = 'NGN';

  const selectedReason = REFUND_REASONS.find(r => r.value === reason);

  const handleSubmit = async () => {
    if (!escrowId || !reason) {
      setError('Please select a reason for the refund');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await api.requestRefund(escrowId, reason);
      if (result.success) {
        setRefundId(result.refund_id);
        setSuccess(true);
      }
    } catch (err) {
      setError('Failed to request refund. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-lg mx-auto p-4 pt-20">
          <Card className="text-center">
            <CardContent className="p-8">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-emerald-600" />
              </div>
              <h2 className="text-xl font-semibold text-slate-800 mb-2">Refund Requested</h2>
              <p className="text-slate-600 mb-4">
                Your refund request has been submitted successfully.
              </p>
              <div className="bg-slate-50 rounded-lg p-4 mb-6">
                <p className="text-sm text-slate-500">Refund ID</p>
                <p className="font-mono">{refundId}</p>
              </div>
              {selectedReason?.autoApprove ? (
                <Alert className="bg-emerald-50 border-emerald-200 text-left mb-4">
                  <Check className="h-4 w-4 text-emerald-600" />
                  <AlertDescription className="text-emerald-800">
                    This refund will be processed automatically within 24-48 hours.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert className="bg-amber-50 border-amber-200 text-left mb-4">
                  <Clock className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800">
                    This refund requires review and may take 3-5 business days.
                  </AlertDescription>
                </Alert>
              )}
              <Button className="w-full" onClick={() => navigate(`/escrow/${escrowId}`)}>
                Back to Escrow
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

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
              <h1 className="font-semibold text-slate-800">Request Refund</h1>
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

        {/* Refund Amount */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Refund Amount</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {formatCurrency(escrowAmount, escrowCurrency)}
                </p>
              </div>
              <RefreshCw className="w-8 h-8 text-slate-300" />
            </div>
          </CardContent>
        </Card>

        {/* Reason Selection */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Why do you want a refund?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {REFUND_REASONS.map((r) => (
              <div
                key={r.value}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  reason === r.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 hover:border-blue-300'
                }`}
                onClick={() => setReason(r.value)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-slate-800">{r.label}</p>
                    <p className="text-sm text-slate-500">{r.description}</p>
                  </div>
                  {r.autoApprove && (
                    <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 text-xs">
                      Auto-approve
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Additional Details */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Additional Details (Optional)</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Provide any additional information..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </CardContent>
        </Card>

        {/* Processing Time Info */}
        {selectedReason && (
          <Card className={selectedReason.autoApprove ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}>
            <CardContent className="p-4">
              <div className="flex gap-3">
                <Clock className={`w-5 h-5 flex-shrink-0 ${selectedReason.autoApprove ? 'text-emerald-600' : 'text-amber-600'}`} />
                <div className="text-sm">
                  <p className={`font-medium ${selectedReason.autoApprove ? 'text-emerald-800' : 'text-amber-800'}`}>
                    {selectedReason.autoApprove ? 'Quick Refund' : 'Review Required'}
                  </p>
                  <p className={selectedReason.autoApprove ? 'text-emerald-700' : 'text-amber-700'}>
                    {selectedReason.autoApprove
                      ? 'This refund will be processed automatically within 24-48 hours.'
                      : 'This refund requires review and may take 3-5 business days.'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Submit */}
        <Button
          className="w-full bg-blue-600 hover:bg-blue-700"
          size="lg"
          onClick={handleSubmit}
          disabled={loading || !reason}
        >
          {loading ? 'Processing...' : 'Request Refund'}
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>

        <p className="text-xs text-center text-slate-500">
          Refunds are processed to your original payment method. Processing times may vary by bank.
        </p>
      </div>
    </div>
  );
}

export default RefundRequest;
