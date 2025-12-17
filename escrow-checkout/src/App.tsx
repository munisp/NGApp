import { useState, useEffect } from 'react';
import { Shield, ChevronRight, Check, Package, Truck, CreditCard, User, Building2, Phone, MapPin, Star, AlertTriangle, MessageCircle, Copy, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || 'https://app-eeeyetyo.fly.dev';

const api = {
  async createEscrow(listing: ListingData, buyer: BuyerInfo, paymentMethod: string) {
    const res = await fetch(`${API_URL}/api/v1/escrow/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listing, buyer, payment_method: paymentMethod })
    });
    return res.json();
  },
  async getEscrow(escrowId: string, token?: string) {
    const url = token ? `${API_URL}/api/v1/escrow/${escrowId}?token=${token}` : `${API_URL}/api/v1/escrow/${escrowId}`;
    const res = await fetch(url);
    return res.json();
  },
  async verifyBank(bankCode: string, accountNumber: string) {
    const res = await fetch(`${API_URL}/api/v1/bank/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bank_code: bankCode, account_number: accountNumber })
    });
    return res.json();
  },
  async acceptOrder(escrowId: string, bankDetails: { bank_code: string; bank_name: string; account_number: string; account_name: string; verified: boolean }) {
    const res = await fetch(`${API_URL}/api/v1/escrow/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ escrow_id: escrowId, bank_details: bankDetails })
    });
    return res.json();
  },
  async shipOrder(escrowId: string, shipping: { carrier: string; tracking_number: string; estimated_delivery: string }) {
    const res = await fetch(`${API_URL}/api/v1/escrow/ship`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ escrow_id: escrowId, shipping })
    });
    return res.json();
  },
  async confirmDelivery(escrowId: string, confirmation: { items_received: boolean; items_as_described: boolean; condition: string; rating: number }) {
    const res = await fetch(`${API_URL}/api/v1/escrow/confirm-delivery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ escrow_id: escrowId, ...confirmation })
    });
    return res.json();
  }
};

interface ListingData {
  id: string;
  title: string;
  price: number;
  currency: string;
  seller: {
    username: string;
    verified: boolean;
    phone: string;
    location: string;
    website?: string;
  };
  source: string;
}

interface BuyerInfo {
  name: string;
  phone: string;
  address: string;
}

interface SellerBankInfo {
  bankName: string;
  accountNumber: string;
  accountName: string;
  verified: boolean;
}

interface EscrowTransaction {
  id: string;
  status: string;
  listing: ListingData;
  buyer: BuyerInfo;
  amount: number;
  fee: number;
  total: number;
  createdAt: Date;
  timeline: TimelineEvent[];
}

interface TimelineEvent {
  status: string;
  label: string;
  timestamp?: Date;
  completed: boolean;
  active: boolean;
}

const NIGERIAN_BANKS = [
  { code: '044', name: 'Access Bank' },
  { code: '050', name: 'Ecobank Nigeria' },
  { code: '070', name: 'Fidelity Bank' },
  { code: '011', name: 'First Bank of Nigeria' },
  { code: '058', name: 'Guaranty Trust Bank' },
  { code: '030', name: 'Heritage Bank' },
  { code: '076', name: 'Polaris Bank' },
  { code: '221', name: 'Stanbic IBTC Bank' },
  { code: '232', name: 'Sterling Bank' },
  { code: '032', name: 'Union Bank of Nigeria' },
  { code: '033', name: 'United Bank for Africa' },
  { code: '035', name: 'Wema Bank' },
  { code: '057', name: 'Zenith Bank' },
  { code: '999', name: 'OPay' },
  { code: '998', name: 'PalmPay' },
  { code: '997', name: 'Kuda Bank' },
  { code: '996', name: 'Moniepoint' },
];

