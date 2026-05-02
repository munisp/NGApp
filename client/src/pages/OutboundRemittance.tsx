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
  LayoutDashboard,
  ArrowRightLeft,
  Wallet,
  Receipt,
  Globe,
  Shield,
  UserPlus,
  Settings,
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Building2,
  Users,
  Landmark,
  Server,
  FileCheck,
  ChevronRight,
} from 'lucide-react';

// --- Types ---
type UserRole = 'participant' | 'admin' | 'cbn';
type NavSection = 'dashboard' | 'transfers' | 'prefund' | 'billing' | 'corridors' | 'compliance' | 'onboarding' | 'settings' | 'participants';

// 13 CBN-regulated corridors (static reference data — shared across roles)
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

// Role-based navigation: participants see own data, admins/CBN see system-wide
function getNavItems(role: UserRole) {
  const base = [
    { id: 'dashboard' as NavSection, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'transfers' as NavSection, label: role === 'participant' ? 'My Transfers' : 'All Transfers', icon: ArrowRightLeft },
  ];
  if (role === 'participant') {
    return [
      ...base,
      { id: 'prefund' as NavSection, label: 'My Prefund', icon: Wallet },
      { id: 'billing' as NavSection, label: 'My Billing', icon: Receipt },
      { id: 'corridors' as NavSection, label: 'Corridors', icon: Globe },
      { id: 'compliance' as NavSection, label: 'My Compliance', icon: Shield },
      { id: 'onboarding' as NavSection, label: 'My Onboarding', icon: UserPlus },
      { id: 'settings' as NavSection, label: 'Settings', icon: Settings },
    ];
  }
  // Admin / CBN
  return [
    ...base,
    { id: 'participants' as NavSection, label: 'Participants', icon: Building2 },
    { id: 'prefund' as NavSection, label: 'Prefund Accounts', icon: Wallet },
    { id: 'billing' as NavSection, label: 'Billing & Tiers', icon: Receipt },
    { id: 'corridors' as NavSection, label: 'Corridors', icon: Globe },
    { id: 'compliance' as NavSection, label: 'Compliance', icon: Shield },
    { id: 'onboarding' as NavSection, label: 'Onboarding Mgmt', icon: UserPlus },
    { id: 'settings' as NavSection, label: 'Settings', icon: Settings },
  ];
}

// --- Status Badge Helper ---
function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    completed: 'default',
    active: 'default',
    processing: 'secondary',
    pending: 'secondary',
    manual_review: 'outline',
    failed: 'destructive',
    blocked: 'destructive',
  };
  return <Badge variant={variants[status] || 'outline'}>{status.replace('_', ' ')}</Badge>;
}

