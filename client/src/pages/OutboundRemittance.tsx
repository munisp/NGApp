import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

interface Transfer {
  id: string;
  senderRef: string;
  beneficiary: string;
  corridor: string;
  amountNGN: number;
  amountDest: string;
  status: string;
  provider: string;
  timestamp: string;
  lifecycleStep: string;
}

// --- Mock Data ---
const mockTransfers: Transfer[] = [
  { id: 'TRF-2024-000142', senderRef: 'PAY-APP-98712', beneficiary: 'Kwame A. (GH)', corridor: 'NG-GH', amountNGN: 750000, amountDest: 'GHS 3,750', status: 'completed', provider: 'Chipper Cash', timestamp: '14:32:01', lifecycleStep: 'G. Audit' },
  { id: 'TRF-2024-000141', senderRef: 'PAY-APP-98711', beneficiary: 'James S. (GB)', corridor: 'NG-GB', amountNGN: 18000000, amountDest: 'GBP 9,540', status: 'completed', provider: 'Wise', timestamp: '14:28:15', lifecycleStep: 'G. Audit' },
  { id: 'TRF-2024-000140', senderRef: 'FIN-BETA-4451', beneficiary: 'Raj P. (IN)', corridor: 'NG-IN', amountNGN: 12750000, amountDest: 'INR 714,000', status: 'processing', provider: 'Flutterwave', timestamp: '14:25:03', lifecycleStep: 'E. Routing' },
  { id: 'TRF-2024-000139', senderRef: 'FIN-BETA-4450', beneficiary: 'Chen W. (CN)', corridor: 'NG-CN', amountNGN: 67500000, amountDest: 'CNY 324,000', status: 'manual_review', provider: '-', timestamp: '14:20:47', lifecycleStep: 'C. Compliance' },
  { id: 'TRF-2024-000138', senderRef: 'PAY-APP-98710', beneficiary: 'Fatou D. (SN)', corridor: 'NG-SN', amountNGN: 300000, amountDest: 'XOF 123,000', status: 'completed', provider: 'MTN MoMo', timestamp: '14:15:22', lifecycleStep: 'G. Audit' },
  { id: 'TRF-2024-000137', senderRef: 'MON-GO-7821', beneficiary: 'Ahmed B. (AE)', corridor: 'NG-AE', amountNGN: 45000000, amountDest: 'AED 108,000', status: 'processing', provider: 'Wise', timestamp: '14:12:09', lifecycleStep: 'D. Pricing' },
  { id: 'TRF-2024-000136', senderRef: 'PAY-APP-98709', beneficiary: 'Kofi M. (GH)', corridor: 'NG-GH', amountNGN: 450000, amountDest: 'GHS 2,250', status: 'completed', provider: 'Mojaloop Hub', timestamp: '14:08:33', lifecycleStep: 'G. Audit' },
];

