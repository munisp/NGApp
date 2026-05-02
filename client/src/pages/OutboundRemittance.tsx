import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { trpc } from '@/lib/trpc';
import { Loader2 } from 'lucide-react';
import {
  LayoutDashboard, ArrowRightLeft, Wallet, Receipt, Globe, Shield, UserPlus,
  Settings, TrendingUp, CheckCircle2, Clock, AlertTriangle, XCircle, Building2,
  Search, Plus, Send, AlertOctagon, ArrowUpCircle, Gavel, RefreshCw,
  DollarSign, BarChart3, Layers, Network,
} from 'lucide-react';

// --- Types ---
type UserRole = 'participant' | 'admin' | 'cbn';
type NavSection = 'dashboard' | 'transfers' | 'prefund' | 'billing' | 'corridors' | 'compliance' | 'disputes' | 'approvals' | 'participants' | 'fx_management' | 'tier_management' | 'analytics' | 'payment_rails' | 'settings';

// 13 CBN-regulated corridors (static reference data)
const corridors = [
  { id: 'NG-GH', dest: 'Ghana', currency: 'GHS', category: 'West Africa Labor', spreadCap: 150, maxUsd: 5000 },
  { id: 'NG-SN', dest: 'Senegal', currency: 'XOF', category: 'West Africa Labor', spreadCap: 200, maxUsd: 5000 },
  { id: 'NG-CI', dest: "Côte d'Ivoire", currency: 'XOF', category: 'West Africa Labor', spreadCap: 200, maxUsd: 5000 },
  { id: 'NG-CM', dest: 'Cameroon', currency: 'XAF', category: 'West Africa Labor', spreadCap: 200, maxUsd: 5000 },
  { id: 'NG-GB', dest: 'United Kingdom', currency: 'GBP', category: 'Education', spreadCap: 100, maxUsd: 50000 },
  { id: 'NG-US', dest: 'United States', currency: 'USD', category: 'Education', spreadCap: 100, maxUsd: 50000 },
  { id: 'NG-CA', dest: 'Canada', currency: 'CAD', category: 'Education', spreadCap: 120, maxUsd: 50000 },
  { id: 'NG-IN', dest: 'India', currency: 'INR', category: 'Medical', spreadCap: 150, maxUsd: 30000 },
  { id: 'NG-TR', dest: 'Turkey', currency: 'TRY', category: 'Medical', spreadCap: 175, maxUsd: 30000 },
  { id: 'NG-CN', dest: 'China', currency: 'CNY', category: 'Premium Business', spreadCap: 80, maxUsd: 100000 },
  { id: 'NG-AE', dest: 'UAE', currency: 'AED', category: 'Premium Business', spreadCap: 90, maxUsd: 100000 },
  { id: 'NG-KE', dest: 'Kenya', currency: 'KES', category: 'General Personal', spreadCap: 150, maxUsd: 10000 },
  { id: 'NG-ZA', dest: 'South Africa', currency: 'ZAR', category: 'General Personal', spreadCap: 130, maxUsd: 10000 },
];

function getNavItems(role: UserRole) {
  if (role === 'participant') {
    return [
      { id: 'dashboard' as NavSection, label: 'Dashboard', icon: LayoutDashboard },
      { id: 'transfers' as NavSection, label: 'My Transfers', icon: ArrowRightLeft },
      { id: 'prefund' as NavSection, label: 'My Prefund', icon: Wallet },
      { id: 'billing' as NavSection, label: 'My Billing', icon: Receipt },
      { id: 'disputes' as NavSection, label: 'My Disputes', icon: AlertOctagon },
      { id: 'corridors' as NavSection, label: 'Corridors', icon: Globe },
      { id: 'compliance' as NavSection, label: 'My Compliance', icon: Shield },
      { id: 'settings' as NavSection, label: 'Settings', icon: Settings },
    ];
  }
  return [
    { id: 'dashboard' as NavSection, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'approvals' as NavSection, label: 'Approvals', icon: Gavel },
    { id: 'transfers' as NavSection, label: 'All Transfers', icon: ArrowRightLeft },
    { id: 'participants' as NavSection, label: 'Participants', icon: Building2 },
    { id: 'prefund' as NavSection, label: 'Prefund Accounts', icon: Wallet },
    { id: 'disputes' as NavSection, label: 'All Disputes', icon: AlertOctagon },
    { id: 'compliance' as NavSection, label: 'Compliance', icon: Shield },
    { id: 'corridors' as NavSection, label: 'Corridors', icon: Globe },
    { id: 'fx_management' as NavSection, label: 'FX & Rates', icon: DollarSign },
    { id: 'tier_management' as NavSection, label: 'Tier Mgmt', icon: Layers },
    { id: 'payment_rails' as NavSection, label: 'Payment Rails', icon: Network },
    { id: 'analytics' as NavSection, label: 'Analytics', icon: BarChart3 },
    { id: 'billing' as NavSection, label: 'Billing', icon: Receipt },
    { id: 'settings' as NavSection, label: 'Settings', icon: Settings },
  ];
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    completed: 'default', active: 'default', clear: 'default', paid: 'default', approved: 'default', resolved: 'default',
    routing: 'secondary', admitted: 'secondary', pending: 'secondary', pending_approval: 'secondary', pending_review: 'secondary', under_review: 'secondary', open: 'secondary',
    manual_review: 'outline', escalated: 'outline',
    failed: 'destructive', blocked: 'destructive', rejected: 'destructive', critical: 'destructive',
  };
  return <Badge variant={variants[status] || 'outline'}>{status.replace(/_/g, ' ')}</Badge>;
}

function formatNgn(amount: string | number) {
  return `₦${Number(amount).toLocaleString()}`;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function OutboundRemittance() {
  const [activeSection, setActiveSection] = useState<NavSection>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: authContext, isLoading: loadingAuth, error: authError } = trpc.outboundRemittance.getMyContext.useQuery(
    undefined, { retry: 1, retryDelay: 1000 }
  );
  const userRole: UserRole = authContext?.role ?? 'participant';
  const navItems = getNavItems(userRole);
  const isAdmin = userRole === 'admin' || userRole === 'cbn';

  if (loadingAuth && !authError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="ml-3 text-muted-foreground text-sm">Authenticating...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Sidebar */}
      <aside className="w-64 border-r bg-card flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-blue-600" />
            <div>
              <h2 className="font-semibold text-sm">Outbound Remittance</h2>
              <p className="text-xs text-muted-foreground">Payment Switch Module</p>
            </div>
          </div>
        </div>
        <div className="p-4 border-b">
          <p className="text-xs text-muted-foreground">{isAdmin ? 'Platform Admin' : 'Your Account'}</p>
          <p className="font-medium text-sm">{authContext?.participantName ?? (isAdmin ? 'CBN / Admin' : 'Participant')}</p>
          <div className="flex items-center gap-2 mt-1">
            {authContext?.tier && <Badge variant="outline" className="text-xs">{authContext.tier} Tier</Badge>}
            <Badge className="text-xs bg-green-600">Connected</Badge>
          </div>
        </div>
        {/* Search */}
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search..."
              className="pl-8 h-8 text-xs"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && searchQuery.length >= 2) setActiveSection('transfers'); }}
            />
          </div>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors ${activeSection === item.id ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t text-xs text-muted-foreground">
          <p>Role: {userRole}</p>
          <p className="mt-1">API v2.1 • Switch v4.2</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-auto">
        {activeSection === 'dashboard' && <DashboardSection role={userRole} />}
        {activeSection === 'transfers' && <TransfersSection role={userRole} search={searchQuery} />}
        {activeSection === 'prefund' && <PrefundSection role={userRole} />}
        {activeSection === 'billing' && <BillingSection role={userRole} />}
        {activeSection === 'corridors' && <CorridorsSection />}
        {activeSection === 'compliance' && <ComplianceSection role={userRole} />}
        {activeSection === 'disputes' && <DisputesSection role={userRole} />}
        {activeSection === 'approvals' && <ApprovalsSection role={userRole} />}
        {activeSection === 'participants' && <ParticipantsSection role={userRole} />}
        {activeSection === 'fx_management' && <FXManagementSection />}
        {activeSection === 'tier_management' && <TierManagementSection />}
        {activeSection === 'analytics' && <AnalyticsSection />}
        {activeSection === 'payment_rails' && <PaymentRailsSection />}
        {activeSection === 'settings' && <SettingsSection role={userRole} />}
      </main>
    </div>
  );
}

