import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { MapPin, User, Star, Phone, Clock, Check, ArrowLeft, ChevronRight, Navigation, Banknote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import api from '@/api/client';
import type { Agent, AgentTransactionType } from '@/types';

const formatCurrency = (amount: number, currency: string = 'NGN') => {
  if (currency === 'NGN') return `₦${amount.toLocaleString()}`;
  return `${currency} ${amount.toLocaleString()}`;
};

export function AgentCashFlow() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const escrowId = searchParams.get('escrow');
  const type = (searchParams.get('type') as AgentTransactionType) || 'cash_in';

  const [step, setStep] = useState<'location' | 'agents' | 'assigned' | 'complete'>('location');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  // Mock amount - in production, fetch from escrow
  const amount = 375000;
  const currency = 'NGN';

  useEffect(() => {
    // Get user's location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        () => {
          // Default to Lagos if location not available
          setLocation({ latitude: 6.5244, longitude: 3.3792 });
        }
      );
    }
  }, []);

  const findAgents = async () => {
    if (!location) return;
    setLoading(true);
    setError(null);

    try {
      const nearbyAgents = await api.findNearbyAgents(location.latitude, location.longitude);
      setAgents(nearbyAgents);
      setStep('agents');
    } catch (err) {
      // Mock agents for demo
      setAgents([
        {
          id: 'agent-001',
          name: 'Chukwuemeka Okonkwo',
          phone: '+234 803 456 7890',
          location: { address: '15 Marina Road, Lagos Island', latitude: 6.4541, longitude: 3.4082 },
          rating: 4.8,
          totalTransactions: 1250,
          available: true,
          floatBalance: 5000000,
        },
        {
          id: 'agent-002',
          name: 'Adaeze Nwosu',
          phone: '+234 805 123 4567',
          location: { address: '42 Broad Street, Lagos', latitude: 6.4531, longitude: 3.3958 },
          rating: 4.6,
          totalTransactions: 890,
          available: true,
          floatBalance: 3500000,
        },
        {
          id: 'agent-003',
          name: 'Ibrahim Musa',
          phone: '+234 809 876 5432',
          location: { address: '8 Tinubu Square, Lagos', latitude: 6.4498, longitude: 3.3903 },
          rating: 4.9,
          totalTransactions: 2100,
          available: true,
          floatBalance: 8000000,
        },
      ]);
      setStep('agents');
    } finally {
      setLoading(false);
    }
  };

  const selectAgent = async (agent: Agent) => {
    if (!escrowId || !location) return;
    setSelectedAgent(agent);
    setLoading(true);
    setError(null);

    try {
      const result = await api.requestAgentTransaction(escrowId, type, amount, location);
      if (result.success) {
        setTransactionId(result.transaction_id);
        setStep('assigned');
      }
    } catch (err) {
      // Mock success for demo
      setTransactionId(`TXN-${Date.now()}`);
      setStep('assigned');
    } finally {
      setLoading(false);
    }
  };

  const confirmTransaction = async () => {
    if (!transactionId) return;
    setLoading(true);

    try {
      await api.confirmAgentTransaction(transactionId, 'receipt-confirmed');
      setStep('complete');
    } catch (err) {
      setStep('complete');
    } finally {
      setLoading(false);
    }
  };

  const getStepProgress = () => {
    switch (step) {
      case 'location': return 25;
      case 'agents': return 50;
      case 'assigned': return 75;
      case 'complete': return 100;
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
              <h1 className="font-semibold text-slate-800">
                {type === 'cash_in' ? 'Cash Deposit' : 'Cash Withdrawal'}
              </h1>
              <p className="text-xs text-slate-500">Find a nearby agent</p>
            </div>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="max-w-lg mx-auto px-4 py-3">
        <Progress value={getStepProgress()} className="h-2" />
        <div className="flex justify-between mt-2 text-xs text-slate-500">
          <span className={step === 'location' ? 'text-blue-600 font-medium' : ''}>Location</span>
          <span className={step === 'agents' ? 'text-blue-600 font-medium' : ''}>Select Agent</span>
          <span className={step === 'assigned' ? 'text-blue-600 font-medium' : ''}>Meet Agent</span>
          <span className={step === 'complete' ? 'text-blue-600 font-medium' : ''}>Complete</span>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Amount Card */}
        <Card className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-80">
                  {type === 'cash_in' ? 'Amount to Deposit' : 'Amount to Withdraw'}
                </p>
                <p className="text-2xl font-bold">{formatCurrency(amount, currency)}</p>
              </div>
              <Banknote className="w-10 h-10 opacity-80" />
            </div>
          </CardContent>
        </Card>

        {/* Step: Location */}
        {step === 'location' && (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-blue-600" />
                  Your Location
                </CardTitle>
              </CardHeader>
              <CardContent>
                {location ? (
                  <div className="space-y-3">
                    <div className="bg-slate-100 rounded-lg p-3 text-sm">
                      <p className="text-slate-600">
                        We'll find agents near your current location
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Lat: {location.latitude.toFixed(4)}, Lng: {location.longitude.toFixed(4)}
                      </p>
                    </div>
                    <Button className="w-full" onClick={findAgents} disabled={loading}>
                      {loading ? 'Finding Agents...' : 'Find Nearby Agents'}
                      <Navigation className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="text-sm text-slate-500 mt-2">Getting your location...</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-amber-50 border-amber-200">
              <CardContent className="p-4">
                <p className="text-sm text-amber-800">
                  <strong>How it works:</strong> Find a nearby agent, visit their location, and complete your {type === 'cash_in' ? 'deposit' : 'withdrawal'} in person. The agent will verify the transaction.
                </p>
              </CardContent>
            </Card>
          </>
        )}

        {/* Step: Select Agent */}
        {step === 'agents' && (
          <>
            <p className="text-sm text-slate-600">
              {agents.length} agents found near you
            </p>
            {agents.map((agent) => (
              <Card
                key={agent.id}
                className={`cursor-pointer transition-all ${
                  selectedAgent?.id === agent.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'hover:border-blue-300'
                }`}
                onClick={() => selectAgent(agent)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center">
                      <User className="w-6 h-6 text-slate-500" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-slate-800">{agent.name}</h3>
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                          <span className="text-sm font-medium">{agent.rating}</span>
                        </div>
                      </div>
                      <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3" />
                        {agent.location.address}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                        <span>{agent.totalTransactions.toLocaleString()} transactions</span>
                        {agent.available && (
                          <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
                            Available
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </>
        )}

        {/* Step: Assigned */}
        {step === 'assigned' && selectedAgent && (
          <>
            <Card className="bg-emerald-50 border-emerald-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-emerald-700 mb-2">
                  <Check className="w-5 h-5" />
                  <span className="font-medium">Agent Assigned</span>
                </div>
                <p className="text-sm text-emerald-600">
                  Please visit the agent location to complete your transaction.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Agent Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 bg-slate-200 rounded-full flex items-center justify-center">
                    <User className="w-7 h-7 text-slate-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800">{selectedAgent.name}</h3>
                    <div className="flex items-center gap-1 text-sm text-slate-500">
                      <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                      {selectedAgent.rating} rating
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    <span>{selectedAgent.location.address}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-slate-400" />
                    <span>{selectedAgent.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span>Transaction expires in 4 hours</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => window.open(`tel:${selectedAgent.phone}`)}>
                    <Phone className="w-4 h-4 mr-2" />
                    Call
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => window.open(`https://maps.google.com/?q=${selectedAgent.location.latitude},${selectedAgent.location.longitude}`)}>
                    <Navigation className="w-4 h-4 mr-2" />
                    Directions
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-50">
              <CardContent className="p-4">
                <p className="text-sm text-slate-600 mb-3">
                  <strong>Transaction Code:</strong>
                </p>
                <div className="bg-white border-2 border-dashed border-slate-300 rounded-lg p-4 text-center">
                  <p className="font-mono text-2xl font-bold tracking-wider">{transactionId}</p>
                  <p className="text-xs text-slate-500 mt-1">Show this code to the agent</p>
                </div>
              </CardContent>
            </Card>

            <Button className="w-full bg-emerald-600 hover:bg-emerald-700" size="lg" onClick={confirmTransaction} disabled={loading}>
              {loading ? 'Confirming...' : 'I Have Completed the Transaction'}
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </>
        )}

        {/* Step: Complete */}
        {step === 'complete' && (
          <Card className="text-center">
            <CardContent className="p-8">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-emerald-600" />
              </div>
              <h2 className="text-xl font-semibold text-slate-800 mb-2">Transaction Complete</h2>
              <p className="text-slate-600 mb-4">
                Your {type === 'cash_in' ? 'deposit' : 'withdrawal'} of {formatCurrency(amount, currency)} has been processed.
              </p>
              <div className="bg-slate-50 rounded-lg p-4 mb-6">
                <p className="text-sm text-slate-500">Transaction ID</p>
                <p className="font-mono">{transactionId}</p>
              </div>
              <Button className="w-full" onClick={() => navigate(`/escrow/${escrowId}`)}>
                Back to Escrow
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default AgentCashFlow;