const corridors = [
  { id: 'NG-GH', dest: 'Ghana', currency: 'GHS', category: 'West Africa Labor', spreadCap: 150, maxUsd: 5000, todayVolume: '₦340M', status: 'active' },
  { id: 'NG-SN', dest: 'Senegal', currency: 'XOF', category: 'West Africa Labor', spreadCap: 200, maxUsd: 5000, todayVolume: '₦45M', status: 'active' },
  { id: 'NG-CI', dest: "Côte d'Ivoire", currency: 'XOF', category: 'West Africa Labor', spreadCap: 200, maxUsd: 5000, todayVolume: '₦32M', status: 'active' },
  { id: 'NG-CM', dest: 'Cameroon', currency: 'XAF', category: 'West Africa Labor', spreadCap: 200, maxUsd: 5000, todayVolume: '₦18M', status: 'active' },
  { id: 'NG-GB', dest: 'United Kingdom', currency: 'GBP', category: 'Education', spreadCap: 100, maxUsd: 50000, todayVolume: '₦890M', status: 'active' },
  { id: 'NG-US', dest: 'United States', currency: 'USD', category: 'Education', spreadCap: 100, maxUsd: 50000, todayVolume: '₦620M', status: 'active' },
  { id: 'NG-CA', dest: 'Canada', currency: 'CAD', category: 'Education', spreadCap: 120, maxUsd: 50000, todayVolume: '₦78M', status: 'active' },
  { id: 'NG-IN', dest: 'India', currency: 'INR', category: 'Medical', spreadCap: 150, maxUsd: 30000, todayVolume: '₦170M', status: 'active' },
  { id: 'NG-TR', dest: 'Turkey', currency: 'TRY', category: 'Medical', spreadCap: 175, maxUsd: 30000, todayVolume: '₦22M', status: 'active' },
  { id: 'NG-CN', dest: 'China', currency: 'CNY', category: 'Premium Business', spreadCap: 80, maxUsd: 100000, todayVolume: '₦280M', status: 'active' },
  { id: 'NG-AE', dest: 'UAE', currency: 'AED', category: 'Premium Business', spreadCap: 90, maxUsd: 100000, todayVolume: '₦195M', status: 'active' },
  { id: 'NG-KE', dest: 'Kenya', currency: 'KES', category: 'General Personal', spreadCap: 150, maxUsd: 10000, todayVolume: '₦56M', status: 'active' },
  { id: 'NG-ZA', dest: 'South Africa', currency: 'ZAR', category: 'General Personal', spreadCap: 130, maxUsd: 10000, todayVolume: '₦38M', status: 'active' },
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
// In production, role comes from Keycloak JWT + Permify PBAC
// participant = IMTO/fintech (sees only own data)
// admin = platform operator (sees all participants)
// cbn = regulator (read-only oversight of all participants)
export default function OutboundRemittance() {
  const [activeSection, setActiveSection] = useState<NavSection>('dashboard');
  const [userRole, setUserRole] = useState<UserRole>('participant');

  const navItems = getNavItems(userRole);
  const isAdmin = userRole === 'admin' || userRole === 'cbn';

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

        {/* Role Switcher (demo only — in production, role comes from Keycloak JWT) */}
        <div className="p-3 border-t">
          <p className="text-xs text-muted-foreground mb-2">View as (demo):</p>
          <Select value={userRole} onValueChange={(v) => { setUserRole(v as UserRole); setActiveSection('dashboard'); }}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="participant">Participant (IMTO)</SelectItem>
              <SelectItem value="admin">Platform Admin</SelectItem>
              <SelectItem value="cbn">CBN Regulator</SelectItem>
            </SelectContent>
          </Select>
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

// --- Participants Section (Admin/CBN only) ---
function ParticipantsSection({ role }: { role: UserRole }) {
  const participants = [
    { name: 'PayApp Nigeria Ltd', type: 'IMTO', tier: 'Growth', license: 'CBN/IMTO/2023/045', status: 'active', volume: '₦2.4B', transfers: 3882, corridors: 8 },
    { name: 'Flutterwave Ltd', type: 'IMTO', tier: 'Enterprise', license: 'CBN/IMTO/2022/012', status: 'active', volume: '₦8.1B', transfers: 12450, corridors: 13 },
    { name: 'Paystack (Stripe)', type: 'PSP', tier: 'Enterprise', license: 'CBN/PSP/2021/089', status: 'active', volume: '₦5.2B', transfers: 8790, corridors: 10 },
    { name: 'Moniepoint Inc', type: 'IMTO', tier: 'Growth', license: 'CBN/IMTO/2023/078', status: 'onboarding', volume: '₦0', transfers: 0, corridors: 0 },
    { name: 'OPay Financial', type: 'IMTO', tier: 'Starter', license: 'CBN/IMTO/2024/012', status: 'pending', volume: '₦0', transfers: 0, corridors: 0 },
    { name: 'PalmPay Ltd', type: 'PSP', tier: 'Starter', license: 'CBN/PSP/2024/087', status: 'pending', volume: '₦0', transfers: 0, corridors: 0 },
    { name: 'Kuda MFB', type: 'MFB', tier: 'Starter', license: 'CBN/MFB/2020/145', status: 'pending', volume: '₦0', transfers: 0, corridors: 0 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Participant Management</h1>
        <p className="text-muted-foreground">
          {role === 'cbn' ? 'Regulatory oversight of all switch participants' : 'Manage all registered participants on the switch'}
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardDescription>Active</CardDescription></CardHeader><CardContent><p className="text-2xl font-bold text-green-600">3</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Onboarding</CardDescription></CardHeader><CardContent><p className="text-2xl font-bold text-blue-600">1</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Pending</CardDescription></CardHeader><CardContent><p className="text-2xl font-bold text-yellow-600">3</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Total Volume (Today)</CardDescription></CardHeader><CardContent><p className="text-2xl font-bold">₦15.7B</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">All Participants</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Participant</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>License</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Today Volume</TableHead>
                <TableHead>Transfers</TableHead>
                <TableHead>Corridors</TableHead>
                {role === 'admin' && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {participants.map((p) => (
                <TableRow key={p.name}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.type}</TableCell>
                  <TableCell><Badge variant="secondary" className="text-xs">{p.tier}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">{p.license}</TableCell>
                  <TableCell><StatusBadge status={p.status} /></TableCell>
                  <TableCell>{p.volume}</TableCell>
                  <TableCell>{p.transfers.toLocaleString()}</TableCell>
                  <TableCell>{p.corridors}</TableCell>
                  {role === 'admin' && (
                    <TableCell>
                      <Button size="sm" variant="outline" className="h-7 text-xs">Manage</Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// --- Dashboard Section ---
function DashboardSection({ role }: { role: UserRole }) {
  const isAdmin = role === 'admin' || role === 'cbn';
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

      {/* Metrics - scoped to role */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{isAdmin ? 'System Volume (Today)' : 'Your Volume (Today)'}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{isAdmin ? '₦15.7B' : '₦2.4B'}</p>
            <p className="text-xs text-green-600 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> +12% vs yesterday
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Success Rate</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">99.1%</p>
            <p className="text-xs text-muted-foreground">{isAdmin ? '25,120 of 25,347 transfers' : '3,847 of 3,882 transfers'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{isAdmin ? 'Total Prefund Held' : 'Your Prefund Balance'}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{isAdmin ? '₦42.3B' : '₦847M'}</p>
            <p className="text-xs text-muted-foreground">{isAdmin ? 'Across 25 participants' : '62% of your daily limit'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{isAdmin ? 'Active Participants' : 'Avg Latency'}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{isAdmin ? '25' : '890ms'}</p>
            <p className="text-xs text-muted-foreground">{isAdmin ? '3 onboarding, 5 pending' : 'p99: 2.1s end-to-end'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Transaction Pipeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Active Transaction Pipeline (A→G)</CardTitle>
          <CardDescription>Transfers currently in each lifecycle stage</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            {[
              { code: 'A', label: 'Admission', count: 12 },
              { code: 'B', label: 'Workflow', count: 8 },
              { code: 'C', label: 'Compliance', count: 5 },
              { code: 'D', label: 'Pricing', count: 3 },
              { code: 'E', label: 'Routing', count: 7 },
              { code: 'F', label: 'Settlement', count: 4 },
              { code: 'G', label: 'Audit', count: 1208 },
            ].map((stage, i) => (
              <div key={stage.code} className="flex items-center">
                <div className="text-center px-4 py-2">
                  <p className="text-xs text-muted-foreground">{stage.code}. {stage.label}</p>
                  <p className="text-xl font-bold">{stage.count}</p>
                </div>
                {i < 6 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Provider Health + Top Corridors */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top Corridors (Today)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { id: 'NG-GB', volume: '₦890M', txns: 312 },
              { id: 'NG-US', volume: '₦620M', txns: 245 },
              { id: 'NG-GH', volume: '₦340M', txns: 428 },
              { id: 'NG-CN', volume: '₦280M', txns: 45 },
              { id: 'NG-IN', volume: '₦170M', txns: 89 },
            ].map((c) => (
              <div key={c.id} className="flex items-center justify-between">
                <span className="font-mono text-sm">{c.id}</span>
                <div className="flex-1 mx-4 bg-muted rounded-full h-2">
                  <div className="bg-blue-600 rounded-full h-2" style={{ width: `${(c.txns / 428) * 100}%` }} />
                </div>
                <span className="text-sm text-muted-foreground">{c.volume}</span>
                <span className="text-xs text-muted-foreground ml-2">{c.txns} txns</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Provider Health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { name: 'Mojaloop Hub', latency: '400ms', success: '99.8%', healthy: true },
              { name: 'Flutterwave', latency: '800ms', success: '98.8%', healthy: true },
              { name: 'Wise', latency: '2.0s', success: '99.6%', healthy: true },
              { name: 'Chipper Cash', latency: '600ms', success: '97.5%', healthy: false },
              { name: 'MTN MoMo', latency: '500ms', success: '96.5%', healthy: true },
            ].map((p) => (
              <div key={p.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${p.healthy ? 'bg-green-500' : 'bg-yellow-500'}`} />
                  <span className="text-sm">{p.name}</span>
                </div>
                <span className="text-xs text-muted-foreground">{p.latency}</span>
                <span className="text-xs font-medium">{p.success}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Recent Transfers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Transfers</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Transfer ID</TableHead>
                <TableHead>Your Ref</TableHead>
                <TableHead>Corridor</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Step</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockTransfers.slice(0, 5).map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-xs">{t.id}</TableCell>
                  <TableCell className="text-xs">{t.senderRef}</TableCell>
                  <TableCell><Badge variant="outline">{t.corridor}</Badge></TableCell>
                  <TableCell>₦{t.amountNGN.toLocaleString()}</TableCell>
                  <TableCell className="text-xs">{t.lifecycleStep}</TableCell>
                  <TableCell><StatusBadge status={t.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// --- Transfers Section ---
function TransfersSection({ role }: { role: UserRole }) {
  const isAdmin = role === 'admin' || role === 'cbn';
  const [filter, setFilter] = useState('all');
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
        {['all', 'processing', 'completed', 'manual_review', 'failed'].map((f) => (
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Transfer ID</TableHead>
                <TableHead>Your Reference</TableHead>
                <TableHead>Beneficiary</TableHead>
                <TableHead>Corridor</TableHead>
                <TableHead>Amount (NGN)</TableHead>
                <TableHead>Dest Amount</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Lifecycle</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockTransfers
                .filter((t) => filter === 'all' || t.status === filter)
                .map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-xs text-blue-600">{t.id}</TableCell>
                    <TableCell className="text-xs">{t.senderRef}</TableCell>
                    <TableCell>{t.beneficiary}</TableCell>
                    <TableCell><Badge variant="outline">{t.corridor}</Badge></TableCell>
                    <TableCell>₦{t.amountNGN.toLocaleString()}</TableCell>
                    <TableCell>{t.amountDest}</TableCell>
                    <TableCell>{t.provider}</TableCell>
                    <TableCell className="text-xs">{t.lifecycleStep}</TableCell>
                    <TableCell><StatusBadge status={t.status} /></TableCell>
                    <TableCell className="text-xs">{t.timestamp}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// --- Prefund Section ---
function PrefundSection({ role }: { role: UserRole }) {
  const isAdmin = role === 'admin' || role === 'cbn';
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{isAdmin ? 'Prefund Accounts (All Participants)' : 'My Prefund Account'}</h1>
        <p className="text-muted-foreground">
          {isAdmin ? 'TigerBeetle ledger balances across all participants' : 'Your TigerBeetle ledger account balance and deductions'}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="border-blue-200 bg-blue-50/30">
          <CardHeader className="pb-2"><CardDescription>Prefund Balance</CardDescription></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">₦847,320,000</p>
            <p className="text-xs text-muted-foreground">Last updated: 2 min ago</p>
          </CardContent>
        </Card>
        <Card className="border-yellow-200 bg-yellow-50/30">
          <CardHeader className="pb-2"><CardDescription>Today's Deductions</CardDescription></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">₦2,152,800,000</p>
            <p className="text-xs text-muted-foreground">1,247 transfers processed</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50/30">
          <CardHeader className="pb-2"><CardDescription>Available Headroom</CardDescription></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">₦1.37B</p>
            <p className="text-xs text-muted-foreground">Daily limit: ₦3.5B</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Prefund Account (TigerBeetle Ledger)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">Account ID</span><span className="font-mono">TB-PFND-PAYAPP-001</span></div>
            <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">Tier</span><span>Growth (₦500/mo subscription)</span></div>
            <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">Daily Limit</span><span>₦3,500,000,000</span></div>
            <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">Low Balance Threshold</span><span>₦200,000,000 (alert at 5.7%)</span></div>
            <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">Settlement Bank</span><span>Zenith Bank Plc</span></div>
            <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">Account Family</span><span className="font-mono">fintech_prefund_ngn</span></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Recent Deductions</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Transfer</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>State</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                { time: '14:32:01', transfer: 'TRF-000142', type: 'Principal + Fees', amount: '₦752,250', state: 'committed' },
                { time: '14:28:15', transfer: 'TRF-000141', type: 'Principal + Fees', amount: '₦18,014,400', state: 'committed' },
                { time: '14:25:03', transfer: 'TRF-000140', type: 'Principal + Fees', amount: '₦12,756,375', state: 'pending' },
                { time: '14:20:47', transfer: 'TRF-000139', type: 'Reserve (compliance hold)', amount: '₦67,540,500', state: 'pending' },
                { time: '14:15:22', transfer: 'TRF-000138', type: 'Principal + Fees', amount: '₦300,900', state: 'committed' },
              ].map((d) => (
                <TableRow key={d.transfer}>
                  <TableCell className="text-xs">{d.time}</TableCell>
                  <TableCell className="font-mono text-xs text-blue-600">{d.transfer}</TableCell>
                  <TableCell>{d.type}</TableCell>
                  <TableCell className="font-medium">{d.amount}</TableCell>
                  <TableCell><StatusBadge status={d.state} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// --- Billing Section ---
function BillingSection({ role }: { role: UserRole }) {
  const isAdmin = role === 'admin' || role === 'cbn';
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Billing & Subscription</h1>
        <p className="text-muted-foreground">Tiered subscription management and fee schedule</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Current Subscription</CardTitle>
          <CardDescription>Growth Tier — ₦500/month</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">Base Switch Fee</span><span>$0.15/txn (₦22,500 kobo)</span></div>
            <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">Corridor Discount</span><span>10%</span></div>
            <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">FX Revenue Share</span><span>5%</span></div>
            <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">CBN Levy</span><span>0.5% on fees</span></div>
            <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">Monthly Volume Cap</span><span>₦10B</span></div>
            <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">Billing Period</span><span>1 Apr — 30 Apr 2024</span></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Available Tiers</CardTitle></CardHeader>
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
                { tier: 'Growth', fee: '$500', switchFee: '$0.15', discount: '10%', fxShare: '5%', cap: '₦10B', current: true },
                { tier: 'Enterprise', fee: '$2,000', switchFee: '$0.08', discount: '25%', fxShare: '15%', cap: '₦50B' },
                { tier: 'Premium', fee: '$5,000', switchFee: '$0.05', discount: '35%', fxShare: '25%', cap: 'Unlimited' },
              ].map((t) => (
                <TableRow key={t.tier} className={t.current ? 'bg-blue-50' : ''}>
                  <TableCell className="font-medium">{t.tier} {t.current && <Badge className="ml-1">Current</Badge>}</TableCell>
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
                <TableHead>Today Volume</TableHead>
                <TableHead>Status</TableHead>
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
                  <TableCell>{c.todayVolume}</TableCell>
                  <TableCell><StatusBadge status={c.status} /></TableCell>
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
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Compliance & Sanctions</h1>
        <p className="text-muted-foreground">Real-time sanctions screening across 7 global lists</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardDescription>Screened Today</CardDescription></CardHeader>
          <CardContent><p className="text-2xl font-bold">1,247</p><p className="text-xs text-muted-foreground">All transfers</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Cleared</CardDescription></CardHeader>
          <CardContent><p className="text-2xl font-bold text-green-600">1,233</p><p className="text-xs text-muted-foreground">98.9% pass rate</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Escalated</CardDescription></CardHeader>
          <CardContent><p className="text-2xl font-bold text-yellow-600">11</p><p className="text-xs text-muted-foreground">Manual review required</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Blocked</CardDescription></CardHeader>
          <CardContent><p className="text-2xl font-bold text-red-600">3</p><p className="text-xs text-muted-foreground">Auto-blocked by sanctions hit</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Sanctions Lists Active</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            {[
              { name: 'OFAC SDN', entries: '12,847', updated: 'Today' },
              { name: 'UN Consolidated', entries: '789', updated: 'Yesterday' },
              { name: 'EU Sanctions', entries: '2,156', updated: 'Today' },
              { name: 'CBN Watchlist', entries: '456', updated: 'Today' },
              { name: 'INTERPOL Red', entries: '7,312', updated: '2 days ago' },
              { name: 'PEP List', entries: '15,000', updated: 'Today' },
              { name: 'OFAC Non-SDN', entries: '3,421', updated: 'Today' },
            ].map((l) => (
              <Card key={l.name} className="border">
                <CardContent className="pt-4">
                  <p className="font-medium text-sm">{l.name}</p>
                  <p className="text-lg font-bold">{l.entries}</p>
                  <p className="text-xs text-muted-foreground">Updated: {l.updated}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Escalated Transfers (Pending Review)</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Transfer</TableHead>
                <TableHead>Beneficiary</TableHead>
                <TableHead>Match Score</TableHead>
                <TableHead>List</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                { transfer: 'TRF-000139', beneficiary: 'Chen Wei (CN)', score: 0.82, list: 'PEP List', reason: 'Name similarity to PEP entry', status: 'pending' },
                { transfer: 'TRF-000131', beneficiary: 'Al-Hassan M. (AE)', score: 0.78, list: 'UN Consolidated', reason: 'Partial name match', status: 'pending' },
                { transfer: 'TRF-000128', beneficiary: 'Kim J. (KR)', score: 0.91, list: 'OFAC SDN', reason: 'High-confidence name match', status: 'under_review' },
              ].map((e) => (
                <TableRow key={e.transfer}>
                  <TableCell className="font-mono text-xs text-blue-600">{e.transfer}</TableCell>
                  <TableCell>{e.beneficiary}</TableCell>
                  <TableCell><Badge variant={e.score >= 0.9 ? 'destructive' : 'secondary'}>{e.score.toFixed(2)}</Badge></TableCell>
                  <TableCell>{e.list}</TableCell>
                  <TableCell className="text-xs">{e.reason}</TableCell>
                  <TableCell><StatusBadge status={e.status} /></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" className="h-7"><CheckCircle2 className="h-3 w-3 mr-1" />Clear</Button>
                      <Button size="sm" variant="destructive" className="h-7"><XCircle className="h-3 w-3 mr-1" />Block</Button>
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
