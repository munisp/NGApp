import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Shield, Package, Truck, Check, AlertTriangle, MessageCircle, RefreshCw, MapPin, Phone, Clock, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import api from '@/api/client';
import type { Escrow, EscrowStatus } from '@/types';

const STATUS_CONFIG: Record<EscrowStatus, { label: string; color: string; icon: any }> = {
  created: { label: 'Created', color: 'bg-blue-500', icon: Shield },
  funded: { label: 'Funded', color: 'bg-emerald-500', icon: Check },
  accepted: { label: 'Accepted', color: 'bg-emerald-500', icon: Check },
  shipped: { label: 'Shipped', color: 'bg-amber-500', icon: Truck },
  delivered: { label: 'Delivered', color: 'bg-emerald-500', icon: Package },
  completed: { label: 'Completed', color: 'bg-emerald-600', icon: Check },
  disputed: { label: 'Disputed', color: 'bg-red-500', icon: AlertTriangle },
  refunded: { label: 'Refunded', color: 'bg-slate-500', icon: RefreshCw },
  expired: { label: 'Expired', color: 'bg-slate-400', icon: Clock },
  cancelled: { label: 'Cancelled', color: 'bg-slate-400', icon: AlertTriangle },
};

const formatCurrency = (amount: number, currency: string = 'NGN') => {
  if (currency === 'NGN') return `₦${amount.toLocaleString()}`;
  return `${currency} ${amount.toLocaleString()}`;
};