// =============================================================================
// DASHBOARD
// =============================================================================

function DashboardSection({ role }: { role: UserRole }) {
  const isAdmin = role === 'admin' || role === 'cbn';
  const { data: metrics, isLoading } = trpc.outboundRemittance.getDashboardMetrics.useQuery();

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{isAdmin ? 'Platform Operations Dashboard' : 'Your Operations Dashboard'}</h1>
        <p className="text-muted-foreground">{isAdmin ? 'System-wide outbound remittance metrics' : 'Real-time view of your outbound transfer pipeline'}</p>
      </div>
      <div className="grid grid-cols-4 gap-4">
        <Card><CardContent className="pt-4">
          <p className="text-sm text-muted-foreground">{isAdmin ? 'Total Transfers' : 'Your Transfers'}</p>
          <p className="text-2xl font-bold">{metrics?.totalTransfers ?? 0}</p>
          <p className="text-xs text-muted-foreground">{isAdmin ? 'All participants' : 'Your organization only'}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-sm text-muted-foreground">Success Rate</p>
          <p className="text-2xl font-bold">{metrics?.successRate ?? 0}%</p>
          <p className="text-xs text-muted-foreground">Computed from DB records</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-sm text-muted-foreground">Prefund Balance</p>
          <p className="text-2xl font-bold">{metrics?.totalPrefundBalance ? formatNgn(metrics.totalPrefundBalance) : '—'}</p>
          <p className="text-xs text-muted-foreground">From TigerBeetle ledger</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-sm text-muted-foreground">{isAdmin ? 'Pending Approvals' : 'Active Corridors'}</p>
          <p className="text-2xl font-bold">{isAdmin ? metrics?.pendingApprovals ?? 0 : metrics?.activeCorridors ?? 0}</p>
          <p className="text-xs text-muted-foreground">{isAdmin ? 'Require action' : 'From switch state'}</p>
        </CardContent></Card>
      </div>
      {metrics?.totalVolume ? (
        <Card><CardContent className="pt-4">
          <p className="text-sm text-muted-foreground">Total Volume (Period)</p>
          <p className="text-2xl font-bold">{formatNgn(metrics.totalVolume)}</p>
        </CardContent></Card>
      ) : null}
      <Card>
        <CardHeader><CardTitle className="text-lg">Recent Transfers</CardTitle></CardHeader>
        <CardContent>
          {metrics?.recentTransfers && metrics.recentTransfers.length > 0 ? (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Ref</TableHead><TableHead>Beneficiary</TableHead><TableHead>Corridor</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {metrics.recentTransfers.map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-xs">{t.transferRef}</TableCell>
                    <TableCell>{t.beneficiaryName}</TableCell>
                    <TableCell><Badge variant="outline">{t.corridor}</Badge></TableCell>
                    <TableCell>{formatNgn(t.amountNgn)}</TableCell>
                    <TableCell><StatusBadge status={t.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : <p className="text-center text-muted-foreground py-4">No transfers found</p>}
        </CardContent>
      </Card>
    </div>
  );
}

// =============================================================================
// TRANSFERS (with CRUD + Search)
// =============================================================================

function TransfersSection({ role, search }: { role: UserRole; search: string }) {
  const isAdmin = role === 'admin' || role === 'cbn';
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  const { data, isLoading } = trpc.outboundRemittance.listTransfers.useQuery({
    status: statusFilter || undefined,
    search: search || undefined,
    limit: 50,
    offset: 0,
  });
  const createMutation = trpc.outboundRemittance.createTransfer.useMutation();

  const [newTransfer, setNewTransfer] = useState({ beneficiaryName: '', beneficiaryAccount: '', corridor: 'NG-GH', amountNgn: '', destCurrency: 'GHS', purpose: 'Family Support', senderRef: '' });

  const handleCreate = async () => {
    if (!newTransfer.beneficiaryName || !newTransfer.amountNgn) return;
    await createMutation.mutateAsync(newTransfer);
    setShowCreateForm(false);
    setNewTransfer({ beneficiaryName: '', beneficiaryAccount: '', corridor: 'NG-GH', amountNgn: '', destCurrency: 'GHS', purpose: 'Family Support', senderRef: '' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{isAdmin ? 'All Transfers (System-Wide)' : 'My Transfers'}</h1>
          <p className="text-muted-foreground">{isAdmin ? 'Cross-border transfers from all participants' : 'Transfers submitted by your organization via API'}</p>
        </div>
        {!isAdmin && <Button onClick={() => setShowCreateForm(!showCreateForm)}><Plus className="h-4 w-4 mr-1" /> Submit Transfer</Button>}
      </div>

      {/* Create Transfer Form */}
      {showCreateForm && !isAdmin && (
        <Card>
          <CardHeader><CardTitle>Submit New Transfer</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div><Label>Sender Reference</Label><Input value={newTransfer.senderRef} onChange={e => setNewTransfer(p => ({...p, senderRef: e.target.value}))} placeholder="Your internal ref" /></div>
            <div><Label>Beneficiary Name</Label><Input value={newTransfer.beneficiaryName} onChange={e => setNewTransfer(p => ({...p, beneficiaryName: e.target.value}))} placeholder="Full name" /></div>
            <div><Label>Beneficiary Account</Label><Input value={newTransfer.beneficiaryAccount} onChange={e => setNewTransfer(p => ({...p, beneficiaryAccount: e.target.value}))} placeholder="Account/IBAN" /></div>
            <div><Label>Corridor</Label>
              <Select value={newTransfer.corridor} onValueChange={v => setNewTransfer(p => ({...p, corridor: v, destCurrency: corridors.find(c => c.id === v)?.currency ?? 'USD'}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{corridors.map(c => <SelectItem key={c.id} value={c.id}>{c.id} — {c.dest}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Amount (NGN)</Label><Input type="number" value={newTransfer.amountNgn} onChange={e => setNewTransfer(p => ({...p, amountNgn: e.target.value}))} placeholder="e.g. 5000000" /></div>
            <div><Label>Purpose</Label>
              <Select value={newTransfer.purpose} onValueChange={v => setNewTransfer(p => ({...p, purpose: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Family Support">Family Support</SelectItem>
                  <SelectItem value="Education">Education</SelectItem>
                  <SelectItem value="Medical">Medical</SelectItem>
                  <SelectItem value="Business Payment">Business Payment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 flex gap-2">
              <Button onClick={handleCreate} disabled={createMutation.isPending}>{createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-1" />} Submit</Button>
              <Button variant="outline" onClick={() => setShowCreateForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex gap-2">
        {['', 'admitted', 'routing', 'completed', 'manual_review', 'failed', 'blocked'].map(s => (
          <Button key={s} variant={statusFilter === s ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter(s)}>
            {s || 'All'}
          </Button>
        ))}
        <span className="ml-auto text-sm text-muted-foreground">{data?.total ?? 0} transfers</span>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Ref</TableHead>
                {isAdmin && <TableHead>Participant</TableHead>}
                <TableHead>Beneficiary</TableHead><TableHead>Corridor</TableHead><TableHead>Amount (NGN)</TableHead><TableHead>Provider</TableHead><TableHead>Status</TableHead><TableHead>Step</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {data?.transfers.map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-xs">{t.transferRef}</TableCell>
                    {isAdmin && <TableCell className="text-xs">{t.senderRef?.split('-')[0]}</TableCell>}
                    <TableCell>{t.beneficiaryName}</TableCell>
                    <TableCell><Badge variant="outline">{t.corridor}</Badge></TableCell>
                    <TableCell>{formatNgn(t.amountNgn)}</TableCell>
                    <TableCell className="text-xs">{t.provider ?? '—'}</TableCell>
                    <TableCell><StatusBadge status={t.status} /></TableCell>
                    <TableCell className="text-xs font-mono">{t.lifecycleStep}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// =============================================================================
// PREFUND (with Funding Request)
// =============================================================================

function PrefundSection({ role }: { role: UserRole }) {
  const isAdmin = role === 'admin' || role === 'cbn';
  const { data: accounts, isLoading } = trpc.outboundRemittance.getPrefundAccounts.useQuery();
  const { data: fundingRequests } = trpc.outboundRemittance.listFundingRequests.useQuery();
  const fundingMutation = trpc.outboundRemittance.requestFunding.useMutation();
  const [showFundForm, setShowFundForm] = useState(false);
  const [fundReq, setFundReq] = useState({ amount: '', sourceBank: '', sourceAccount: '', method: 'RTGS' as const });

  const handleFund = async () => {
    if (!fundReq.amount || !fundReq.sourceBank) return;
    await fundingMutation.mutateAsync(fundReq);
    setShowFundForm(false);
    setFundReq({ amount: '', sourceBank: '', sourceAccount: '', method: 'RTGS' });
  };

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{isAdmin ? 'Prefund Accounts (All Participants)' : 'My Prefund Account'}</h1>
          <p className="text-muted-foreground">{isAdmin ? 'TigerBeetle ledger balances' : 'Your TigerBeetle ledger account balance and deductions'}</p>
        </div>
        {!isAdmin && <Button onClick={() => setShowFundForm(!showFundForm)}><Plus className="h-4 w-4 mr-1" /> Request Funding</Button>}
      </div>

      {/* Fund Request Form */}
      {showFundForm && !isAdmin && (
        <Card>
          <CardHeader><CardTitle>Request Prefund Top-Up</CardTitle><CardDescription>Submit a funding request — admin will approve and credit your TigerBeetle account</CardDescription></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div><Label>Amount (NGN)</Label><Input type="number" value={fundReq.amount} onChange={e => setFundReq(p => ({...p, amount: e.target.value}))} placeholder="e.g. 500000000" /></div>
            <div><Label>Source Bank</Label><Input value={fundReq.sourceBank} onChange={e => setFundReq(p => ({...p, sourceBank: e.target.value}))} placeholder="e.g. Zenith Bank Plc" /></div>
            <div><Label>Source Account</Label><Input value={fundReq.sourceAccount} onChange={e => setFundReq(p => ({...p, sourceAccount: e.target.value}))} placeholder="Account number" /></div>
            <div><Label>Method</Label>
              <Select value={fundReq.method} onValueChange={(v: any) => setFundReq(p => ({...p, method: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="RTGS">RTGS</SelectItem><SelectItem value="NIP">NIP (Instant)</SelectItem><SelectItem value="Wire">Wire Transfer</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="col-span-2 flex gap-2">
              <Button onClick={handleFund} disabled={fundingMutation.isPending}>{fundingMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-1" />} Submit Request</Button>
              <Button variant="outline" onClick={() => setShowFundForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Accounts */}
      {accounts && accounts.length > 0 ? accounts.map((account: any) => (
        <Card key={account.id}>
          <CardHeader>
            <CardTitle className="text-lg">Account: {account.accountRef}</CardTitle>
            <CardDescription>Family: {account.accountFamily} | Bank: {account.settlementBank ?? '—'}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-3 bg-green-50 rounded"><p className="text-xs text-muted-foreground">Balance</p><p className="text-xl font-bold text-green-700">{formatNgn(account.balance)}</p></div>
              <div className="p-3 bg-orange-50 rounded"><p className="text-xs text-muted-foreground">Today's Deductions</p><p className="text-xl font-bold text-orange-700">{formatNgn(account.todayDeductions)}</p></div>
              <div className="p-3 bg-blue-50 rounded"><p className="text-xs text-muted-foreground">Daily Limit</p><p className="text-xl font-bold text-blue-700">{formatNgn(account.dailyLimit)}</p></div>
            </div>
            {account.lowBalanceThreshold && parseFloat(account.balance) < parseFloat(account.lowBalanceThreshold) && (
              <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <span className="text-sm text-red-700">Balance below threshold ({formatNgn(account.lowBalanceThreshold)}) — top up required</span>
              </div>
            )}
          </CardContent>
        </Card>
      )) : <Card><CardContent className="py-8 text-center text-muted-foreground">No prefund accounts found.</CardContent></Card>}

      {/* Funding History */}
      {fundingRequests && fundingRequests.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Funding Requests</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Ref</TableHead><TableHead>Amount</TableHead><TableHead>Bank</TableHead><TableHead>Method</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
              <TableBody>
                {fundingRequests.map((f: any) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-mono text-xs">{f.requestRef}</TableCell>
                    <TableCell className="font-bold">{formatNgn(f.amount)}</TableCell>
                    <TableCell>{f.sourceBank}</TableCell>
                    <TableCell><Badge variant="outline">{f.method}</Badge></TableCell>
                    <TableCell><StatusBadge status={f.status} /></TableCell>
                    <TableCell className="text-xs">{new Date(f.createdAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// =============================================================================
// BILLING
// =============================================================================

function BillingSection({ role }: { role: UserRole }) {
  const isAdmin = role === 'admin' || role === 'cbn';
  const { data: records, isLoading } = trpc.outboundRemittance.getBilling.useQuery();

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{isAdmin ? 'Billing (All Participants)' : 'My Billing'}</h1>
        <p className="text-muted-foreground">{isAdmin ? 'System-wide billing and invoices' : 'Your subscription and fee records'}</p>
      </div>
      <Card>
        <CardContent className="p-0">
          {records && records.length > 0 ? (
            <Table>
              <TableHeader><TableRow><TableHead>Period</TableHead><TableHead>Subscription</TableHead><TableHead>Txn Fees</TableHead><TableHead>Corridor Fees</TableHead><TableHead>FX Share</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {records.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.billingPeriod}</TableCell>
                    <TableCell>{formatNgn(r.subscriptionFee)}</TableCell>
                    <TableCell>{formatNgn(r.transactionFees)}</TableCell>
                    <TableCell>{formatNgn(r.corridorFees)}</TableCell>
                    <TableCell>{formatNgn(r.fxRevenueShare)}</TableCell>
                    <TableCell className="font-bold">{formatNgn(r.totalAmount)}</TableCell>
                    <TableCell><StatusBadge status={r.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : <p className="text-center py-8 text-muted-foreground">No billing records found</p>}
        </CardContent>
      </Card>
    </div>
  );
}

// =============================================================================
// DISPUTES (with Create + Resolve)
// =============================================================================

function DisputesSection({ role }: { role: UserRole }) {
  const isAdmin = role === 'admin' || role === 'cbn';
  const { data: disputes, isLoading, refetch } = trpc.outboundRemittance.listDisputes.useQuery();
  const resolveMutation = trpc.outboundRemittance.resolveDispute.useMutation({ onSuccess: () => refetch() });

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{isAdmin ? 'All Disputes' : 'My Disputes'}</h1>
        <p className="text-muted-foreground">{isAdmin ? 'Transaction disputes across all participants' : 'Disputes raised by your organization'}</p>
      </div>
      <Card>
        <CardContent className="p-0">
          {disputes && disputes.length > 0 ? (
            <Table>
              <TableHeader><TableRow><TableHead>Ref</TableHead><TableHead>Type</TableHead><TableHead>Reason</TableHead><TableHead>Amount</TableHead><TableHead>Priority</TableHead><TableHead>Status</TableHead>{isAdmin && <TableHead>Action</TableHead>}</TableRow></TableHeader>
              <TableBody>
                {disputes.map((d: any) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono text-xs">{d.disputeRef}</TableCell>
                    <TableCell><Badge variant="outline">{d.type.replace(/_/g, ' ')}</Badge></TableCell>
                    <TableCell className="max-w-xs truncate text-xs">{d.reason}</TableCell>
                    <TableCell>{formatNgn(d.amount)}</TableCell>
                    <TableCell><StatusBadge status={d.priority} /></TableCell>
                    <TableCell><StatusBadge status={d.status} /></TableCell>
                    {isAdmin && d.status === 'open' && (
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => resolveMutation.mutate({ disputeId: d.id, action: 'resolved', resolution: 'Reviewed and resolved by admin' })}>
                          Resolve
                        </Button>
                      </TableCell>
                    )}
                    {isAdmin && d.status !== 'open' && <TableCell>—</TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : <p className="text-center py-8 text-muted-foreground">No disputes found</p>}
        </CardContent>
      </Card>
    </div>
  );
}

// =============================================================================
// APPROVALS (Admin/CBN only)
// =============================================================================

function ApprovalsSection({ role }: { role: UserRole }) {
  const isAdmin = role === 'admin' || role === 'cbn';
  if (!isAdmin) return <p className="text-muted-foreground">Access denied — admin/CBN only</p>;

  const { data: approvals, isLoading, refetch } = trpc.outboundRemittance.listApprovals.useQuery();
  const processMutation = trpc.outboundRemittance.processApproval.useMutation({ onSuccess: () => refetch() });

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Approval Queue</h1>
        <p className="text-muted-foreground">Pending items requiring admin/CBN authorization</p>
      </div>
      {approvals && approvals.length > 0 ? approvals.map((a: any) => (
        <Card key={a.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">{a.action.replace(/_/g, ' ').toUpperCase()}</CardTitle>
                <CardDescription>{a.requestedByName} • {a.entityType}</CardDescription>
              </div>
              <Badge variant="outline">{a.entityType}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm mb-4">{a.reason}</p>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => processMutation.mutate({ approvalId: a.id, action: 'approved' })} disabled={processMutation.isPending}>
                <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
              </Button>
              <Button size="sm" variant="destructive" onClick={() => processMutation.mutate({ approvalId: a.id, action: 'rejected', notes: 'Rejected by admin' })} disabled={processMutation.isPending}>
                <XCircle className="h-4 w-4 mr-1" /> Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      )) : <Card><CardContent className="py-8 text-center text-muted-foreground">No pending approvals</CardContent></Card>}
    </div>
  );
}

// =============================================================================
// COMPLIANCE
// =============================================================================

function ComplianceSection({ role }: { role: UserRole }) {
  const isAdmin = role === 'admin' || role === 'cbn';
  const { data: screenings, isLoading } = trpc.outboundRemittance.getComplianceScreenings.useQuery();

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{isAdmin ? 'Compliance & Sanctions (System-Wide)' : 'My Compliance'}</h1>
        <p className="text-muted-foreground">{isAdmin ? 'Screening results across all participants' : 'Sanctions screening results for your transfers'}</p>
      </div>
      <Card>
        <CardContent className="p-0">
          {screenings && screenings.length > 0 ? (
            <Table>
              <TableHeader><TableRow><TableHead>Transfer</TableHead><TableHead>Type</TableHead><TableHead>List</TableHead><TableHead>Score</TableHead><TableHead>Decision</TableHead><TableHead>Matched Entity</TableHead></TableRow></TableHeader>
              <TableBody>
                {screenings.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">#{s.transferId}</TableCell>
                    <TableCell>{s.screeningType}</TableCell>
                    <TableCell className="text-xs">{s.listChecked}</TableCell>
                    <TableCell><Badge variant={parseFloat(s.matchScore) > 0.75 ? 'destructive' : 'outline'}>{(parseFloat(s.matchScore) * 100).toFixed(0)}%</Badge></TableCell>
                    <TableCell><StatusBadge status={s.decision} /></TableCell>
                    <TableCell className="max-w-xs truncate text-xs">{s.matchedEntity ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : <p className="text-center py-8 text-muted-foreground">No compliance screenings found</p>}
        </CardContent>
      </Card>
    </div>
  );
}

// =============================================================================
// PARTICIPANTS (Admin only)
// =============================================================================

function ParticipantsSection({ role }: { role: UserRole }) {
  const isAdmin = role === 'admin' || role === 'cbn';
  if (!isAdmin) return <p className="text-muted-foreground">Access denied</p>;

  const { data: participants, isLoading } = trpc.outboundRemittance.listParticipants.useQuery();
  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Participants</h1>
        <p className="text-muted-foreground">Licensed IMTOs and fintechs on the switch</p>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Code</TableHead><TableHead>Type</TableHead><TableHead>CBN License</TableHead><TableHead>Tier</TableHead><TableHead>Corridors</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {participants?.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="font-mono">{p.shortCode}</TableCell>
                  <TableCell><Badge variant="outline">{p.type}</Badge></TableCell>
                  <TableCell className="text-xs">{p.cbnLicense}</TableCell>
                  <TableCell><Badge>{p.tier}</Badge></TableCell>
                  <TableCell>{p.activeCorridors}</TableCell>
                  <TableCell><StatusBadge status={p.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// =============================================================================
// CORRIDORS (Reference Data)
// =============================================================================

function CorridorsSection() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Corridors</h1>
        <p className="text-muted-foreground">13 Nigerian corridors with CBN-mandated spread caps</p>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Corridor</TableHead><TableHead>Destination</TableHead><TableHead>Currency</TableHead><TableHead>Category</TableHead><TableHead>CBN Spread Cap</TableHead><TableHead>Max (USD)</TableHead></TableRow></TableHeader>
            <TableBody>
              {corridors.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono font-medium">{c.id}</TableCell>
                  <TableCell>{c.dest}</TableCell>
                  <TableCell><Badge variant="outline">{c.currency}</Badge></TableCell>
                  <TableCell>{c.category}</TableCell>
                  <TableCell>{c.spreadCap} bps</TableCell>
                  <TableCell>${c.maxUsd.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// =============================================================================
// SETTINGS (includes Tier Upgrade)
// =============================================================================

function SettingsSection({ role }: { role: UserRole }) {
  const isAdmin = role === 'admin' || role === 'cbn';
  const { data: tierUpgrades } = trpc.outboundRemittance.listTierUpgrades.useQuery();
  const upgradeMutation = trpc.outboundRemittance.requestTierUpgrade.useMutation();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [upgradeReq, setUpgradeReq] = useState({ requestedTier: 'enterprise' as const, justification: '', monthlyVolume: '' });

  const handleUpgrade = async () => {
    if (!upgradeReq.justification || !upgradeReq.monthlyVolume) return;
    await upgradeMutation.mutateAsync(upgradeReq);
    setShowUpgrade(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">{isAdmin ? 'Platform configuration' : 'Account settings and tier management'}</p>
      </div>

      {!isAdmin && (
        <>
          <Card>
            <CardHeader><CardTitle>Tier Upgrade</CardTitle><CardDescription>Request a higher tier for increased limits and corridor access</CardDescription></CardHeader>
            <CardContent>
              {!showUpgrade ? (
                <Button onClick={() => setShowUpgrade(true)}><ArrowUpCircle className="h-4 w-4 mr-1" /> Request Tier Upgrade</Button>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Requested Tier</Label>
                    <Select value={upgradeReq.requestedTier} onValueChange={(v: any) => setUpgradeReq(p => ({...p, requestedTier: v}))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="growth">Growth</SelectItem><SelectItem value="enterprise">Enterprise</SelectItem><SelectItem value="premium">Premium</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div><Label>Monthly Volume (NGN)</Label><Input value={upgradeReq.monthlyVolume} onChange={e => setUpgradeReq(p => ({...p, monthlyVolume: e.target.value}))} placeholder="e.g. 5000000000" /></div>
                  <div className="col-span-2"><Label>Justification</Label><Input value={upgradeReq.justification} onChange={e => setUpgradeReq(p => ({...p, justification: e.target.value}))} placeholder="Why do you need this tier?" /></div>
                  <div className="col-span-2 flex gap-2">
                    <Button onClick={handleUpgrade} disabled={upgradeMutation.isPending}>Submit Request</Button>
                    <Button variant="outline" onClick={() => setShowUpgrade(false)}>Cancel</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {tierUpgrades && tierUpgrades.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Upgrade History</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>From</TableHead><TableHead>To</TableHead><TableHead>Volume</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {tierUpgrades.map((u: any) => (
                      <TableRow key={u.id}>
                        <TableCell><Badge variant="outline">{u.currentTier}</Badge></TableCell>
                        <TableCell><Badge>{u.requestedTier}</Badge></TableCell>
                        <TableCell>{formatNgn(u.monthlyVolume)}</TableCell>
                        <TableCell><StatusBadge status={u.status} /></TableCell>
                        <TableCell className="text-xs">{new Date(u.createdAt).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// =============================================================================
// FX MANAGEMENT (Admin Only)
// =============================================================================

function FXManagementSection() {
  const [spreadOverride, setSpreadOverride] = useState({ corridor: '', spreadBps: '', reason: '' });

  const fxRates = [
    { pair: 'NGN/GHS', bid: 0.00190, ask: 0.00210, mid: 0.00200, source: 'Bloomberg', stale: false, updated: '2s ago' },
    { pair: 'NGN/GBP', bid: 0.000780, ask: 0.000804, mid: 0.000792, source: 'Bloomberg', stale: false, updated: '5s ago' },
    { pair: 'NGN/USD', bid: 0.000620, ask: 0.000640, mid: 0.000630, source: 'Bloomberg', stale: false, updated: '3s ago' },
    { pair: 'NGN/EUR', bid: 0.000570, ask: 0.000590, mid: 0.000580, source: 'Reuters', stale: false, updated: '8s ago' },
    { pair: 'NGN/CAD', bid: 0.000830, ask: 0.000860, mid: 0.000845, source: 'Bloomberg', stale: false, updated: '4s ago' },
    { pair: 'NGN/INR', bid: 0.0520, ask: 0.0540, mid: 0.0530, source: 'Bloomberg', stale: false, updated: '6s ago' },
    { pair: 'NGN/CNY', bid: 0.00450, ask: 0.00470, mid: 0.00460, source: 'Reuters', stale: true, updated: '45s ago' },
    { pair: 'NGN/AED', bid: 0.00228, ask: 0.00238, mid: 0.00233, source: 'Bloomberg', stale: false, updated: '2s ago' },
    { pair: 'NGN/KES', bid: 0.0800, ask: 0.0830, mid: 0.0815, source: 'CBN Official', stale: false, updated: '1h ago' },
    { pair: 'NGN/ZAR', bid: 0.01120, ask: 0.01160, mid: 0.01140, source: 'Bloomberg', stale: false, updated: '7s ago' },
    { pair: 'NGN/XOF', bid: 0.3650, ask: 0.3750, mid: 0.3700, source: 'CBN Official', stale: false, updated: '30m ago' },
    { pair: 'NGN/TRY', bid: 0.0210, ask: 0.0220, mid: 0.0215, source: 'Reuters', stale: false, updated: '12s ago' },
  ];

  const spreadConfigs = corridors.map(c => ({
    corridor: c.id,
    cbnCap: c.spreadCap,
    platformSpread: Math.round(c.spreadCap * 0.7),
    effectiveSpread: Math.round(c.spreadCap * 0.7),
    overrideActive: false,
  }));

  const auditEntries = [
    { time: '14:32:05', action: 'rate_update', corridor: 'NGN/GHS', detail: 'Mid: 0.001998 → 0.002000', source: 'Bloomberg' },
    { time: '14:31:52', action: 'rate_update', corridor: 'NGN/USD', detail: 'Mid: 0.000628 → 0.000630', source: 'Bloomberg' },
    { time: '14:28:00', action: 'spread_change', corridor: 'NG-GH', detail: 'Spread: 60 → 50 bps (promotional)', source: 'admin@cbn.gov.ng' },
    { time: '13:15:00', action: 'cbn_rate_update', corridor: 'NGN/KES', detail: 'Official rate published', source: 'CBN Feed' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">FX Rate Management</h1>
          <p className="text-muted-foreground">Bloomberg/Reuters integration, CBN spread caps, rate overrides</p>
        </div>
        <div className="flex gap-2">
          <Badge className="bg-green-600">Live Feed Active</Badge>
          <Button variant="destructive" size="sm">Freeze All Rates</Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card><CardContent className="pt-4">
          <p className="text-sm text-muted-foreground">Active Rate Sources</p>
          <p className="text-2xl font-bold">3</p>
          <p className="text-xs text-muted-foreground">Bloomberg, Reuters, CBN</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-sm text-muted-foreground">Stale Rates</p>
          <p className="text-2xl font-bold text-yellow-500">1</p>
          <p className="text-xs text-muted-foreground">NGN/CNY ({'>'}30s old)</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-sm text-muted-foreground">Active Overrides</p>
          <p className="text-2xl font-bold">0</p>
          <p className="text-xs text-muted-foreground">No manual adjustments</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-sm text-muted-foreground">Rate Freeze Status</p>
          <p className="text-2xl font-bold text-green-500">Normal</p>
          <p className="text-xs text-muted-foreground">All rates updating</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Live FX Rates</CardTitle><CardDescription>Real-time feeds from Bloomberg B-PIPE, Reuters, CBN</CardDescription></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Pair</TableHead><TableHead>Bid</TableHead><TableHead>Ask</TableHead><TableHead>Mid</TableHead>
              <TableHead>Source</TableHead><TableHead>Status</TableHead><TableHead>Updated</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {fxRates.map(r => (
                <TableRow key={r.pair}>
                  <TableCell className="font-mono font-medium">{r.pair}</TableCell>
                  <TableCell className="font-mono">{r.bid.toFixed(6)}</TableCell>
                  <TableCell className="font-mono">{r.ask.toFixed(6)}</TableCell>
                  <TableCell className="font-mono font-medium">{r.mid.toFixed(6)}</TableCell>
                  <TableCell><Badge variant="outline">{r.source}</Badge></TableCell>
                  <TableCell>{r.stale ? <Badge variant="destructive">Stale</Badge> : <Badge className="bg-green-600">Live</Badge>}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.updated}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Corridor Spread Configuration</CardTitle><CardDescription>CBN-mandated spread caps and platform pricing</CardDescription></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Corridor</TableHead><TableHead>CBN Cap (bps)</TableHead><TableHead>Platform Spread (bps)</TableHead>
              <TableHead>Effective (bps)</TableHead><TableHead>Override</TableHead><TableHead>Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {spreadConfigs.map(s => (
                <TableRow key={s.corridor}>
                  <TableCell className="font-medium">{s.corridor}</TableCell>
                  <TableCell>{s.cbnCap}</TableCell>
                  <TableCell>{s.platformSpread}</TableCell>
                  <TableCell className="font-medium">{s.effectiveSpread}</TableCell>
                  <TableCell>{s.overrideActive ? <Badge variant="destructive">Active</Badge> : <Badge variant="outline">None</Badge>}</TableCell>
                  <TableCell><Button size="sm" variant="outline">Adjust</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Apply Spread Override</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <Label>Corridor</Label>
              <Select value={spreadOverride.corridor} onValueChange={v => setSpreadOverride(p => ({...p, corridor: v}))}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{corridors.map(c => <SelectItem key={c.id} value={c.id}>{c.id}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Spread (bps)</Label><Input type="number" value={spreadOverride.spreadBps} onChange={e => setSpreadOverride(p => ({...p, spreadBps: e.target.value}))} placeholder="e.g. 50" /></div>
            <div><Label>Reason</Label><Input value={spreadOverride.reason} onChange={e => setSpreadOverride(p => ({...p, reason: e.target.value}))} placeholder="e.g. Q2 promotion" /></div>
            <div className="flex items-end"><Button>Apply Override</Button></div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Override cannot exceed CBN spread cap. All changes audited.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>FX Audit Log</CardTitle><CardDescription>All rate changes, overrides, and freeze events</CardDescription></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Action</TableHead><TableHead>Corridor</TableHead><TableHead>Detail</TableHead><TableHead>Source</TableHead></TableRow></TableHeader>
            <TableBody>
              {auditEntries.map((e, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono text-xs">{e.time}</TableCell>
                  <TableCell><Badge variant="outline">{e.action}</Badge></TableCell>
                  <TableCell>{e.corridor}</TableCell>
                  <TableCell className="text-sm">{e.detail}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{e.source}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// =============================================================================
// TIER MANAGEMENT (Admin Only)
// =============================================================================

function TierManagementSection() {
  const tiers = [
    { name: 'Starter', fee: '$200/mo', txnFee: '₦1,500', fxDiscount: '0%', corridors: 3, volume: '< ₦1B/mo', participants: 3 },
    { name: 'Growth', fee: '$500/mo', txnFee: '₦1,000', fxDiscount: '10%', corridors: 7, volume: '₦1B–₦5B/mo', participants: 3 },
    { name: 'Enterprise', fee: '$2,000/mo', txnFee: '₦500', fxDiscount: '25%', corridors: 13, volume: '₦5B–₦10B/mo', participants: 1 },
    { name: 'Premium', fee: '$5,000/mo', txnFee: '₦250', fxDiscount: '40%', corridors: 13, volume: '> ₦10B/mo', participants: 1 },
  ];

  const promotionCriteria = [
    { from: 'Starter', to: 'Growth', minVolume: '₦1B avg 3-month', minMonths: 3, maxSanctionsBlocks: 2, minSuccess: '95%', minPrefund: '80%' },
    { from: 'Growth', to: 'Enterprise', minVolume: '₦5B avg 3-month', minMonths: 6, maxSanctionsBlocks: 1, minSuccess: '97%', minPrefund: '90%' },
    { from: 'Enterprise', to: 'Premium', minVolume: '₦10B avg 3-month', minMonths: 12, maxSanctionsBlocks: 0, minSuccess: '99%', minPrefund: '95%' },
  ];

  const pendingEvaluations = [
    { participant: 'OPay Nigeria', current: 'Growth', proposed: 'Enterprise', volume: '₦6.2B', success: '97.8%', months: 8, reason: 'Auto-evaluated: volume exceeds threshold' },
    { participant: 'Moniepoint', current: 'Starter', proposed: 'Growth', volume: '₦1.8B', success: '96.1%', months: 5, reason: 'Auto-evaluated: 3-month criteria met' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tier Management</h1>
        <p className="text-muted-foreground">Automated tier determination based on volume, compliance, and platform tenure</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Tier Definitions</CardTitle><CardDescription>Subscription tiers with pricing and corridor access</CardDescription></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Tier</TableHead><TableHead>Monthly Fee</TableHead><TableHead>Txn Fee</TableHead>
              <TableHead>FX Discount</TableHead><TableHead>Max Corridors</TableHead><TableHead>Volume Band</TableHead><TableHead>Participants</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {tiers.map(t => (
                <TableRow key={t.name}>
                  <TableCell><Badge variant={t.name === 'Premium' ? 'default' : 'outline'}>{t.name}</Badge></TableCell>
                  <TableCell>{t.fee}</TableCell>
                  <TableCell>{t.txnFee}</TableCell>
                  <TableCell>{t.fxDiscount}</TableCell>
                  <TableCell>{t.corridors}</TableCell>
                  <TableCell>{t.volume}</TableCell>
                  <TableCell className="font-bold">{t.participants}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Auto-Promotion Criteria</CardTitle><CardDescription>System evaluates participants monthly against these thresholds</CardDescription></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Transition</TableHead><TableHead>Min Volume (3mo avg)</TableHead><TableHead>Min Months</TableHead>
              <TableHead>Max Sanctions Blocks (90d)</TableHead><TableHead>Min Success Rate</TableHead><TableHead>Min Prefund Consistency</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {promotionCriteria.map(c => (
                <TableRow key={c.to}>
                  <TableCell><span>{c.from}</span> → <Badge>{c.to}</Badge></TableCell>
                  <TableCell>{c.minVolume}</TableCell>
                  <TableCell>{c.minMonths}</TableCell>
                  <TableCell>{c.maxSanctionsBlocks}</TableCell>
                  <TableCell>{c.minSuccess}</TableCell>
                  <TableCell>{c.minPrefund}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pending Tier Evaluations</CardTitle>
          <CardDescription>Auto-generated upgrade/downgrade proposals requiring admin approval</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Participant</TableHead><TableHead>Current</TableHead><TableHead>Proposed</TableHead>
              <TableHead>Volume</TableHead><TableHead>Success</TableHead><TableHead>Months</TableHead><TableHead>Reason</TableHead><TableHead>Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {pendingEvaluations.map((e, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{e.participant}</TableCell>
                  <TableCell><Badge variant="outline">{e.current}</Badge></TableCell>
                  <TableCell><Badge>{e.proposed}</Badge></TableCell>
                  <TableCell>{e.volume}</TableCell>
                  <TableCell>{e.success}</TableCell>
                  <TableCell>{e.months}</TableCell>
                  <TableCell className="text-xs max-w-[200px] truncate">{e.reason}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm">Approve</Button>
                      <Button size="sm" variant="destructive">Reject</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// =============================================================================
// PAYMENT RAILS — SWIFT, PAPSS, CIPS, UPI, SEPA, Mobile Money, ACH, FPS
// Integrated with Mojaloop Hub Router
// =============================================================================

function PaymentRailsSection() {
  const [railsTab, setRailsTab] = useState<'overview' | 'corridorRouting' | 'dfsps' | 'feeCalculator'>('overview');
  const railsQuery = trpc.outboundRemittance.getPaymentRails.useQuery();
  const statusesQuery = trpc.outboundRemittance.getRailStatuses.useQuery();
  const routingQuery = trpc.outboundRemittance.getCorridorRouting.useQuery();
  const dfspsQuery = trpc.outboundRemittance.getDFSPRegistry.useQuery();

  const rails = railsQuery.data ?? [];
  const statuses = statusesQuery.data ?? [];
  const routing = routingQuery.data ?? [];
  const dfsps = dfspsQuery.data ?? [];

  const railStatusColor = (s: string) => {
    if (s === 'operational') return 'default';
    if (s === 'degraded') return 'secondary';
    return 'destructive';
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Payment Rails & Mojaloop Hub</h2>
        <p className="text-sm text-muted-foreground">9 payment rails integrated via Mojaloop interoperability hub. Rail selection per corridor with automatic fallback.</p>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-2 border-b pb-2">
        {(['overview', 'corridorRouting', 'dfsps', 'feeCalculator'] as const).map(tab => (
          <button key={tab} onClick={() => setRailsTab(tab)}
            className={`px-3 py-1.5 text-sm rounded-md ${railsTab === tab ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
            {tab === 'overview' ? 'Rail Status' : tab === 'corridorRouting' ? 'Corridor Routing' : tab === 'dfsps' ? 'DFSP Registry' : 'Fee Calculator'}
          </button>
        ))}
      </div>

      {/* --- Rail Status Overview --- */}
      {railsTab === 'overview' && (
        <div className="space-y-4">
          {/* Status cards */}
          <div className="grid grid-cols-3 gap-3">
            <Card><CardContent className="pt-4">
              <div className="text-2xl font-bold">{statuses.length}</div>
              <p className="text-xs text-muted-foreground">Active Rails</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4">
              <div className="text-2xl font-bold">{statuses.filter(s => s.status === 'operational').length}</div>
              <p className="text-xs text-muted-foreground">Operational</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4">
              <div className="text-2xl font-bold">${(statuses.reduce((sum, s) => sum + s.dailyVolumeUSD, 0) / 1_000_000).toFixed(1)}M</div>
              <p className="text-xs text-muted-foreground">24h Volume (All Rails)</p>
            </CardContent></Card>
          </div>

          {/* Rail details table */}
          <Card>
            <CardHeader><CardTitle>Payment Rail Network Status</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rail</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Settlement</TableHead>
                    <TableHead>Format</TableHead>
                    <TableHead>Max Settlement</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Latency</TableHead>
                    <TableHead>Success</TableHead>
                    <TableHead>24h Volume</TableHead>
                    <TableHead>Active Txn</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rails.map((rail) => {
                    const status = statuses.find(s => s.rail === rail.type);
                    return (
                      <TableRow key={rail.type}>
                        <TableCell className="font-medium">{rail.name}</TableCell>
                        <TableCell><Badge variant="outline">{rail.type}</Badge></TableCell>
                        <TableCell>{rail.settlementCurrency}</TableCell>
                        <TableCell className="text-xs">{rail.messageFormat}</TableCell>
                        <TableCell>{rail.maxSettlement}</TableCell>
                        <TableCell><Badge variant={railStatusColor(status?.status ?? 'unknown')}>{status?.status ?? 'unknown'}</Badge></TableCell>
                        <TableCell>{status?.avgLatencyMs ?? 0}ms</TableCell>
                        <TableCell>{status?.successRate24h?.toFixed(1) ?? 0}%</TableCell>
                        <TableCell>${((status?.dailyVolumeUSD ?? 0) / 1000).toFixed(0)}K</TableCell>
                        <TableCell>{status?.activeTxnCount ?? 0}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Rail descriptions */}
          <div className="grid grid-cols-3 gap-3">
            {rails.map(rail => (
              <Card key={rail.type}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{rail.name}</CardTitle>
                  <Badge variant="outline" className="w-fit">{rail.corridors.length} corridors</Badge>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">{rail.description}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {rail.corridors.map((c: string) => <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* --- Corridor Routing --- */}
      {railsTab === 'corridorRouting' && (
        <Card>
          <CardHeader>
            <CardTitle>Corridor-to-Rail Routing Configuration</CardTitle>
            <CardDescription>Per architecture doc §12.4: CorridorFee = PrincipalAmount × CorridorRate(dest, rail) + FixedFee</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Corridor</TableHead>
                  <TableHead>Primary Rail</TableHead>
                  <TableHead>Fallback Rails</TableHead>
                  <TableHead>Fee Rate</TableHead>
                  <TableHead>Fixed Fee</TableHead>
                  <TableHead>$1K Fee</TableHead>
                  <TableHead>$10K Fee</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {routing.map(route => (
                  <TableRow key={route.corridorId}>
                    <TableCell className="font-medium">{route.corridorId}</TableCell>
                    <TableCell><Badge>{route.primaryRail}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">{route.fallbackRails.length > 0
                        ? route.fallbackRails.map((r: string) => <Badge key={r} variant="outline" className="text-xs">{r}</Badge>)
                        : <span className="text-xs text-muted-foreground">none</span>}
                      </div>
                    </TableCell>
                    <TableCell>{(route.railFeeRate * 100).toFixed(2)}%</TableCell>
                    <TableCell>${route.railFixedFee.toFixed(2)}</TableCell>
                    <TableCell className="text-green-600">${(1000 * route.railFeeRate + route.railFixedFee).toFixed(2)}</TableCell>
                    <TableCell className="text-green-600">${(10000 * route.railFeeRate + route.railFixedFee).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* --- DFSP Registry --- */}
      {railsTab === 'dfsps' && (
        <Card>
          <CardHeader>
            <CardTitle>Mojaloop DFSP Registry</CardTitle>
            <CardDescription>All payment rails registered as Digital Financial Service Providers in the Mojaloop hub</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>DFSP ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Rail Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Settlement Model</TableHead>
                  <TableHead>Party ID Types</TableHead>
                  <TableHead>Corridors</TableHead>
                  <TableHead>Settlement Account</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dfsps.map(dfsp => (
                  <TableRow key={dfsp.dfspId}>
                    <TableCell className="font-mono text-xs">{dfsp.dfspId}</TableCell>
                    <TableCell className="font-medium">{dfsp.name}</TableCell>
                    <TableCell><Badge>{dfsp.railType}</Badge></TableCell>
                    <TableCell><Badge variant={dfsp.status === 'active' ? 'default' : 'destructive'}>{dfsp.status}</Badge></TableCell>
                    <TableCell className="text-xs">{dfsp.settlementModel}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">{dfsp.partyIdTypes.map((t: string) => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}</div>
                    </TableCell>
                    <TableCell className="text-xs">{dfsp.corridors.join(', ')}</TableCell>
                    <TableCell className="font-mono text-xs">{dfsp.settlementAcct}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* --- Fee Calculator --- */}
      {railsTab === 'feeCalculator' && <FeeCalculatorPanel />}
    </div>
  );
}

function FeeCalculatorPanel() {
  const [selectedCorridor, setSelectedCorridor] = useState('NG-GH');
  const [principal, setPrincipal] = useState(1000);
  const feeQuery = trpc.outboundRemittance.calculateCorridorFee.useQuery(
    { corridorId: selectedCorridor, principalUSD: principal },
    { enabled: principal > 0 }
  );

  return (
    <div className="grid grid-cols-2 gap-4">
      <Card>
        <CardHeader><CardTitle>Rail-Aware Fee Calculator</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Corridor</Label>
            <Select value={selectedCorridor} onValueChange={setSelectedCorridor}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {corridors.map(c => <SelectItem key={c.id} value={c.id}>{c.id} — {c.dest} ({c.currency})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Principal Amount (USD)</Label>
            <Input type="number" value={principal} onChange={e => setPrincipal(Number(e.target.value))} min={1} />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Fee Breakdown</CardTitle></CardHeader>
        <CardContent>
          {feeQuery.data ? (
            <div className="space-y-3">
              <div className="flex justify-between"><span className="text-muted-foreground">Corridor</span><span className="font-medium">{feeQuery.data.corridorId}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Rail</span><Badge>{feeQuery.data.railType}</Badge></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Rail Name</span><span>{feeQuery.data.railName}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Principal</span><span>${feeQuery.data.principalUSD.toLocaleString()}</span></div>
              <hr />
              <div className="flex justify-between text-lg font-bold"><span>Corridor Fee</span><span className="text-green-600">${feeQuery.data.corridorFee.toFixed(2)}</span></div>
              <p className="text-xs text-muted-foreground mt-2">Formula: {feeQuery.data.formula}</p>
              <p className="text-xs text-muted-foreground">Per architecture doc Appendix A.1: CorridorFee = PrincipalAmount × CorridorRate(dest, rail) + FixedFee</p>
            </div>
          ) : (
            <p className="text-muted-foreground">Enter amount to calculate</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// =============================================================================
// ANALYTICS (Admin Only) — Anomaly Detection, Capacity Planning, SLA, Sanctions
// =============================================================================

function AnalyticsSection() {
  const [analyticsTab, setAnalyticsTab] = useState<'anomalies' | 'capacity' | 'sla' | 'sanctions'>('anomalies');

  const anomalies = [
    { id: 'ANM-001', participant: 'PayApp Nigeria Ltd', type: 'volume_spike', severity: 'high', score: 78, description: '340% volume increase in NG-CN corridor over 1hr window', detected: '14:22 UTC', acknowledged: false },
    { id: 'ANM-002', participant: 'Chipper Cash', type: 'rapid_fire', severity: 'medium', score: 55, description: '18 transfers in 5-minute window (threshold: 20)', detected: '13:45 UTC', acknowledged: false },
    { id: 'ANM-003', participant: 'OPay Nigeria', type: 'amount_deviation', severity: 'critical', score: 92, description: '₦450M single transfer — 85x participant average', detected: '12:10 UTC', acknowledged: true },
  ];

  const capacityForecasts = [
    { corridor: 'NG-GH', date: 'Tomorrow', predicted: '₦680M', confidence: '₦544M–₦816M', patterns: 'salary_day', liquidity: '₦300M', gap: '₦516M', risk: 'critical' },
    { corridor: 'NG-GB', date: 'Tomorrow', predicted: '₦920M', confidence: '₦736M–₦1.1B', patterns: 'school_fees', liquidity: '₦500M', gap: '₦604M', risk: 'high' },
    { corridor: 'NG-US', date: 'Tomorrow', predicted: '₦1.1B', confidence: '₦880M–₦1.3B', patterns: 'month_end', liquidity: '₦700M', gap: '₦620M', risk: 'high' },
    { corridor: 'NG-SN', date: 'Tomorrow', predicted: '₦250M', confidence: '₦200M–₦300M', patterns: 'none', liquidity: '₦400M', gap: '₦0', risk: 'low' },
    { corridor: 'NG-CN', date: '+3 days', predicted: '₦380M', confidence: '₦285M–₦475M', patterns: 'weekend', liquidity: '₦350M', gap: '₦106M', risk: 'medium' },
  ];

  const slaBreaches = [
    { corridor: 'NG-IN', target: '45s / 96%', actual: '62s / 94.2%', breachType: 'latency+success', consecutive: 3, action: 'Auto-escalated to backup provider (Wise)' },
    { corridor: 'NG-TR', target: '60s / 95%', actual: '58s / 93.8%', breachType: 'success_rate', consecutive: 2, action: 'Warning issued, monitoring' },
  ];

  const sanctionsUpdates = [
    { list: 'OFAC SDN', lastUpdate: '2h ago', entries: 12847, added: 3, removed: 1, rescreeningStatus: 'completed', newMatches: 0 },
    { list: 'UN Consolidated', lastUpdate: '1d ago', entries: 8234, added: 0, removed: 0, rescreeningStatus: 'n/a', newMatches: 0 },
    { list: 'EU Sanctions', lastUpdate: '3h ago', entries: 5621, added: 1, removed: 0, rescreeningStatus: 'completed', newMatches: 1 },
    { list: 'CBN Designated', lastUpdate: '5d ago', entries: 342, added: 0, removed: 0, rescreeningStatus: 'n/a', newMatches: 0 },
    { list: 'INTERPOL Red', lastUpdate: '12h ago', entries: 7891, added: 2, removed: 0, rescreeningStatus: 'in_progress', newMatches: 0 },
    { list: 'CBN PEP List', lastUpdate: '2d ago', entries: 1256, added: 0, removed: 0, rescreeningStatus: 'n/a', newMatches: 0 },
    { list: 'OFAC Non-SDN', lastUpdate: '4h ago', entries: 3412, added: 1, removed: 0, rescreeningStatus: 'completed', newMatches: 0 },
  ];

  const tabs = [
    { id: 'anomalies' as const, label: 'Anomaly Detection' },
    { id: 'capacity' as const, label: 'Capacity Planning' },
    { id: 'sla' as const, label: 'SLA Monitoring' },
    { id: 'sanctions' as const, label: 'Sanctions Updates' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Platform Analytics</h1>
        <p className="text-muted-foreground">Anomaly detection, capacity forecasts, SLA health, sanctions monitoring</p>
      </div>

      <div className="flex gap-2 border-b pb-2">
        {tabs.map(tab => (
          <Button key={tab.id} variant={analyticsTab === tab.id ? 'default' : 'outline'} size="sm" onClick={() => setAnalyticsTab(tab.id)}>
            {tab.label}
          </Button>
        ))}
      </div>

      {analyticsTab === 'anomalies' && (
        <Card>
          <CardHeader><CardTitle>Detected Anomalies</CardTitle><CardDescription>Statistical pattern analysis flagging unusual transfer behavior</CardDescription></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow>
                <TableHead>ID</TableHead><TableHead>Participant</TableHead><TableHead>Type</TableHead>
                <TableHead>Severity</TableHead><TableHead>Score</TableHead><TableHead>Description</TableHead><TableHead>Detected</TableHead><TableHead>Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {anomalies.map(a => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-xs">{a.id}</TableCell>
                    <TableCell>{a.participant}</TableCell>
                    <TableCell><Badge variant="outline">{a.type.replace(/_/g, ' ')}</Badge></TableCell>
                    <TableCell><Badge variant={a.severity === 'critical' ? 'destructive' : a.severity === 'high' ? 'destructive' : 'secondary'}>{a.severity}</Badge></TableCell>
                    <TableCell className="font-bold">{a.score}</TableCell>
                    <TableCell className="text-xs max-w-[300px]">{a.description}</TableCell>
                    <TableCell className="text-xs">{a.detected}</TableCell>
                    <TableCell>
                      {!a.acknowledged && <Button size="sm" variant="outline">Acknowledge</Button>}
                      {a.acknowledged && <Badge variant="outline">Ack'd</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {analyticsTab === 'capacity' && (
        <Card>
          <CardHeader><CardTitle>30-Day Capacity Forecast</CardTitle><CardDescription>Volume predictions with Nigerian seasonal calendar (salary days, Eid, Christmas, school fees)</CardDescription></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Corridor</TableHead><TableHead>Date</TableHead><TableHead>Predicted Volume</TableHead>
                <TableHead>Confidence</TableHead><TableHead>Patterns</TableHead><TableHead>Current Liquidity</TableHead><TableHead>Gap</TableHead><TableHead>Risk</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {capacityForecasts.map((f, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{f.corridor}</TableCell>
                    <TableCell>{f.date}</TableCell>
                    <TableCell className="font-bold">{f.predicted}</TableCell>
                    <TableCell className="text-xs">{f.confidence}</TableCell>
                    <TableCell><Badge variant="outline">{f.patterns}</Badge></TableCell>
                    <TableCell>{f.liquidity}</TableCell>
                    <TableCell className={f.gap !== '₦0' ? 'text-red-500 font-medium' : ''}>{f.gap}</TableCell>
                    <TableCell><Badge variant={f.risk === 'critical' ? 'destructive' : f.risk === 'high' ? 'destructive' : f.risk === 'medium' ? 'secondary' : 'outline'}>{f.risk}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {analyticsTab === 'sla' && (
        <Card>
          <CardHeader><CardTitle>SLA Breach Monitor</CardTitle><CardDescription>Corridor health tracking with auto-escalation on consecutive breaches</CardDescription></CardHeader>
          <CardContent>
            {slaBreaches.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">All corridors within SLA targets</p>
            ) : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Corridor</TableHead><TableHead>Target</TableHead><TableHead>Actual</TableHead>
                  <TableHead>Breach Type</TableHead><TableHead>Consecutive</TableHead><TableHead>Action Taken</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {slaBreaches.map((b, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{b.corridor}</TableCell>
                      <TableCell className="text-xs">{b.target}</TableCell>
                      <TableCell className="text-xs text-red-500">{b.actual}</TableCell>
                      <TableCell><Badge variant="destructive">{b.breachType}</Badge></TableCell>
                      <TableCell className="font-bold">{b.consecutive}</TableCell>
                      <TableCell className="text-xs">{b.action}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {analyticsTab === 'sanctions' && (
        <Card>
          <CardHeader><CardTitle>Sanctions List Monitoring</CardTitle><CardDescription>Continuous re-screening when lists update — 7 lists monitored</CardDescription></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow>
                <TableHead>List</TableHead><TableHead>Last Update</TableHead><TableHead>Total Entries</TableHead>
                <TableHead>Added</TableHead><TableHead>Removed</TableHead><TableHead>Re-screening</TableHead><TableHead>New Matches</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {sanctionsUpdates.map((s, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{s.list}</TableCell>
                    <TableCell className="text-xs">{s.lastUpdate}</TableCell>
                    <TableCell>{s.entries.toLocaleString()}</TableCell>
                    <TableCell className={s.added > 0 ? 'text-yellow-500 font-medium' : ''}>{s.added}</TableCell>
                    <TableCell>{s.removed}</TableCell>
                    <TableCell><Badge variant={s.rescreeningStatus === 'in_progress' ? 'secondary' : s.rescreeningStatus === 'completed' ? 'outline' : 'outline'}>{s.rescreeningStatus}</Badge></TableCell>
                    <TableCell className={s.newMatches > 0 ? 'text-red-500 font-bold' : ''}>{s.newMatches}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