// --- Main Component ---
// Role is determined server-side from Keycloak JWT + Permify PBAC via tRPC
export default function OutboundRemittance() {
  const [activeSection, setActiveSection] = useState<NavSection>('dashboard');

  // Role comes from the server (Keycloak JWT context)
  const { data: authContext, isLoading: loadingAuth } = trpc.outboundRemittance.getMyContext.useQuery();
  const userRole: UserRole = authContext?.role ?? 'participant';
  const navItems = getNavItems(userRole);
  const isAdmin = userRole === 'admin' || userRole === 'cbn';

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Sidebar */}
      <aside className="w-64 border-r bg-card flex flex-col">
        {/* Module Header */}
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-blue-600" />
            <div>
              <h2 className="font-semibold text-sm">Outbound Remittance</h2>
              <p className="text-xs text-muted-foreground">Payment Switch Module</p>
            </div>
          </div>
        </div>

        {/* User Context */}
        <div className="p-4 border-b bg-muted/30">
          {userRole === 'participant' ? (
            <>
              <p className="text-xs text-muted-foreground">Your Account</p>
              <p className="font-medium text-sm">PayApp Nigeria Ltd</p>
              <div className="flex items-center gap-1 mt-1">
                <Badge variant="secondary" className="text-xs">Growth Tier</Badge>
                <Badge variant="default" className="text-xs bg-green-600">Connected</Badge>
              </div>
            </>
          ) : userRole === 'admin' ? (
            <>
              <p className="text-xs text-muted-foreground">Platform Admin</p>
              <p className="font-medium text-sm">Switch Operations</p>
              <div className="flex items-center gap-1 mt-1">
                <Badge variant="default" className="text-xs bg-blue-600">Admin</Badge>
                <Badge variant="secondary" className="text-xs">L3 Ops</Badge>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">Regulator</p>
              <p className="font-medium text-sm">CBN Oversight</p>
              <div className="flex items-center gap-1 mt-1">
                <Badge variant="default" className="text-xs bg-purple-600">CBN</Badge>
                <Badge variant="secondary" className="text-xs">Read-Only</Badge>
              </div>
            </>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-medium border border-blue-200'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-blue-600' : ''}`} />
                {item.label}
                {item.id === 'compliance' && (
                  <Badge variant="destructive" className="ml-auto text-xs px-1.5">{isAdmin ? '12' : '3'}</Badge>
                )}
                {item.id === 'onboarding' && isAdmin && (
                  <Badge variant="secondary" className="ml-auto text-xs px-1.5">5</Badge>
                )}
                {item.id === 'participants' && (
                  <Badge variant="secondary" className="ml-auto text-xs px-1.5">25</Badge>
                )}
              </button>
            );
          })}
        </nav>

        {/* Role from server auth — no client-side switcher */}
        <div className="p-3 border-t">
          <p className="text-xs text-muted-foreground">Role: {userRole}</p>
        </div>

        {/* Footer */}
        <div className="p-4 border-t">
          <p className="text-xs text-muted-foreground">API v2.1 • Switch v4.2</p>
          <p className="text-xs text-muted-foreground">Latency: 890ms avg</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-6">
          {activeSection === 'dashboard' && <DashboardSection role={userRole} />}
          {activeSection === 'transfers' && <TransfersSection role={userRole} />}
          {activeSection === 'participants' && isAdmin && <ParticipantsSection role={userRole} />}
          {activeSection === 'prefund' && <PrefundSection role={userRole} />}
          {activeSection === 'billing' && <BillingSection role={userRole} />}
          {activeSection === 'corridors' && <CorridorsSection />}
          {activeSection === 'compliance' && <ComplianceSection role={userRole} />}
          {activeSection === 'onboarding' && <OnboardingSection role={userRole} />}
          {activeSection === 'settings' && <SettingsSection role={userRole} />}
        </div>
      </main>
    </div>
  );
}

// --- Participants Section (Admin/CBN only — enforced server-side) ---
function ParticipantsSection({ role }: { role: UserRole }) {
  // Server-side: throws FORBIDDEN if not admin/cbn
  const { data: participants, isLoading } = trpc.outboundRemittance.listParticipants.useQuery();

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Participant Management</h1>
        <p className="text-muted-foreground">
          {role === 'cbn' ? 'Regulatory oversight of all switch participants' : 'Manage all registered participants on the switch'}
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">All Participants</CardTitle></CardHeader>
        <CardContent>
          {participants && participants.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Participant</TableHead>
                  <TableHead>Short Code</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>License</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Corridors</TableHead>
                  {role === 'admin' && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {participants.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="font-mono text-xs">{p.shortCode}</TableCell>
                    <TableCell>{p.type}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs">{p.tier}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{p.cbnLicense ?? '-'}</TableCell>
                    <TableCell><StatusBadge status={p.status} /></TableCell>
                    <TableCell>{p.activeCorridors}</TableCell>
                    {role === 'admin' && (
                      <TableCell>
                        <Button size="sm" variant="outline" className="h-7 text-xs">Manage</Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center py-8 text-muted-foreground">No participants registered yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// --- Dashboard Section ---
function DashboardSection({ role }: { role: UserRole }) {
  const isAdmin = role === 'admin' || role === 'cbn';

  // All data comes from server — filtered by user's auth context
  const { data: metrics } = trpc.outboundRemittance.getDashboardMetrics.useQuery();
  const { data: recentTransfers, isLoading } = trpc.outboundRemittance.listTransfers.useQuery({ limit: 5 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {isAdmin ? 'Switch Operations Overview' : 'Your Operations Dashboard'}
        </h1>
        <p className="text-muted-foreground">
          {isAdmin ? 'System-wide metrics across all participants' : 'Real-time view of your outbound transfer pipeline'}
        </p>
      </div>

      {/* Metrics from server */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{isAdmin ? 'System Transfers' : 'Your Transfers'}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{metrics?.totalTransfers ?? 0}</p>
            <p className="text-xs text-muted-foreground">{isAdmin ? 'All participants' : 'Your organization only'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Success Rate</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">—</p>
            <p className="text-xs text-muted-foreground">Computed from DB records</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{isAdmin ? 'Total Prefund Held' : 'Your Prefund Balance'}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">—</p>
            <p className="text-xs text-muted-foreground">From TigerBeetle ledger</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{isAdmin ? 'Active Participants' : 'Active Corridors'}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">—</p>
            <p className="text-xs text-muted-foreground">From switch state</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Transfers from server (already filtered by participant) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{isAdmin ? 'Recent Transfers (All Participants)' : 'Your Recent Transfers'}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : recentTransfers && recentTransfers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Transfer ID</TableHead>
                  {isAdmin && <TableHead>Participant</TableHead>}
                  <TableHead>Reference</TableHead>
                  <TableHead>Corridor</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentTransfers.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-xs">{t.transferRef}</TableCell>
                    {isAdmin && <TableCell className="text-xs">{t.participantId}</TableCell>}
                    <TableCell className="text-xs">{t.senderRef}</TableCell>
                    <TableCell><Badge variant="outline">{t.corridor}</Badge></TableCell>
                    <TableCell>₦{Number(t.amountNgn).toLocaleString()}</TableCell>
                    <TableCell><StatusBadge status={t.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center py-8 text-muted-foreground">No transfers found</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// --- Transfers Section ---
function TransfersSection({ role }: { role: UserRole }) {
  const isAdmin = role === 'admin' || role === 'cbn';
  const [filter, setFilter] = useState('all');

  // Server-side filtered: participants see ONLY their own, admin/CBN sees all
  const { data: transfers, isLoading } = trpc.outboundRemittance.listTransfers.useQuery(
    filter === 'all' ? undefined : { status: filter }
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{isAdmin ? 'All Transfers (System-Wide)' : 'My Transfers'}</h1>
          <p className="text-muted-foreground">
            {isAdmin ? 'All outbound transfers across all participants' : 'Transfers submitted by your organization via API'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">Export CSV</Button>
          {!isAdmin && <Button>Submit Batch</Button>}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {['all', 'admitted', 'routing', 'completed', 'manual_review', 'failed'].map((f) => (
          <Button
            key={f}
            variant={filter === f ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'All' : f.replace('_', ' ')}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Transfer ID</TableHead>
                  {isAdmin && <TableHead>Participant</TableHead>}
                  <TableHead>{isAdmin ? 'Reference' : 'Your Reference'}</TableHead>
                  <TableHead>Beneficiary</TableHead>
                  <TableHead>Corridor</TableHead>
                  <TableHead>Amount (NGN)</TableHead>
                  <TableHead>Dest Amount</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers && transfers.length > 0 ? transfers.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-xs text-blue-600">{t.transferRef}</TableCell>
                    {isAdmin && <TableCell className="text-xs font-medium">{t.participantId}</TableCell>}
                    <TableCell className="text-xs">{t.senderRef}</TableCell>
                    <TableCell>{t.beneficiaryName}</TableCell>
                    <TableCell><Badge variant="outline">{t.corridor}</Badge></TableCell>
                    <TableCell>₦{Number(t.amountNgn).toLocaleString()}</TableCell>
                    <TableCell>{t.amountDest}</TableCell>
                    <TableCell>{t.provider ?? '-'}</TableCell>
                    <TableCell><StatusBadge status={t.status} /></TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 9 : 8} className="text-center py-8 text-muted-foreground">
                      No transfers found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// --- Prefund Section ---
function PrefundSection({ role }: { role: UserRole }) {
  const isAdmin = role === 'admin' || role === 'cbn';

  // Server-side filtered: participant sees own account, admin sees all
  const { data: accounts, isLoading } = trpc.outboundRemittance.getPrefundAccounts.useQuery();

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{isAdmin ? 'Prefund Accounts (All Participants)' : 'My Prefund Account'}</h1>
        <p className="text-muted-foreground">
          {isAdmin ? 'TigerBeetle ledger balances across all participants' : 'Your TigerBeetle ledger account balance and deductions'}
        </p>
      </div>

      {accounts && accounts.length > 0 ? (
        <>
          {accounts.map((account) => (
            <Card key={account.id}>
              <CardHeader>
                <CardTitle className="text-lg">Account: {account.accountRef}</CardTitle>
                <CardDescription>Currency: {account.currency}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">Balance</span><span className="font-bold">₦{Number(account.balance).toLocaleString()}</span></div>
                  <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">Committed</span><span>₦{Number(account.committedBalance).toLocaleString()}</span></div>
                  <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">Available</span><span>₦{Number(account.availableBalance).toLocaleString()}</span></div>
                  <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">Daily Limit</span><span>{account.dailyLimit ? `₦${Number(account.dailyLimit).toLocaleString()}` : '—'}</span></div>
                  <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">Last Top-Up</span><span>{account.lastTopUp ? new Date(account.lastTopUp).toLocaleDateString() : '—'}</span></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No prefund accounts found. Contact admin to set up your TigerBeetle ledger account.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// --- Billing Section ---
function BillingSection({ role }: { role: UserRole }) {
  const isAdmin = role === 'admin' || role === 'cbn';

  // Server-side filtered: participant sees own billing, admin sees all
  const { data: billingRecords, isLoading } = trpc.outboundRemittance.getBilling.useQuery();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{isAdmin ? 'Billing & Tiers (All Participants)' : 'My Billing'}</h1>
        <p className="text-muted-foreground">{isAdmin ? 'System-wide billing overview' : 'Your subscription and fee records'}</p>
      </div>

      {/* Tier reference table (shared reference data) */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Tier Schedule</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tier</TableHead>
                <TableHead>Monthly Fee</TableHead>
                <TableHead>Switch Fee/Txn</TableHead>
                <TableHead>Corridor Discount</TableHead>
                <TableHead>FX Revenue Share</TableHead>
                <TableHead>Volume Cap</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                { tier: 'Starter', fee: '$200', switchFee: '$0.25', discount: '0%', fxShare: '0%', cap: '₦1B' },
                { tier: 'Growth', fee: '$500', switchFee: '$0.15', discount: '10%', fxShare: '5%', cap: '₦10B' },
                { tier: 'Enterprise', fee: '$2,000', switchFee: '$0.08', discount: '25%', fxShare: '15%', cap: '₦50B' },
                { tier: 'Premium', fee: '$5,000', switchFee: '$0.05', discount: '35%', fxShare: '25%', cap: 'Unlimited' },
              ].map((t) => (
                <TableRow key={t.tier}>
                  <TableCell className="font-medium">{t.tier}</TableCell>
                  <TableCell>{t.fee}/mo</TableCell>
                  <TableCell>{t.switchFee}</TableCell>
                  <TableCell>{t.discount}</TableCell>
                  <TableCell>{t.fxShare}</TableCell>
                  <TableCell>{t.cap}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Billing records from DB */}
      <Card>
        <CardHeader><CardTitle className="text-lg">{isAdmin ? 'All Invoices' : 'My Invoices'}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : billingRecords && billingRecords.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  {isAdmin && <TableHead>Participant</TableHead>}
                  <TableHead>Period</TableHead>
                  <TableHead>Subscription</TableHead>
                  <TableHead>Txn Fees</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {billingRecords.map((b) => (
                  <TableRow key={b.id}>
                    {isAdmin && <TableCell>{b.participantId}</TableCell>}
                    <TableCell>{b.billingPeriod}</TableCell>
                    <TableCell>₦{Number(b.subscriptionFee).toLocaleString()}</TableCell>
                    <TableCell>₦{Number(b.transactionFees).toLocaleString()}</TableCell>
                    <TableCell className="font-bold">₦{Number(b.totalAmount).toLocaleString()}</TableCell>
                    <TableCell><StatusBadge status={b.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center py-8 text-muted-foreground">No billing records found</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// --- Corridors Section ---
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
            <TableHeader>
              <TableRow>
                <TableHead>Corridor</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>CBN Spread Cap</TableHead>
                <TableHead>Max (USD)</TableHead>
              </TableRow>
            </TableHeader>
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

// --- Compliance Section ---
function ComplianceSection({ role }: { role: UserRole }) {
  const isAdmin = role === 'admin' || role === 'cbn';

  // Server-side filtered: participant sees own screenings, admin sees all
  const { data: screenings, isLoading } = trpc.outboundRemittance.getComplianceScreenings.useQuery();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{isAdmin ? 'Compliance & Sanctions (System-Wide)' : 'My Compliance'}</h1>
        <p className="text-muted-foreground">
          {isAdmin ? 'Screening results across all participants' : 'Sanctions screening results for your transfers'}
        </p>
      </div>

      {/* Screening results from DB */}
      <Card>
        <CardHeader><CardTitle className="text-lg">{isAdmin ? 'All Screenings' : 'Your Screening Results'}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : screenings && screenings.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  {isAdmin && <TableHead>Participant</TableHead>}
                  <TableHead>Transfer</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>List</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Decision</TableHead>
                  <TableHead>Matched Entity</TableHead>
                  {isAdmin && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {screenings.map((s) => (
                  <TableRow key={s.id}>
                    {isAdmin && <TableCell className="text-xs">{s.participantId}</TableCell>}
                    <TableCell className="font-mono text-xs text-blue-600">{s.transferId}</TableCell>
                    <TableCell>{s.screeningType}</TableCell>
                    <TableCell>{s.listChecked}</TableCell>
                    <TableCell>
                      <Badge variant={Number(s.matchScore) >= 0.9 ? 'destructive' : Number(s.matchScore) >= 0.75 ? 'secondary' : 'default'}>
                        {Number(s.matchScore).toFixed(2)}
                      </Badge>
                    </TableCell>
                    <TableCell><StatusBadge status={s.decision} /></TableCell>
                    <TableCell className="text-xs">{s.matchedEntity ?? '-'}</TableCell>
                    {isAdmin && (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" className="h-7"><CheckCircle2 className="h-3 w-3 mr-1" />Clear</Button>
                          <Button size="sm" variant="destructive" className="h-7"><XCircle className="h-3 w-3 mr-1" />Block</Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center py-8 text-muted-foreground">No compliance screenings found</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// --- Onboarding Section ---
function OnboardingSection({ role }: { role: UserRole }) {
  const isAdmin = role === 'admin' || role === 'cbn';
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'applications' | 'in_progress' | 'completed'>('overview');

  const stakeholders = [
    {
      id: 'participant',
      title: 'Regulated Participant (Fintech/IMTO)',
      icon: Building2,
      description: 'Licensed fintech or IMTO applying to send outbound transfers via the switch',
      requirements: ['CBN License (IMTO/PSP/MFB)', 'Minimum capital ₦2B', 'AML/CFT compliance program', 'Technical readiness (API integration)', 'KYC/CDD procedures documentation'],
      steps: ['Application received (via public portal)', 'Document verification & compliance check', 'Technical assessment & API sandbox issued', 'Prefund account setup (TigerBeetle)', 'Certification testing (all corridors)', 'Production go-live approval'],
      timeline: '4-6 weeks',
    },
    {
      id: 'provider',
      title: 'External Provider (Payout Rail)',
      icon: Server,
      description: 'International payout provider seeking to be listed as a settlement rail on the switch',
      requirements: ['License in destination country', 'API documentation for disbursement', 'Settlement agreement & bank details', 'SLA commitment (latency, uptime)', 'Compliance certification'],
      steps: ['Application received (via public portal)', 'Technical API review & adapter development', 'Settlement agreement negotiation', 'Sandbox testing & certification', 'Corridor assignment & go-live'],
      timeline: '6-8 weeks',
    },
    {
      id: 'regulator',
      title: 'Regulator (CBN/NFIU)',
      icon: Landmark,
      description: 'Regulatory body requiring oversight access to the switch operations',
      requirements: ['Official regulatory mandate', 'Designated oversight officers', 'Secure VPN access request', 'Data classification agreement'],
      steps: ['Formal request received', 'Access scope definition (read-only/audit)', 'Security clearance & VPN provisioning', 'Training on reporting dashboards', 'Periodic review schedule setup'],
      timeline: '2-3 weeks',
    },
    {
      id: 'ops',
      title: 'Operations Staff',
      icon: Users,
      description: 'Internal switch operators managing day-to-day platform operations',
      requirements: ['Employment verification', 'Background check clearance', 'Role assignment (L1/L2/L3)', 'Security training completion'],
      steps: ['HR onboarding & background check', 'Role-based access provisioning (Permify)', 'Keycloak account creation', 'Platform training & certification', 'Supervised probation period (2 weeks)'],
      timeline: '1-2 weeks',
    },
  ];

  const pendingApplications = [
    { name: 'OPay Financial', type: 'Fintech (IMTO)', license: 'CBN/IMTO/2024/012', submitted: '2024-03-15', stage: 'Technical Assessment', status: 'pending', step: 3, totalSteps: 6, ref: 'APP-LQ4R2-X9F3' },
    { name: 'PalmPay Ltd', type: 'Fintech (PSP)', license: 'CBN/PSP/2024/087', submitted: '2024-03-18', stage: 'Compliance Review', status: 'pending', step: 2, totalSteps: 6, ref: 'APP-MN8T5-K2P7' },
    { name: 'Kuda MFB', type: 'Microfinance Bank', license: 'CBN/MFB/2020/145', submitted: '2024-03-20', stage: 'Document Verification', status: 'pending', step: 2, totalSteps: 6, ref: 'APP-QR7W1-Y4H6' },
    { name: 'TerraPay Global', type: 'Provider (Rail)', license: 'UK FCA #892341', submitted: '2024-03-22', stage: 'API Integration', status: 'processing', step: 2, totalSteps: 5, ref: 'APP-JK3V9-B8N2' },
    { name: 'Thunes Network', type: 'Provider (Rail)', license: 'SG MAS #PS21', submitted: '2024-03-25', stage: 'Settlement Agreement', status: 'processing', step: 3, totalSteps: 5, ref: 'APP-DF6L4-C1M8' },
  ];

  const inProgressOnboarding = [
    { name: 'Moniepoint Inc', type: 'Fintech (IMTO)', currentStep: 'Certification Testing', step: 5, totalSteps: 6, startDate: '2024-02-10', credentials: 'Issued 2024-02-28' },
    { name: 'Carbon (Paylater)', type: 'Fintech (PSP)', currentStep: 'Prefund Account Setup', step: 4, totalSteps: 6, startDate: '2024-02-20', credentials: 'Issued 2024-03-05' },
    { name: 'Cellulant Ltd', type: 'Provider (Rail)', currentStep: 'Sandbox Testing', step: 4, totalSteps: 5, startDate: '2024-03-01', credentials: 'Issued 2024-03-12' },
  ];

  // PARTICIPANT VIEW: show only their own onboarding progress
  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">My Onboarding Status</h1>
          <p className="text-muted-foreground">Track your organization's onboarding progress on the switch</p>
        </div>

        {/* Your Current Stage */}
        <Card className="border-green-200 bg-green-50/30">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-800">Status: Production Live</p>
                <p className="text-xs text-green-600 mt-1">PayApp Nigeria Ltd — Approved 2024-01-28 — Go-live 2024-02-14</p>
              </div>
              <Badge variant="default" className="bg-green-600">Active</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Completed Steps */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Onboarding Steps (Completed)</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { step: 1, label: 'Application Submitted', date: '2024-01-05', detail: 'Via public portal — Ref: APP-KL7M2-R3T8' },
                { step: 2, label: 'Document Verification', date: '2024-01-08', detail: 'CBN license, AML/CFT policies verified' },
                { step: 3, label: 'Technical Assessment', date: '2024-01-15', detail: 'API integration capability confirmed' },
                { step: 4, label: 'Prefund Account Created', date: '2024-01-22', detail: 'TigerBeetle account TB-PFND-PAYAPP-001' },
                { step: 5, label: 'Certification Testing', date: '2024-02-05', detail: 'All 8 corridors tested successfully' },
                { step: 6, label: 'Production Go-Live', date: '2024-02-14', detail: 'Full API access enabled, live transfers active' },
              ].map((s) => (
                <div key={s.step} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{s.label}</p>
                      <span className="text-xs text-muted-foreground">{s.date}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{s.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Account Details */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Your Platform Access</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-xs text-muted-foreground">License</p><p className="font-medium">CBN/IMTO/2023/045</p></div>
              <div><p className="text-xs text-muted-foreground">Tier</p><p className="font-medium">Growth</p></div>
              <div><p className="text-xs text-muted-foreground">Prefund Account</p><p className="font-mono text-xs">TB-PFND-PAYAPP-001</p></div>
              <div><p className="text-xs text-muted-foreground">Active Corridors</p><p className="font-medium">8 of 13</p></div>
              <div><p className="text-xs text-muted-foreground">API Key</p><p className="font-mono text-xs">pk_live_***...x4f2</p></div>
              <div><p className="text-xs text-muted-foreground">Webhook</p><p className="font-mono text-xs">https://payapp.ng/webhooks/switch</p></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ADMIN / CBN VIEW: full onboarding management
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Onboarding Management</h1>
          <p className="text-muted-foreground">Full lifecycle: Application &rarr; Review &rarr; Credentials &rarr; Testing &rarr; Go-Live</p>
        </div>
        <a href="/outbound/apply" target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm">
            <Globe className="h-4 w-4 mr-1" /> View Public Application Portal
          </Button>
        </a>
      </div>

      {/* Lifecycle Pipeline */}
      <Card className="bg-muted/30">
        <CardContent className="py-4">
          <p className="text-xs font-medium text-muted-foreground mb-3">ONBOARDING LIFECYCLE</p>
          <div className="flex items-center justify-between text-xs">
            <div className="flex flex-col items-center gap-1">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center"><Globe className="h-4 w-4 text-blue-600" /></div>
              <span className="font-medium">Apply</span>
              <span className="text-muted-foreground">(Public portal)</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col items-center gap-1">
              <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center"><FileCheck className="h-4 w-4 text-yellow-600" /></div>
              <span className="font-medium">Review</span>
              <span className="text-muted-foreground">(Admin team)</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col items-center gap-1">
              <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center"><Shield className="h-4 w-4 text-purple-600" /></div>
              <span className="font-medium">Credentials</span>
              <span className="text-muted-foreground">(Keycloak/Permify)</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col items-center gap-1">
              <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center"><Server className="h-4 w-4 text-orange-600" /></div>
              <span className="font-medium">Sandbox</span>
              <span className="text-muted-foreground">(API testing)</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col items-center gap-1">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center"><CheckCircle2 className="h-4 w-4 text-green-600" /></div>
              <span className="font-medium">Go-Live</span>
              <span className="text-muted-foreground">(Production)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics */}
      <div className="grid grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardDescription>New Applications</CardDescription></CardHeader>
          <CardContent><p className="text-2xl font-bold text-blue-600">5</p><p className="text-xs text-muted-foreground">Awaiting review</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>In Progress</CardDescription></CardHeader>
          <CardContent><p className="text-2xl font-bold text-yellow-600">3</p><p className="text-xs text-muted-foreground">Credentials issued</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Active Participants</CardDescription></CardHeader>
          <CardContent><p className="text-2xl font-bold text-green-600">25</p><p className="text-xs text-muted-foreground">Production live</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Active Providers</CardDescription></CardHeader>
          <CardContent><p className="text-2xl font-bold">7</p><p className="text-xs text-muted-foreground">Payout rails</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Ops Staff</CardDescription></CardHeader>
          <CardContent><p className="text-2xl font-bold">12</p><p className="text-xs text-muted-foreground">Active operators</p></CardContent>
        </Card>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-2 border-b pb-2">
        {[
          { id: 'overview' as const, label: 'Stakeholder Types' },
          { id: 'applications' as const, label: 'Pending Applications (5)' },
          { id: 'in_progress' as const, label: 'In Progress (3)' },
          { id: 'completed' as const, label: 'Recently Completed' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              activeTab === t.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content: Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-2 gap-4">
          {stakeholders.map((s) => {
            const Icon = s.icon;
            return (
              <Card
                key={s.id}
                className={`cursor-pointer transition-all ${selectedRole === s.id ? 'ring-2 ring-blue-500' : 'hover:border-blue-300'}`}
                onClick={() => setSelectedRole(selectedRole === s.id ? null : s.id)}
              >
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-50">
                      <Icon className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{s.title}</CardTitle>
                      <CardDescription>{s.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                {selectedRole === s.id && (
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-sm font-medium mb-2">Requirements:</p>
                      <ul className="space-y-1">
                        {s.requirements.map((r, i) => (
                          <li key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                            <CheckCircle2 className="h-3 w-3 text-green-500" /> {r}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-2">Onboarding Steps:</p>
                      <ol className="space-y-1">
                        {s.steps.map((st, i) => (
                          <li key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">{i + 1}</span>
                            {st}
                          </li>
                        ))}
                      </ol>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="text-xs text-muted-foreground">Typical timeline: {s.timeline}</span>
                      <Badge variant="secondary" className="text-xs">Begins at /outbound/apply</Badge>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Tab content: Pending Applications */}
      {activeTab === 'applications' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pending Applications</CardTitle>
            <CardDescription>Applications received from the public portal awaiting admin review and credential provisioning</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>License</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingApplications.map((a) => (
                  <TableRow key={a.ref}>
                    <TableCell className="font-mono text-xs">{a.ref}</TableCell>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell className="text-sm">{a.type}</TableCell>
                    <TableCell className="font-mono text-xs">{a.license}</TableCell>
                    <TableCell className="text-xs">{a.submitted}</TableCell>
                    <TableCell className="text-sm">{a.stage}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(a.step / a.totalSteps) * 100}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground">{a.step}/{a.totalSteps}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" className="h-7 text-xs">
                          <FileCheck className="h-3 w-3 mr-1" />Review
                        </Button>
                        <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700">
                          Approve
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Tab content: In Progress (credentials issued, completing remaining steps) */}
      {activeTab === 'in_progress' && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            These participants have been approved, received Keycloak credentials, and are completing sandbox testing before production go-live.
          </p>
          {inProgressOnboarding.map((p) => (
            <Card key={p.name}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.type} &bull; Started {p.startDate} &bull; {p.credentials}</p>
                  </div>
                  <Badge variant="secondary">{p.currentStep}</Badge>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${(p.step / p.totalSteps) * 100}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground font-medium">Step {p.step} of {p.totalSteps}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Tab content: Recently Completed */}
      {activeTab === 'completed' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recently Onboarded</CardTitle>
            <CardDescription>Participants that completed the full lifecycle and are now live in production</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Participant</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Applied</TableHead>
                  <TableHead>Go-Live Date</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  { name: 'Flutterwave Ltd', type: 'Fintech (IMTO)', applied: '2024-01-05', goLive: '2024-02-14', duration: '40 days' },
                  { name: 'Paystack (Stripe)', type: 'Fintech (PSP)', applied: '2024-01-10', goLive: '2024-02-20', duration: '41 days' },
                  { name: 'WorldRemit', type: 'Provider (Rail)', applied: '2024-01-12', goLive: '2024-03-01', duration: '48 days' },
                  { name: 'Wise Payments', type: 'Provider (Rail)', applied: '2024-01-15', goLive: '2024-03-05', duration: '49 days' },
                  { name: 'CBN Oversight Team', type: 'Regulator', applied: '2024-02-01', goLive: '2024-02-14', duration: '13 days' },
                ].map((p) => (
                  <TableRow key={p.name}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.type}</TableCell>
                    <TableCell className="text-xs">{p.applied}</TableCell>
                    <TableCell className="text-xs">{p.goLive}</TableCell>
                    <TableCell className="text-sm">{p.duration}</TableCell>
                    <TableCell><Badge variant="default" className="bg-green-600">Live</Badge></TableCell>
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

// --- Settings Section ---
function SettingsSection({ role }: { role: UserRole }) {
  const isAdmin = role === 'admin' || role === 'cbn';
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Module Settings</h1>
        <p className="text-muted-foreground">Configure outbound remittance module parameters</p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-lg">API Configuration</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>API Endpoint</Label>
              <Input value="https://switch.payapp.ng/api/v2/outbound" disabled />
            </div>
            <div className="space-y-2">
              <Label>Webhook URL</Label>
              <Input placeholder="https://your-backend.com/webhooks/outbound" />
            </div>
            <div className="space-y-2">
              <Label>Callback Auth</Label>
              <Select>
                <SelectTrigger><SelectValue placeholder="Select auth method" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hmac">HMAC-SHA256</SelectItem>
                  <SelectItem value="bearer">Bearer Token</SelectItem>
                  <SelectItem value="mtls">Mutual TLS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button>Save Configuration</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Notification Preferences</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Low Balance Alert Threshold</Label>
              <Input type="number" placeholder="200000000" />
              <p className="text-xs text-muted-foreground">In kobo (₦200M = 20,000,000,000 kobo)</p>
            </div>
            <div className="space-y-2">
              <Label>Compliance Escalation Email</Label>
              <Input placeholder="compliance@payapp.ng" />
            </div>
            <div className="space-y-2">
              <Label>Settlement Confirmation</Label>
              <Select>
                <SelectTrigger><SelectValue placeholder="Notification method" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="webhook">Webhook</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button>Save Preferences</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