export function EscrowDetail() {
  const { escrowId } = useParams<{ escrowId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const role = searchParams.get('role') || 'buyer';
  const token = searchParams.get('token');

  const [escrow, setEscrow] = useState<Escrow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(true);

  useEffect(() => {
    if (!escrowId) return;
    loadEscrow();
    
    // Poll for updates every 10 seconds
    const interval = setInterval(() => {
      if (polling) loadEscrow();
    }, 10000);

    return () => clearInterval(interval);
  }, [escrowId, token, polling]);

  const loadEscrow = async () => {
    try {
      const data = await api.getEscrow(escrowId!, token || undefined);
      setEscrow(data);
      setError(null);
      
      // Stop polling if escrow is in terminal state
      if (['completed', 'refunded', 'cancelled', 'expired'].includes(data.status)) {
        setPolling(false);
      }
    } catch (err) {
      setError('Failed to load escrow details');
    } finally {
      setLoading(false);
    }
  };

  const getProgressPercent = () => {
    if (!escrow) return 0;
    const statusOrder: EscrowStatus[] = ['created', 'funded', 'accepted', 'shipped', 'delivered', 'completed'];
    const index = statusOrder.indexOf(escrow.status);
    return Math.max(0, ((index + 1) / statusOrder.length) * 100);
  };

  const getNextAction = () => {
    if (!escrow) return null;
    
    if (role === 'buyer') {
      switch (escrow.status) {
        case 'created': return { label: 'Complete Payment', action: () => navigate(`/escrow/${escrowId}/pay`) };
        case 'shipped': return { label: 'Track Shipment', action: () => navigate(`/escrow/${escrowId}/track`) };
        case 'delivered': return { label: 'Confirm Delivery', action: () => navigate(`/escrow/${escrowId}/confirm`) };
        case 'disputed': return { label: 'View Dispute', action: () => navigate(`/dispute/${escrow.id}`) };
        default: return null;
      }
    } else if (role === 'seller') {
      switch (escrow.status) {
        case 'funded': return { label: 'Accept Order', action: () => navigate(`/escrow/${escrowId}/accept`) };
        case 'accepted': return { label: 'Ship Order', action: () => navigate(`/escrow/${escrowId}/ship`) };
        case 'disputed': return { label: 'Respond to Dispute', action: () => navigate(`/dispute/${escrow.id}`) };
        default: return null;
      }
    }
    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading escrow details...</p>
        </div>
      </div>
    );
  }

  if (error || !escrow) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error || 'Escrow not found'}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[escrow.status];
  const StatusIcon = statusConfig.icon;
  const nextAction = getNextAction();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-blue-600" />
              <span className="font-semibold text-slate-800">EscrowProtect</span>
            </div>
            <Badge className={`${statusConfig.color} text-white`}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {statusConfig.label}
            </Badge>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* Progress */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-600">Transaction Progress</span>
              <span className="text-sm font-medium">{Math.round(getProgressPercent())}%</span>
            </div>
            <Progress value={getProgressPercent()} className="h-2" />
          </CardContent>
        </Card>

        {/* Escrow ID */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Escrow ID</p>
                <p className="font-mono text-sm">{escrow.id}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(escrow.id)}>
                Copy
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Item Details */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Item Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-3">
              <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl">
                {escrow.listing.images?.[0] ? (
                  <img src={escrow.listing.images[0]} alt="" className="w-full h-full object-cover rounded-lg" />
                ) : '📦'}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-800">{escrow.listing.title}</h3>
                <p className="text-sm text-slate-500">@{escrow.listing.seller.username}</p>
                <p className="text-lg font-bold text-emerald-600 mt-1">
                  {formatCurrency(escrow.amount, escrow.currency)}
                </p>
              </div>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2 text-slate-600">
                <MapPin className="w-4 h-4" />
                {escrow.listing.seller.location}
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Phone className="w-4 h-4" />
                {escrow.listing.seller.phone || 'N/A'}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Transaction Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {escrow.timeline.map((event, index) => (
                <div key={event.status} className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    event.completed ? 'bg-emerald-500 text-white' :
                    event.active ? 'bg-blue-500 text-white' :
                    'bg-slate-200 text-slate-400'
                  }`}>
                    {event.completed ? <Check className="w-4 h-4" /> : index + 1}
                  </div>
                  <div className="flex-1 pb-3 border-b last:border-0">
                    <p className={`font-medium ${event.active ? 'text-blue-600' : event.completed ? 'text-slate-800' : 'text-slate-400'}`}>
                      {event.label}
                    </p>
                    {event.timestamp && (
                      <p className="text-xs text-slate-500">
                        {new Date(event.timestamp).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Shipping Info */}
        {escrow.shipping && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Shipping Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Carrier</span>
                <span className="font-medium">{escrow.shipping.carrier}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tracking #</span>
                <span className="font-mono">{escrow.shipping.trackingNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Est. Delivery</span>
                <span>{escrow.shipping.estimatedDelivery}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payment Summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Payment Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Item Price</span>
              <span>{formatCurrency(escrow.amount, escrow.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Escrow Fee (2%)</span>
              <span>{formatCurrency(escrow.fee, escrow.currency)}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span className="text-emerald-600">{formatCurrency(escrow.total, escrow.currency)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="space-y-3 pt-2">
          {nextAction && (
            <Button className="w-full bg-blue-600 hover:bg-blue-700" size="lg" onClick={nextAction.action}>
              {nextAction.label}
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          )}

          {!['completed', 'refunded', 'cancelled', 'expired', 'disputed'].includes(escrow.status) && (
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => navigate(`/dispute/new?escrow=${escrowId}`)}>
                <AlertTriangle className="w-4 h-4 mr-2" />
                Open Dispute
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => navigate(`/refund/request?escrow=${escrowId}`)}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Request Refund
              </Button>
            </div>
          )}

          <Button variant="ghost" className="w-full" onClick={() => window.open(`https://wa.me/?text=Check my escrow: ${window.location.href}`, '_blank')}>
            <MessageCircle className="w-4 h-4 mr-2" />
            Share via WhatsApp
          </Button>
        </div>

        {/* Trust Footer */}
        <div className="flex justify-center gap-6 pt-4 text-xs text-slate-500">
          <div className="flex items-center gap-1">
            <Shield className="w-4 h-4" />
            Secure
          </div>
          <div className="flex items-center gap-1">
            <Check className="w-4 h-4" />
            Verified
          </div>
          <div className="flex items-center gap-1">
            <AlertTriangle className="w-4 h-4" />
            Protected
          </div>
        </div>
      </div>
    </div>
  );
}

export default EscrowDetail;
