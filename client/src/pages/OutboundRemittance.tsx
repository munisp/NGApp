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
} from 'lucide-react';

// --- Types ---
type UserRole = 'participant' | 'admin' | 'cbn';
type NavSection = 'dashboard' | 'transfers' | 'prefund' | 'billing' | 'corridors' | 'compliance' | 'disputes' | 'approvals' | 'participants' | 'settings';

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