const PAYMENT_METHODS = [
  { id: 'bank_transfer', name: 'Bank Transfer', description: 'Pay via GTBank, Access, Zenith, etc.', icon: Building2 },
  { id: 'opay', name: 'OPay', description: 'Pay with your OPay wallet', icon: CreditCard, color: 'bg-cyan-500' },
  { id: 'palmpay', name: 'PalmPay', description: 'Pay with your PalmPay wallet', icon: CreditCard, color: 'bg-purple-600' },
  { id: 'kuda', name: 'Kuda Bank', description: 'Pay from your Kuda account', icon: CreditCard, color: 'bg-violet-600' },
];

const formatCurrency = (amount: number, currency: string = 'NGN') => {
  if (currency === 'NGN') return `₦${amount.toLocaleString()}`;
  return `${currency} ${amount.toLocaleString()}`;
};

const ProgressSteps = ({ currentStep, steps }: { currentStep: number; steps: string[] }) => (
  <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b overflow-x-auto">
    {steps.map((step, index) => (
      <div key={step} className="flex items-center">
        <div className="flex flex-col items-center min-w-16">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
            index < currentStep ? 'bg-emerald-500 text-white' :
            index === currentStep ? 'bg-blue-500 text-white' :
            'bg-slate-200 text-slate-500'
          }`}>
            {index < currentStep ? <Check className="w-4 h-4" /> : index + 1}
          </div>
          <span className={`text-xs mt-1 whitespace-nowrap ${
            index === currentStep ? 'text-blue-600 font-semibold' :
            index < currentStep ? 'text-emerald-600' : 'text-slate-500'
          }`}>{step}</span>
        </div>
        {index < steps.length - 1 && (
          <div className={`w-8 h-0.5 mx-1 ${index < currentStep ? 'bg-emerald-500' : 'bg-slate-200'}`} />
        )}
      </div>
    ))}
  </div>
);

function App() {
  const [mode, setMode] = useState<'buyer' | 'seller'>('buyer');
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedPayment, setSelectedPayment] = useState('bank_transfer');
  const [transaction, setTransaction] = useState<EscrowTransaction | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [rating, setRating] = useState(4);
  
  const [buyerInfo, setBuyerInfo] = useState<BuyerInfo>({ name: '', phone: '', address: '' });
  const [sellerBankInfo, setSellerBankInfo] = useState<SellerBankInfo>({
    bankName: '', accountNumber: '', accountName: '', verified: false
  });
  
  const [listing] = useState<ListingData>({
    id: 'LST-2024-001',
    title: '150 PCS Stock Jeans Bale',
    price: 375000,
    currency: 'NGN',
    seller: { username: 'merchantcheena', verified: true, phone: '09061611991', location: 'Port Harcourt', website: 'merchantcheena.com' },
    source: 'instagram'
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'seller') setMode('seller');
    const escrowId = params.get('escrow');
    if (escrowId) loadTransaction(escrowId);
  }, []);

  const loadTransaction = async (escrowId: string) => {
    setTransaction({
      id: escrowId, status: 'payment_received', listing,
      buyer: { name: 'Adaeze Okonkwo', phone: '+234 803 456 7890', address: '15 Marina Road, Lagos' },
      amount: listing.price, fee: listing.price * 0.02, total: listing.price * 1.02, createdAt: new Date(),
      timeline: [
        { status: 'payment_received', label: 'Payment Received', timestamp: new Date(), completed: true, active: false },
        { status: 'seller_accepted', label: 'Seller Accepted', completed: false, active: true },
        { status: 'shipped', label: 'Order Shipped', completed: false, active: false },
        { status: 'delivered', label: 'Delivered', completed: false, active: false },
        { status: 'completed', label: 'Funds Released', completed: false, active: false },
      ]
    });
  };

  const buyerSteps = ['Review', 'Pay', 'Escrow', 'Ship', 'Verify', 'Complete'];
  const sellerSteps = ['Claim', 'Bank', 'Ship', 'Complete'];

  const handleBuyerSubmit = async () => {
    setIsLoading(true);
    try {
      const result = await api.createEscrow(listing, buyerInfo, selectedPayment);
      if (result.success) {
        setTransaction({
          id: result.escrow_id, status: 'payment_received', listing, buyer: buyerInfo,
          amount: result.amount, fee: result.fee, total: result.total, createdAt: new Date(),
          timeline: [
            { status: 'payment_received', label: 'Payment Received', timestamp: new Date(), completed: true, active: false },
            { status: 'seller_accepted', label: 'Seller Accepted', completed: false, active: true },
            { status: 'shipped', label: 'Order Shipped', completed: false, active: false },
            { status: 'delivered', label: 'Delivered', completed: false, active: false },
            { status: 'completed', label: 'Funds Released', completed: false, active: false },
          ]
        });
        setCurrentStep(2);
      }
    } catch (error) {
      console.error('Failed to create escrow:', error);
    }
    setIsLoading(false);
  };

  const handleBankVerification = async () => {
    if (!sellerBankInfo.bankName || sellerBankInfo.accountNumber.length !== 10) return;
    setIsLoading(true);
    try {
      const bankCode = NIGERIAN_BANKS.find(b => b.name === sellerBankInfo.bankName)?.code || '';
      const result = await api.verifyBank(bankCode, sellerBankInfo.accountNumber);
      if (result.success) {
        setSellerBankInfo(prev => ({ ...prev, accountName: result.account_name, verified: true }));
      }
    } catch (error) {
      console.error('Failed to verify bank:', error);
    }
    setIsLoading(false);
  };

  const handleConfirmDelivery = async () => {
    if (!transaction) return;
    setIsLoading(true);
    try {
      const result = await api.confirmDelivery(transaction.id, {
        items_received: true, items_as_described: true, condition: 'excellent', rating
      });
      if (result.success) {
        setTransaction({
          ...transaction, status: 'completed',
          timeline: transaction.timeline.map(t => ({ ...t, completed: true, active: false, timestamp: t.timestamp || new Date() }))
        });
        setCurrentStep(5);
      }
    } catch (error) {
      console.error('Failed to confirm delivery:', error);
    }
    setIsLoading(false);
  };

  const renderBuyerReview = () => (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-800">Review Purchase</h2>
        <p className="text-sm text-slate-500">Confirm the details detected from the listing</p>
      </div>
      <Card className="bg-slate-50">
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl">👖</div>
            <div className="flex-1">
              <h3 className="font-semibold text-slate-800">{listing.title}</h3>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                @{listing.seller.username}
                {listing.seller.verified && <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700"><Check className="w-3 h-3 mr-1" /> VERIFIED</Badge>}
              </div>
              <p className="text-2xl font-bold text-emerald-600 mt-2">{formatCurrency(listing.price)}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
            <div className="flex items-center gap-2 text-slate-600"><MapPin className="w-4 h-4" />{listing.seller.location}</div>
            <div className="flex items-center gap-2 text-slate-600"><Package className="w-4 h-4" />Delivery Available</div>
            <div className="flex items-center gap-2 text-slate-600"><Phone className="w-4 h-4" />{listing.seller.phone}</div>
            {listing.seller.website && <div className="flex items-center gap-2 text-slate-600"><ExternalLink className="w-4 h-4" />{listing.seller.website}</div>}
          </div>
        </CardContent>
      </Card>
      <div className="space-y-4">
        <div><Label htmlFor="name">Your Name</Label><Input id="name" value={buyerInfo.name} onChange={(e) => setBuyerInfo({ ...buyerInfo, name: e.target.value })} placeholder="Enter your full name" /></div>
        <div><Label htmlFor="phone">Your Phone (WhatsApp)</Label><Input id="phone" type="tel" value={buyerInfo.phone} onChange={(e) => setBuyerInfo({ ...buyerInfo, phone: e.target.value })} placeholder="+234 XXX XXX XXXX" /></div>
        <div><Label htmlFor="address">Delivery Address</Label><Input id="address" value={buyerInfo.address} onChange={(e) => setBuyerInfo({ ...buyerInfo, address: e.target.value })} placeholder="Enter your delivery address" /></div>
      </div>
      <Button className="w-full bg-blue-600 hover:bg-blue-700" size="lg" onClick={() => setCurrentStep(1)} disabled={!buyerInfo.name || !buyerInfo.phone || !buyerInfo.address}>
        Continue to Payment <ChevronRight className="w-4 h-4 ml-2" />
      </Button>
      <div className="flex justify-center gap-6 pt-4 border-t">
        <div className="flex items-center gap-2 text-xs text-slate-500"><Shield className="w-4 h-4" /> Secure</div>
        <div className="flex items-center gap-2 text-xs text-slate-500"><CreditCard className="w-4 h-4" /> Money-Back</div>
        <div className="flex items-center gap-2 text-xs text-slate-500"><User className="w-4 h-4" /> Dispute Resolution</div>
      </div>
    </div>
  );

  const renderBuyerPayment = () => (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-800">Select Payment Method</h2>
        <p className="text-sm text-slate-500">Choose how you want to pay into escrow</p>
      </div>
      <div className="space-y-3">
        {PAYMENT_METHODS.map((method) => (
          <div key={method.id} className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedPayment === method.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-300'}`} onClick={() => setSelectedPayment(method.id)}>
            <div className={`w-12 h-8 rounded-md flex items-center justify-center ${method.color || 'bg-slate-100'}`}>
              <method.icon className={`w-5 h-5 ${method.color ? 'text-white' : 'text-slate-600'}`} />
            </div>
            <div><h4 className="font-semibold text-slate-800">{method.name}</h4><p className="text-sm text-slate-500">{method.description}</p></div>
          </div>
        ))}
      </div>
      <Card className="bg-slate-50">
        <CardContent className="p-4 space-y-2">
          <div className="flex justify-between text-sm text-slate-600"><span>Item Price</span><span>{formatCurrency(listing.price)}</span></div>
          <div className="flex justify-between text-sm text-slate-600"><span>Escrow Fee (2%)</span><span>{formatCurrency(listing.price * 0.02)}</span></div>
          <Separator />
          <div className="flex justify-between font-bold text-lg"><span>Total</span><span>{formatCurrency(listing.price * 1.02)}</span></div>
        </CardContent>
      </Card>
      <Button className="w-full bg-blue-600 hover:bg-blue-700" size="lg" onClick={handleBuyerSubmit} disabled={isLoading}>
        {isLoading ? 'Processing...' : `Pay ${formatCurrency(listing.price * 1.02)}`} <ChevronRight className="w-4 h-4 ml-2" />
      </Button>
      <p className="text-center text-xs text-slate-500"><Shield className="w-3 h-3 inline mr-1" />Your payment is held securely until you confirm delivery</p>
    </div>
  );

  const renderBuyerEscrow = () => (
    <div className="p-6 text-center space-y-6">
      <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto"><Check className="w-10 h-10 text-emerald-600" /></div>
      <div><h2 className="text-xl font-semibold text-slate-800">Payment Received!</h2><p className="text-sm text-slate-500">Your funds are now held securely in escrow</p></div>
      <div className="bg-slate-100 px-4 py-2 rounded-lg inline-block font-mono text-sm">{transaction?.id}</div>
      <Card className="bg-slate-50 text-left">
        <CardContent className="p-4 space-y-3">
          <div className="flex justify-between"><span className="text-slate-600">Amount in Escrow</span><span className="font-bold text-emerald-600">{formatCurrency(listing.price)}</span></div>
          <div className="flex justify-between"><span className="text-slate-600">Seller</span><span>@{listing.seller.username}</span></div>
          <div className="flex justify-between"><span className="text-slate-600">Status</span><span className="text-amber-600">⏳ Awaiting Seller</span></div>
        </CardContent>
      </Card>
      <p className="text-sm text-slate-500">The seller has been notified. They have 24 hours to accept and ship your order.</p>
      <Button className="w-full bg-green-500 hover:bg-green-600" size="lg" onClick={() => setCurrentStep(3)}><MessageCircle className="w-4 h-4 mr-2" />Message Seller on WhatsApp</Button>
    </div>
  );

  const renderBuyerShipping = () => (
    <div className="p-6 space-y-6">
      <div><h2 className="text-xl font-semibold text-slate-800">Order Shipped! 🚚</h2><p className="text-sm text-slate-500">The seller has shipped your order</p></div>
      <div className="bg-slate-100 px-4 py-2 rounded-lg inline-block font-mono text-sm">{transaction?.id}</div>
      <div className="space-y-4">
        {transaction?.timeline.map((event, index) => (
          <div key={event.status} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${event.completed ? 'bg-emerald-500 text-white' : event.active ? 'bg-blue-500 text-white animate-pulse' : 'bg-slate-200 text-slate-500'}`}>
                {event.completed ? <Check className="w-4 h-4" /> : event.status === 'shipped' ? <Truck className="w-4 h-4" /> : event.status === 'delivered' ? <Package className="w-4 h-4" /> : <CreditCard className="w-4 h-4" />}
              </div>
              {index < (transaction?.timeline.length || 0) - 1 && <div className={`w-0.5 h-8 ${event.completed ? 'bg-emerald-500' : 'bg-slate-200'}`} />}
            </div>
            <div><h4 className="font-semibold text-slate-800">{event.label}</h4><p className="text-sm text-slate-500">{event.timestamp ? event.timestamp.toLocaleString() : event.status === 'delivered' ? 'Expected: 2-4 business days' : 'After you confirm delivery'}</p></div>
          </div>
        ))}
      </div>
      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="p-4">
          <h4 className="font-semibold text-amber-800 flex items-center gap-2"><Package className="w-4 h-4" /> Shipping Details</h4>
          <div className="mt-2 text-sm text-amber-700 space-y-1"><p><strong>Carrier:</strong> GIG Logistics</p><p><strong>Tracking:</strong> GIG-NG-{transaction?.id.slice(-6)}</p><p><strong>ETA:</strong> 2-4 business days</p></div>
        </CardContent>
      </Card>
      <Button className="w-full bg-blue-600 hover:bg-blue-700" size="lg" onClick={() => setCurrentStep(4)}>I've Received My Order <ChevronRight className="w-4 h-4 ml-2" /></Button>
      <Button variant="outline" className="w-full" onClick={() => alert('Dispute flow')}>Report an Issue</Button>
    </div>
  );

  const renderBuyerVerify = () => (
    <div className="p-6 space-y-6">
      <div><h2 className="text-xl font-semibold text-slate-800">Verify Your Order</h2><p className="text-sm text-slate-500">Please confirm the items match the listing</p></div>
      <Card className="bg-slate-50">
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xl">👖</div>
            <div><h3 className="font-semibold text-slate-800">{listing.title}</h3><p className="text-sm text-slate-500">@{listing.seller.username}</p><p className="text-lg font-bold text-emerald-600">{formatCurrency(listing.price)}</p></div>
          </div>
        </CardContent>
      </Card>
      <div className="space-y-4">
        <div><Label>Did you receive all 150 pieces?</Label><Select defaultValue="yes"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="yes">Yes, all items received</SelectItem><SelectItem value="no">No, some items missing</SelectItem></SelectContent></Select></div>
        <div><Label>Are the items as described?</Label><Select defaultValue="yes"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="yes">Yes, matches description</SelectItem><SelectItem value="no">No, different from listing</SelectItem></SelectContent></Select></div>
        <div><Label>Overall condition?</Label><Select defaultValue="excellent"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="excellent">Excellent - As expected</SelectItem><SelectItem value="good">Good - Minor issues</SelectItem><SelectItem value="poor">Poor - Major issues</SelectItem></SelectContent></Select></div>
      </div>
      <Alert className="bg-amber-50 border-amber-200"><AlertTriangle className="w-4 h-4 text-amber-600" /><AlertDescription className="text-amber-700">By confirming, {formatCurrency(listing.price)} will be released to the seller. This action cannot be undone.</AlertDescription></Alert>
      <Button className="w-full bg-emerald-600 hover:bg-emerald-700" size="lg" onClick={handleConfirmDelivery} disabled={isLoading}><Check className="w-4 h-4 mr-2" />{isLoading ? 'Processing...' : 'Confirm & Release Funds'}</Button>
      <Button variant="outline" className="w-full" onClick={() => alert('Dispute flow')}>Open Dispute</Button>
    </div>
  );

  const renderBuyerComplete = () => (
    <div className="p-6 text-center space-y-6">
      <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto text-4xl">🎉</div>
      <div><h2 className="text-xl font-semibold text-slate-800">Transaction Complete!</h2><p className="text-sm text-slate-500">Funds have been released to the seller</p></div>
      <Card className="bg-emerald-50 border-emerald-200 text-left">
        <CardContent className="p-4 space-y-2">
          <div className="flex justify-between text-sm"><span className="text-slate-600">Escrow ID</span><span className="font-mono">{transaction?.id}</span></div>
          <div className="flex justify-between text-sm"><span className="text-slate-600">Amount Paid</span><span className="font-semibold">{formatCurrency(listing.price * 1.02)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-slate-600">Released to Seller</span><span className="font-semibold">{formatCurrency(listing.price)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-slate-600">Platform Fee</span><span>{formatCurrency(listing.price * 0.02)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-slate-600">Duration</span><span>4 days</span></div>
        </CardContent>
      </Card>
      <div><p className="text-sm text-slate-600 mb-2">Rate your experience with @{listing.seller.username}</p>
        <div className="flex justify-center gap-2">{[1, 2, 3, 4, 5].map((star) => (<Star key={star} className={`w-8 h-8 cursor-pointer transition-colors ${star <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} onClick={() => setRating(star)} />))}</div>
      </div>
      <div className="grid grid-cols-2 gap-3"><Button variant="outline" onClick={() => window.location.reload()}>New Purchase</Button><Button className="bg-blue-600 hover:bg-blue-700">Share Receipt</Button></div>
      <div className="flex justify-center gap-2 text-xs text-slate-500 pt-4 border-t"><Check className="w-4 h-4 text-emerald-500" />Protected Transaction</div>
    </div>
  );

  const renderSellerClaim = () => (
    <div className="p-6 space-y-6">
      <div><h2 className="text-xl font-semibold text-slate-800">Claim Your Payment</h2><p className="text-sm text-slate-500">A buyer has paid for your listing</p></div>
      <Card className="bg-emerald-50 border-emerald-200"><CardContent className="p-4 text-center"><p className="text-sm text-emerald-700">Amount in Escrow</p><p className="text-3xl font-bold text-emerald-600">{formatCurrency(listing.price)}</p></CardContent></Card>
      <Card className="bg-slate-50">
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xl">👖</div>
            <div><h3 className="font-semibold text-slate-800">{listing.title}</h3><p className="text-sm text-slate-500">From: Instagram</p><p className="text-lg font-bold text-emerald-600">{formatCurrency(listing.price)}</p></div>
          </div>
        </CardContent>
      </Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Buyer Information</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-slate-600">Name</span><span>Adaeze Okonkwo</span></div>
          <div className="flex justify-between"><span className="text-slate-600">Phone</span><span>+234 803 456 7890</span></div>
          <div className="flex justify-between"><span className="text-slate-600">Delivery Address</span><span className="text-right">15 Marina Road, Lagos</span></div>
        </CardContent>
      </Card>
      <Alert><AlertDescription>To receive payment, you need to provide your bank account details for verification.</AlertDescription></Alert>
      <Button className="w-full bg-blue-600 hover:bg-blue-700" size="lg" onClick={() => setCurrentStep(1)}>Continue to Bank Details <ChevronRight className="w-4 h-4 ml-2" /></Button>
    </div>
  );

  const renderSellerBank = () => (
    <div className="p-6 space-y-6">
      <div><h2 className="text-xl font-semibold text-slate-800">Bank Account Details</h2><p className="text-sm text-slate-500">Enter your account for payout</p></div>
      <div className="space-y-4">
        <div><Label>Select Bank</Label>
          <Select value={sellerBankInfo.bankName} onValueChange={(value) => setSellerBankInfo({ ...sellerBankInfo, bankName: value, verified: false, accountName: '' })}>
            <SelectTrigger><SelectValue placeholder="Choose your bank" /></SelectTrigger>
            <SelectContent>{NIGERIAN_BANKS.map((bank) => (<SelectItem key={bank.code} value={bank.name}>{bank.name}</SelectItem>))}</SelectContent>
          </Select>
        </div>
        <div><Label>Account Number</Label><Input type="text" maxLength={10} value={sellerBankInfo.accountNumber} onChange={(e) => setSellerBankInfo({ ...sellerBankInfo, accountNumber: e.target.value.replace(/\D/g, ''), verified: false, accountName: '' })} placeholder="Enter 10-digit account number" /></div>
        {sellerBankInfo.bankName && sellerBankInfo.accountNumber.length === 10 && !sellerBankInfo.verified && (
          <Button variant="outline" className="w-full" onClick={handleBankVerification} disabled={isLoading}>{isLoading ? 'Verifying...' : 'Verify Account'}</Button>
        )}
        {sellerBankInfo.verified && (<Alert className="bg-emerald-50 border-emerald-200"><Check className="w-4 h-4 text-emerald-600" /><AlertDescription className="text-emerald-700"><strong>Account Name:</strong> {sellerBankInfo.accountName}</AlertDescription></Alert>)}
      </div>
      <Card className="bg-slate-50">
        <CardContent className="p-4 space-y-2">
          <div className="flex justify-between text-sm"><span className="text-slate-600">Escrow Amount</span><span>{formatCurrency(listing.price)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-slate-600">Platform Fee (2%)</span><span>-{formatCurrency(listing.price * 0.02)}</span></div>
          <Separator />
          <div className="flex justify-between font-bold"><span>You'll Receive</span><span className="text-emerald-600">{formatCurrency(listing.price * 0.98)}</span></div>
        </CardContent>
      </Card>
      <Button className="w-full bg-emerald-600 hover:bg-emerald-700" size="lg" onClick={() => setCurrentStep(2)} disabled={!sellerBankInfo.verified || isLoading}>{isLoading ? 'Processing...' : 'Accept Order & Confirm Bank Details'}</Button>
      <p className="text-center text-xs text-slate-500">Payment will be released after buyer confirms delivery</p>
    </div>
  );

  const renderSellerShip = () => (
    <div className="p-6 space-y-6">
      <div><h2 className="text-xl font-semibold text-slate-800">Ship Your Order</h2><p className="text-sm text-slate-500">Provide shipping details to the buyer</p></div>
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <h4 className="font-semibold text-blue-800 flex items-center gap-2"><MapPin className="w-4 h-4" /> Delivery Address</h4>
          <p className="mt-2 text-blue-700">Adaeze Okonkwo<br />15 Marina Road, Lagos Island, Lagos<br />+234 803 456 7890</p>
          <Button variant="outline" size="sm" className="mt-3"><Copy className="w-3 h-3 mr-2" /> Copy Address</Button>
        </CardContent>
      </Card>
      <div className="space-y-4">
        <div><Label>Shipping Carrier</Label><Select defaultValue="gig"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="gig">GIG Logistics</SelectItem><SelectItem value="dhl">DHL</SelectItem><SelectItem value="fedex">FedEx</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div>
        <div><Label>Tracking Number</Label><Input placeholder="Enter tracking number" /></div>
        <div><Label>Estimated Delivery</Label><Select defaultValue="2-4"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1-2">1-2 business days</SelectItem><SelectItem value="2-4">2-4 business days</SelectItem><SelectItem value="5-7">5-7 business days</SelectItem></SelectContent></Select></div>
      </div>
      <Button className="w-full bg-blue-600 hover:bg-blue-700" size="lg" onClick={() => setCurrentStep(3)} disabled={isLoading}>{isLoading ? 'Processing...' : 'Confirm Shipment'}</Button>
      <Alert><AlertDescription>The buyer will be notified and can track their order. Payment will be released after they confirm delivery.</AlertDescription></Alert>
    </div>
  );

  const renderSellerComplete = () => (
    <div className="p-6 text-center space-y-6">
      <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto text-4xl">🎉</div>
      <div><h2 className="text-xl font-semibold text-slate-800">Payment Released!</h2><p className="text-sm text-slate-500">The buyer has confirmed delivery</p></div>
      <Card className="bg-emerald-50 border-emerald-200 text-left">
        <CardContent className="p-4 space-y-2">
          <div className="flex justify-between text-sm"><span className="text-slate-600">Transaction ID</span><span className="font-mono">{transaction?.id || 'ESC-NG-2024-001'}</span></div>
          <div className="flex justify-between text-sm"><span className="text-slate-600">Sale Amount</span><span>{formatCurrency(listing.price)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-slate-600">Platform Fee</span><span>-{formatCurrency(listing.price * 0.02)}</span></div>
          <Separator />
          <div className="flex justify-between font-bold text-lg"><span>Payout Amount</span><span className="text-emerald-600">{formatCurrency(listing.price * 0.98)}</span></div>
        </CardContent>
      </Card>
      <Card><CardContent className="p-4 text-left">
        <h4 className="font-semibold text-slate-800 mb-2">Payout Details</h4>
        <div className="space-y-1 text-sm">
          <p><span className="text-slate-600">Bank:</span> {sellerBankInfo.bankName || 'Zenith Bank'}</p>
          <p><span className="text-slate-600">Account:</span> ****{sellerBankInfo.accountNumber.slice(-4) || '1234'}</p>
          <p><span className="text-slate-600">Name:</span> {sellerBankInfo.accountName || 'MERCHANT CHEENA ENTERPRISES'}</p>
          <p><span className="text-slate-600">Status:</span> <Badge className="bg-emerald-100 text-emerald-700">Processing</Badge></p>
        </div>
      </CardContent></Card>
      <Alert><AlertDescription>Your payout of {formatCurrency(listing.price * 0.98)} will arrive in your account within 24 hours.</AlertDescription></Alert>
      <Button className="w-full" variant="outline">View All Transactions</Button>
    </div>
  );

  const renderBuyerFlow = () => {
    switch (currentStep) {
      case 0: return renderBuyerReview();
      case 1: return renderBuyerPayment();
      case 2: return renderBuyerEscrow();
      case 3: return renderBuyerShipping();
      case 4: return renderBuyerVerify();
      case 5: return renderBuyerComplete();
      default: return null;
    }
  };

  const renderSellerFlow = () => {
    switch (currentStep) {
      case 0: return renderSellerClaim();
      case 1: return renderSellerBank();
      case 2: return renderSellerShip();
      case 3: return renderSellerComplete();
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white p-5 text-center">
          <h1 className="text-xl font-semibold flex items-center justify-center gap-2">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center"><Shield className="w-5 h-5" /></div>
            EscrowProtect
          </h1>
          {mode === 'seller' && <Badge className="mt-2 bg-amber-500">Seller Portal</Badge>}
        </div>
        <ProgressSteps currentStep={currentStep} steps={mode === 'buyer' ? buyerSteps : sellerSteps} />
        <div className="min-h-96">{mode === 'buyer' ? renderBuyerFlow() : renderSellerFlow()}</div>
      </div>
    </div>
  );
}

export default App
