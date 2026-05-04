import 'package:flutter/material.dart';

/// Outbound Remittance Participant Dashboard (Mobile).
///
/// For use by the LOGGED-IN participant (fintech/IMTO) to:
/// - Monitor THEIR OWN transfer pipeline and corridor health
/// - View THEIR OWN prefund balance and deductions
/// - Review THEIR OWN compliance escalations
/// - Track provider performance on corridors they use
/// - Track THEIR OWN onboarding progress
///
/// This is NOT a consumer "send money" screen.
/// Admin/CBN management is done via the web admin dashboard only.
class OutboundRemittanceScreen extends StatefulWidget {
  const OutboundRemittanceScreen({super.key});

  @override
  State<OutboundRemittanceScreen> createState() =>
      _OutboundRemittanceScreenState();
}

class _OutboundRemittanceScreenState extends State<OutboundRemittanceScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 11, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Outbound Operations'),
        elevation: 0,
        bottom: TabBar(
          controller: _tabController,
          isScrollable: true,
          tabs: const [
            Tab(text: 'Dashboard'),
            Tab(text: 'Transfers'),
            Tab(text: 'Prefund'),
            Tab(text: 'Corridors'),
            Tab(text: 'FX Rates'),
            Tab(text: 'Tier'),
            Tab(text: 'Settlement'),
            Tab(text: 'Alerts'),
            Tab(text: 'Compliance'),
            Tab(text: 'Rails'),
            Tab(text: 'Onboarding'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: const [
          _DashboardTab(),
          _TransfersTab(),
          _PrefundTab(),
          _CorridorsTab(),
          _FXRatesTab(),
          _TierInfoTab(),
          _SettlementTab(),
          _AlertsTab(),
          _ComplianceTab(),
          _PaymentRailsTab(),
          _OnboardingTab(),
        ],
      ),
    );
  }
}

// --- Dashboard Tab ---
class _DashboardTab extends StatelessWidget {
  const _DashboardTab();

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: () async { await Future.delayed(const Duration(seconds: 1)); },
      child: SingleChildScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Key metrics row
          Row(
            children: [
              Expanded(child: _MetricCard(
                title: 'Daily Volume',
                value: '₦2.4B',
                subtitle: '+12% vs yesterday',
                icon: Icons.trending_up,
                color: Colors.blue,
              )),
              const SizedBox(width: 12),
              Expanded(child: _MetricCard(
                title: 'Success Rate',
                value: '99.1%',
                subtitle: '3,847 of 3,882',
                icon: Icons.check_circle_outline,
                color: Colors.green,
              )),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: _MetricCard(
                title: 'Prefund Bal.',
                value: '₦847M',
                subtitle: '₦2.1B headroom',
                icon: Icons.account_balance_wallet,
                color: Colors.purple,
              )),
              const SizedBox(width: 12),
              Expanded(child: _MetricCard(
                title: 'Avg Latency',
                value: '890ms',
                subtitle: 'p99: 2.1s',
                icon: Icons.speed,
                color: Colors.orange,
              )),
            ],
          ),
          const SizedBox(height: 24),

          // Transaction pipeline
          Text('Transaction Pipeline (A→G)',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          _PipelineRow(stages: [
            _PipelineStage('A', 'Admitted', 142),
            _PipelineStage('B', 'Workflow', 89),
            _PipelineStage('C', 'Compliance', 34),
            _PipelineStage('D', 'Pricing', 21),
            _PipelineStage('E', 'Routing', 15),
            _PipelineStage('F', 'Executing', 8),
            _PipelineStage('G', 'Settled', 3691),
          ]),
          const SizedBox(height: 24),

          // Provider health
          Text('Provider Health',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          ..._providerHealth.map((p) => _ProviderHealthTile(
            name: p['name'] as String,
            latency: p['latency'] as String,
            success: p['success'] as String,
            status: p['status'] as String,
          )),
        ],
      ),
      ),
    );
  }

  static final _providerHealth = [
    {'name': 'Flutterwave', 'latency': '320ms', 'success': '99.4%', 'status': 'healthy'},
    {'name': 'WorldRemit', 'latency': '890ms', 'success': '98.1%', 'status': 'healthy'},
    {'name': 'Chipper Cash', 'latency': '450ms', 'success': '99.2%', 'status': 'healthy'},
    {'name': 'Mojaloop Hub', 'latency': '180ms', 'success': '99.8%', 'status': 'healthy'},
    {'name': 'Wise', 'latency': '1.2s', 'success': '97.5%', 'status': 'degraded'},
    {'name': 'MTN MoMo', 'latency': '290ms', 'success': '99.6%', 'status': 'healthy'},
    {'name': 'LemFi', 'latency': '560ms', 'success': '98.8%', 'status': 'healthy'},
  ];
}

// --- Transfers Tab ---
class _TransfersTab extends StatelessWidget {
  const _TransfersTab();

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Filter bar
        Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              _FilterChip(label: 'All', selected: true),
              const SizedBox(width: 8),
              _FilterChip(label: 'Processing', selected: false),
              const SizedBox(width: 8),
              _FilterChip(label: 'Completed', selected: false),
              const SizedBox(width: 8),
              _FilterChip(label: 'Failed', selected: false),
            ],
          ),
        ),
        // Transfer list
        Expanded(
          child: ListView.builder(
            itemCount: _sampleTransfers.length,
            itemBuilder: (context, index) {
              final t = _sampleTransfers[index];
              return _TransferListItem(
                transferId: t['id'] as String,
                corridor: t['corridor'] as String,
                amount: t['amount'] as String,
                beneficiary: t['beneficiary'] as String,
                status: t['status'] as String,
                provider: t['provider'] as String,
                stage: t['stage'] as String,
                time: t['time'] as String,
              );
            },
          ),
        ),
      ],
    );
  }

  static final _sampleTransfers = [
    {'id': 'TRF-0847291', 'corridor': 'NG-GH', 'amount': '₦750,000', 'beneficiary': 'Kwame Asante', 'status': 'completed', 'provider': 'Flutterwave', 'stage': 'G-Settled', 'time': '2m ago'},
    {'id': 'TRF-0847290', 'corridor': 'NG-GB', 'amount': '₦18,000,000', 'beneficiary': 'Imperial College', 'status': 'processing', 'provider': 'Wise', 'stage': 'E-Routing', 'time': '5m ago'},
    {'id': 'TRF-0847289', 'corridor': 'NG-US', 'amount': '₦4,200,000', 'beneficiary': 'MIT Admissions', 'status': 'completed', 'provider': 'WorldRemit', 'stage': 'G-Settled', 'time': '8m ago'},
    {'id': 'TRF-0847288', 'corridor': 'NG-CN', 'amount': '₦67,500,000', 'beneficiary': 'Shenzhen Industrial', 'status': 'manual_review', 'provider': 'Pending', 'stage': 'C-Compliance', 'time': '12m ago'},
    {'id': 'TRF-0847287', 'corridor': 'NG-IN', 'amount': '₦3,800,000', 'beneficiary': 'Apollo Hospital', 'status': 'completed', 'provider': 'Chipper', 'stage': 'G-Settled', 'time': '15m ago'},
    {'id': 'TRF-0847286', 'corridor': 'NG-KE', 'amount': '₦950,000', 'beneficiary': 'M-Pesa Account', 'status': 'processing', 'provider': 'MTN MoMo', 'stage': 'F-Executing', 'time': '18m ago'},
    {'id': 'TRF-0847285', 'corridor': 'NG-SN', 'amount': '₦480,000', 'beneficiary': 'Dakar Transfer Co', 'status': 'failed', 'provider': 'LemFi', 'stage': 'E-Routing', 'time': '22m ago'},
  ];
}

// --- Prefund Tab ---
class _PrefundTab extends StatelessWidget {
  const _PrefundTab();

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Balance card
          Card(
            elevation: 2,
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Prefund Balance',
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(color: Colors.grey)),
                  const SizedBox(height: 8),
                  Text('₦847,000,000',
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      _PrefundStat('Today Deducted', '₦1.53B'),
                      _PrefundStat('Available Headroom', '₦2.1B'),
                      _PrefundStat('Daily Limit', '₦3.5B'),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Account details
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Account Details',
                    style: Theme.of(context).textTheme.titleSmall),
                  const SizedBox(height: 12),
                  _DetailRow('Account ID', 'TB-PFND-PAYAPP-001'),
                  _DetailRow('Tier', 'Growth ($500/mo)'),
                  _DetailRow('Base Switch Fee', '\$0.15/txn'),
                  _DetailRow('Corridor Discount', '10%'),
                  _DetailRow('FX Revenue Share', '5%'),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Recent deductions
          Text('Recent Deductions',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          ..._recentDeductions.map((d) => ListTile(
            title: Text(d['transfer'] as String),
            subtitle: Text('${d['corridor']} • ${d['time']}'),
            trailing: Text('-${d['amount']}',
              style: const TextStyle(color: Colors.red, fontWeight: FontWeight.w500)),
          )),
        ],
      ),
    );
  }

  static final _recentDeductions = [
    {'transfer': 'TRF-0847291', 'corridor': 'NG-GH', 'amount': '₦751,350', 'time': '2m ago'},
    {'transfer': 'TRF-0847290', 'corridor': 'NG-GB', 'amount': '₦18,023,400', 'time': '5m ago'},
    {'transfer': 'TRF-0847289', 'corridor': 'NG-US', 'amount': '₦4,207,500', 'time': '8m ago'},
    {'transfer': 'TRF-0847287', 'corridor': 'NG-IN', 'amount': '₦3,808,700', 'time': '15m ago'},
    {'transfer': 'TRF-0847286', 'corridor': 'NG-KE', 'amount': '₦952,100', 'time': '18m ago'},
  ];
}

// --- Corridors Tab ---
class _CorridorsTab extends StatelessWidget {
  const _CorridorsTab();

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      padding: const EdgeInsets.all(12),
      itemCount: _corridorData.length,
      itemBuilder: (context, index) {
        final c = _corridorData[index];
        return Card(
          margin: const EdgeInsets.only(bottom: 8),
          child: ListTile(
            title: Text(c['name'] as String),
            subtitle: Text('${c['category']} • ${c['currency']} • Cap: ${c['spread_cap']}bps'),
            trailing: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(c['today_volume'] as String,
                  style: const TextStyle(fontWeight: FontWeight.bold)),
                Text(c['status'] as String,
                  style: TextStyle(
                    fontSize: 12,
                    color: c['status'] == 'Active' ? Colors.green : Colors.orange,
                  )),
              ],
            ),
          ),
        );
      },
    );
  }

  static final _corridorData = [
    {'name': 'NG → Ghana', 'category': 'West Africa Labor', 'currency': 'GHS', 'spread_cap': '150', 'today_volume': '₦847M', 'status': 'Active'},
    {'name': 'NG → Senegal', 'category': 'West Africa Labor', 'currency': 'XOF', 'spread_cap': '200', 'today_volume': '₦234M', 'status': 'Active'},
    {'name': 'NG → Côte d\'Ivoire', 'category': 'West Africa Labor', 'currency': 'XOF', 'spread_cap': '200', 'today_volume': '₦178M', 'status': 'Active'},
    {'name': 'NG → Cameroon', 'category': 'West Africa Labor', 'currency': 'XAF', 'spread_cap': '200', 'today_volume': '₦92M', 'status': 'Active'},
    {'name': 'NG → United Kingdom', 'category': 'Education', 'currency': 'GBP', 'spread_cap': '100', 'today_volume': '₦1.2B', 'status': 'Active'},
    {'name': 'NG → United States', 'category': 'Education', 'currency': 'USD', 'spread_cap': '100', 'today_volume': '₦890M', 'status': 'Active'},
    {'name': 'NG → Canada', 'category': 'Education', 'currency': 'CAD', 'spread_cap': '120', 'today_volume': '₦345M', 'status': 'Active'},
    {'name': 'NG → India', 'category': 'Medical', 'currency': 'INR', 'spread_cap': '150', 'today_volume': '₦567M', 'status': 'Active'},
    {'name': 'NG → Turkey', 'category': 'Medical', 'currency': 'TRY', 'spread_cap': '175', 'today_volume': '₦123M', 'status': 'Active'},
    {'name': 'NG → China', 'category': 'Premium Business', 'currency': 'CNY', 'spread_cap': '80', 'today_volume': '₦2.1B', 'status': 'Active'},
    {'name': 'NG → UAE', 'category': 'Premium Business', 'currency': 'AED', 'spread_cap': '90', 'today_volume': '₦1.8B', 'status': 'Active'},
    {'name': 'NG → Kenya', 'category': 'General Personal', 'currency': 'KES', 'spread_cap': '150', 'today_volume': '₦234M', 'status': 'Active'},
    {'name': 'NG → South Africa', 'category': 'General Personal', 'currency': 'ZAR', 'spread_cap': '130', 'today_volume': '₦189M', 'status': 'Active'},
  ];
}

// --- Compliance Tab ---
class _ComplianceTab extends StatelessWidget {
  const _ComplianceTab();

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Screening metrics
          Row(
            children: [
              Expanded(child: _MetricCard(
                title: 'Screened Today',
                value: '3,882',
                subtitle: '7 lists checked',
                icon: Icons.shield,
                color: Colors.blue,
              )),
              const SizedBox(width: 12),
              Expanded(child: _MetricCard(
                title: 'Escalated',
                value: '4',
                subtitle: 'Pending review',
                icon: Icons.warning_amber,
                color: Colors.amber,
              )),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: _MetricCard(
                title: 'Blocked',
                value: '1',
                subtitle: 'Auto-blocked',
                icon: Icons.block,
                color: Colors.red,
              )),
              const SizedBox(width: 12),
              Expanded(child: _MetricCard(
                title: 'Cleared',
                value: '3,877',
                subtitle: '99.87% pass rate',
                icon: Icons.verified,
                color: Colors.green,
              )),
            ],
          ),
          const SizedBox(height: 24),

          // Active sanctions lists
          Text('Active Sanctions Lists',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          ..._sanctionsLists.map((sl) => ListTile(
            leading: Icon(Icons.list_alt, color: Colors.blue.shade700),
            title: Text(sl['name'] as String),
            subtitle: Text('${sl['entries']} entries'),
            trailing: Text('Updated ${sl['updated']}',
              style: const TextStyle(fontSize: 12, color: Colors.grey)),
          )),
          const SizedBox(height: 24),

          // Escalated transfers
          Text('Escalated — Pending Review',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          ..._escalatedTransfers.map((e) => Card(
            color: Colors.amber.shade50,
            child: ListTile(
              title: Text(e['transfer'] as String),
              subtitle: Text('${e['beneficiary']} • Score: ${e['score']} • ${e['list']}'),
              trailing: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  IconButton(icon: const Icon(Icons.check, color: Colors.green), onPressed: () {}),
                  IconButton(icon: const Icon(Icons.close, color: Colors.red), onPressed: () {}),
                ],
              ),
            ),
          )),
        ],
      ),
    );
  }

  static final _sanctionsLists = [
    {'name': 'OFAC SDN', 'entries': '12,847', 'updated': '2h ago'},
    {'name': 'OFAC Non-SDN', 'entries': '8,234', 'updated': '2h ago'},
    {'name': 'UN Consolidated', 'entries': '6,891', 'updated': '6h ago'},
    {'name': 'EU Sanctions', 'entries': '4,567', 'updated': '12h ago'},
    {'name': 'CBN Watchlist', 'entries': '2,341', 'updated': '1h ago'},
    {'name': 'INTERPOL Red', 'entries': '7,234', 'updated': '24h ago'},
    {'name': 'PEP', 'entries': '15,678', 'updated': '48h ago'},
  ];

  static final _escalatedTransfers = [
    {'transfer': 'TRF-0847288', 'beneficiary': 'Shenzhen Industrial Ltd', 'score': '0.82', 'list': 'OFAC Non-SDN'},
    {'transfer': 'TRF-0847276', 'beneficiary': 'Viktor Holdings', 'score': '0.89', 'list': 'OFAC SDN'},
    {'transfer': 'TRF-0847265', 'beneficiary': 'Al-Rashid Trading', 'score': '0.77', 'list': 'UN Consolidated'},
    {'transfer': 'TRF-0847251', 'beneficiary': 'Gov Official Account', 'score': '0.81', 'list': 'PEP'},
  ];
}

// --- Shared widgets ---

class _MetricCard extends StatelessWidget {
  final String title;
  final String value;
  final String subtitle;
  final IconData icon;
  final Color color;

  const _MetricCard({
    required this.title,
    required this.value,
    required this.subtitle,
    required this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 1,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, size: 16, color: color),
                const SizedBox(width: 6),
                Expanded(child: Text(title,
                  style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
                  overflow: TextOverflow.ellipsis)),
              ],
            ),
            const SizedBox(height: 6),
            Text(value,
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: color)),
            const SizedBox(height: 2),
            Text(subtitle,
              style: TextStyle(fontSize: 11, color: Colors.grey.shade500)),
          ],
        ),
      ),
    );
  }
}

class _PipelineRow extends StatelessWidget {
  final List<_PipelineStage> stages;
  const _PipelineRow({required this.stages});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: stages.map((s) => Container(
          margin: const EdgeInsets.only(right: 8),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: s.count > 100 ? Colors.green.shade50 : Colors.blue.shade50,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: s.count > 100 ? Colors.green.shade200 : Colors.blue.shade200),
          ),
          child: Column(
            children: [
              Text(s.code, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
              Text('${s.count}', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.grey.shade800)),
              Text(s.label, style: TextStyle(fontSize: 9, color: Colors.grey.shade600)),
            ],
          ),
        )).toList(),
      ),
    );
  }
}

class _PipelineStage {
  final String code;
  final String label;
  final int count;
  const _PipelineStage(this.code, this.label, this.count);
}

class _ProviderHealthTile extends StatelessWidget {
  final String name;
  final String latency;
  final String success;
  final String status;
  const _ProviderHealthTile({required this.name, required this.latency, required this.success, required this.status});

  @override
  Widget build(BuildContext context) {
    return ListTile(
      dense: true,
      title: Text(name),
      subtitle: Text('Latency: $latency • Success: $success'),
      trailing: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: status == 'healthy' ? Colors.green.shade50 : Colors.orange.shade50,
          borderRadius: BorderRadius.circular(4),
        ),
        child: Text(status,
          style: TextStyle(
            fontSize: 11,
            color: status == 'healthy' ? Colors.green.shade700 : Colors.orange.shade700,
          )),
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  final String label;
  final bool selected;
  const _FilterChip({required this.label, required this.selected});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: selected ? Colors.blue : Colors.grey.shade200,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Text(label,
        style: TextStyle(
          fontSize: 12,
          color: selected ? Colors.white : Colors.black87,
        )),
    );
  }
}

class _TransferListItem extends StatelessWidget {
  final String transferId;
  final String corridor;
  final String amount;
  final String beneficiary;
  final String status;
  final String provider;
  final String stage;
  final String time;

  const _TransferListItem({
    required this.transferId,
    required this.corridor,
    required this.amount,
    required this.beneficiary,
    required this.status,
    required this.provider,
    required this.stage,
    required this.time,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      title: Row(
        children: [
          Expanded(child: Text(transferId, style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13))),
          _StatusBadge(status: status),
        ],
      ),
      subtitle: Text('$corridor • $beneficiary • $amount\n$provider • $stage • $time'),
      isThreeLine: true,
    );
  }
}

class _StatusBadge extends StatelessWidget {
  final String status;
  const _StatusBadge({required this.status});

  @override
  Widget build(BuildContext context) {
    Color color;
    switch (status) {
      case 'completed':
        color = Colors.green;
        break;
      case 'processing':
        color = Colors.blue;
        break;
      case 'manual_review':
        color = Colors.amber;
        break;
      case 'failed':
        color = Colors.red;
        break;
      default:
        color = Colors.grey;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withAlpha(25),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: color.withAlpha(100)),
      ),
      child: Text(status, style: TextStyle(fontSize: 10, color: color)),
    );
  }
}

class _PrefundStat extends StatelessWidget {
  final String label;
  final String value;
  const _PrefundStat(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(value, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
        Text(label, style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
      ],
    );
  }
}

class _DetailRow extends StatelessWidget {
  final String label;
  final String value;
  const _DetailRow(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(color: Colors.grey.shade600)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }
}

// --- Onboarding Tab (Participant's own onboarding status only) ---
class _OnboardingTab extends StatelessWidget {
  const _OnboardingTab();

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Status banner
          Card(
            color: Colors.green.shade50,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Icon(Icons.check_circle, color: Colors.green.shade700, size: 28),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Status: Production Live', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: Colors.green.shade800)),
                        const SizedBox(height: 2),
                        Text('Approved 2024-01-28 • Go-live 2024-02-14', style: TextStyle(fontSize: 12, color: Colors.green.shade600)),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(color: Colors.green.shade600, borderRadius: BorderRadius.circular(4)),
                    child: const Text('Active', style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w500)),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),

          // Your completed steps
          Text('Your Onboarding Steps',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          ..._mySteps.asMap().entries.map((e) => Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 24, height: 24,
                  decoration: BoxDecoration(color: Colors.green.shade100, borderRadius: BorderRadius.circular(12)),
                  child: Icon(Icons.check, size: 14, color: Colors.green.shade700),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(e.value['label'] as String, style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13)),
                          Text(e.value['date'] as String, style: TextStyle(fontSize: 11, color: Colors.grey.shade500)),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(e.value['detail'] as String, style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
                    ],
                  ),
                ),
              ],
            ),
          )),
          const SizedBox(height: 20),

          // Account details
          Text('Your Platform Access',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  _accessRow('License', 'CBN/IMTO/2023/045'),
                  _accessRow('Tier', 'Growth'),
                  _accessRow('Prefund Account', 'TB-PFND-PAYAPP-001'),
                  _accessRow('Active Corridors', '8 of 13'),
                  _accessRow('API Key', 'pk_live_***...x4f2'),
                  _accessRow('Webhook', 'https://payapp.ng/webhooks/switch'),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  static Widget _accessRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
          Text(value, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }

  static final _mySteps = [
    {'label': 'Application Submitted', 'date': '2024-01-05', 'detail': 'Via public portal — Ref: APP-KL7M2-R3T8'},
    {'label': 'Document Verification', 'date': '2024-01-08', 'detail': 'CBN license, AML/CFT policies verified'},
    {'label': 'Technical Assessment', 'date': '2024-01-15', 'detail': 'API integration capability confirmed'},
    {'label': 'Prefund Account Created', 'date': '2024-01-22', 'detail': 'TigerBeetle account TB-PFND-PAYAPP-001'},
    {'label': 'Certification Testing', 'date': '2024-02-05', 'detail': 'All 8 corridors tested successfully'},
    {'label': 'Production Go-Live', 'date': '2024-02-14', 'detail': 'Full API access enabled, live transfers active'},
  ];
}

// --- FX Rates Tab ---
class _FXRatesTab extends StatelessWidget {
  const _FXRatesTab();

  @override
  Widget build(BuildContext context) {
    final rates = [
      {'pair': 'NGN/GHS', 'mid': '0.002000', 'spread': '60 bps', 'cap': '80 bps', 'source': 'Bloomberg', 'status': 'Live'},
      {'pair': 'NGN/GBP', 'mid': '0.000792', 'spread': '50 bps', 'cap': '80 bps', 'source': 'Bloomberg', 'status': 'Live'},
      {'pair': 'NGN/USD', 'mid': '0.000630', 'spread': '50 bps', 'cap': '80 bps', 'source': 'Bloomberg', 'status': 'Live'},
      {'pair': 'NGN/CAD', 'mid': '0.000845', 'spread': '60 bps', 'cap': '90 bps', 'source': 'Bloomberg', 'status': 'Live'},
      {'pair': 'NGN/INR', 'mid': '0.053000', 'spread': '90 bps', 'cap': '120 bps', 'source': 'Bloomberg', 'status': 'Live'},
      {'pair': 'NGN/CNY', 'mid': '0.004600', 'spread': '100 bps', 'cap': '150 bps', 'source': 'Reuters', 'status': 'Stale'},
      {'pair': 'NGN/AED', 'mid': '0.002330', 'spread': '80 bps', 'cap': '120 bps', 'source': 'Bloomberg', 'status': 'Live'},
      {'pair': 'NGN/KES', 'mid': '0.081500', 'spread': '75 bps', 'cap': '100 bps', 'source': 'CBN', 'status': 'Live'},
      {'pair': 'NGN/ZAR', 'mid': '0.011400', 'spread': '70 bps', 'cap': '90 bps', 'source': 'Bloomberg', 'status': 'Live'},
      {'pair': 'NGN/XOF', 'mid': '0.370000', 'spread': '80 bps', 'cap': '100 bps', 'source': 'CBN', 'status': 'Live'},
      {'pair': 'NGN/TRY', 'mid': '0.021500', 'spread': '120 bps', 'cap': '200 bps', 'source': 'Reuters', 'status': 'Live'},
    ];

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('FX Rates', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(color: Colors.green.shade100, borderRadius: BorderRadius.circular(8)),
                      child: Text('Live', style: TextStyle(color: Colors.green.shade800, fontSize: 11, fontWeight: FontWeight.w600)),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text('Bloomberg / Reuters / CBN feeds', style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        ...rates.map((r) => Card(
          child: ListTile(
            dense: true,
            title: Text(r['pair']!, style: const TextStyle(fontWeight: FontWeight.w600, fontFamily: 'monospace')),
            subtitle: Text('Spread: ${r['spread']} / Cap: ${r['cap']} • ${r['source']}', style: const TextStyle(fontSize: 11)),
            trailing: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(r['mid']!, style: const TextStyle(fontWeight: FontWeight.bold, fontFamily: 'monospace')),
                Text(r['status']!, style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                  color: r['status'] == 'Live' ? Colors.green : Colors.orange,
                )),
              ],
            ),
          ),
        )),
      ],
    );
  }
}

// --- Tier Info Tab ---
class _TierInfoTab extends StatelessWidget {
  const _TierInfoTab();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Your Tier', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                const SizedBox(height: 12),
                _tierRow('Current Tier', 'Growth', Colors.blue),
                _tierRow('Monthly Fee', '\$500/mo', null),
                _tierRow('Transaction Fee', '₦1,000/txn', null),
                _tierRow('FX Spread Discount', '10%', null),
                _tierRow('Max Corridors', '7', null),
                _tierRow('Active Corridors', '5 of 7', null),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Upgrade to Enterprise', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                Text('Requirements:', style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
                const SizedBox(height: 8),
                _requirementRow('Avg monthly volume ≥ ₦5B', '₦2.1B', false),
                _requirementRow('Min 6 months on platform', '8 months', true),
                _requirementRow('Max 1 sanctions block (90d)', '0 blocks', true),
                _requirementRow('Success rate ≥ 97%', '98.1%', true),
                _requirementRow('Prefund consistency ≥ 90%', '92%', true),
                const SizedBox(height: 12),
                Text('Volume is the only missing criteria. Increase monthly volume to ₦5B to qualify.',
                  style: TextStyle(fontSize: 11, color: Colors.grey.shade500, fontStyle: FontStyle.italic)),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('All Tiers', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                _allTierRow('Starter', '\$200/mo', '₦1,500/txn', '0%', '3 corridors'),
                _allTierRow('Growth ★', '\$500/mo', '₦1,000/txn', '10%', '7 corridors'),
                _allTierRow('Enterprise', '\$2,000/mo', '₦500/txn', '25%', '13 corridors'),
                _allTierRow('Premium', '\$5,000/mo', '₦250/txn', '40%', '13 corridors'),
              ],
            ),
          ),
        ),
      ],
    );
  }

  static Widget _tierRow(String label, String value, Color? valueColor) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(fontSize: 13, color: Colors.grey.shade600)),
          Text(value, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: valueColor)),
        ],
      ),
    );
  }

  static Widget _requirementRow(String requirement, String current, bool met) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        children: [
          Icon(met ? Icons.check_circle : Icons.cancel, size: 16, color: met ? Colors.green : Colors.red),
          const SizedBox(width: 8),
          Expanded(child: Text(requirement, style: const TextStyle(fontSize: 12))),
          Text(current, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: met ? Colors.green : Colors.red)),
        ],
      ),
    );
  }

  static Widget _allTierRow(String name, String fee, String txnFee, String discount, String corridors) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          SizedBox(width: 90, child: Text(name, style: TextStyle(fontSize: 12, fontWeight: name.contains('★') ? FontWeight.bold : FontWeight.normal))),
          SizedBox(width: 70, child: Text(fee, style: const TextStyle(fontSize: 11))),
          SizedBox(width: 75, child: Text(txnFee, style: const TextStyle(fontSize: 11))),
          SizedBox(width: 35, child: Text(discount, style: const TextStyle(fontSize: 11))),
          Expanded(child: Text(corridors, style: const TextStyle(fontSize: 11))),
        ],
      ),
    );
  }
}

// --- Alerts Tab ---
class _AlertsTab extends StatelessWidget {
  const _AlertsTab();

  @override
  Widget build(BuildContext context) {
    final alerts = [
      {'type': 'SLA Breach', 'severity': 'high', 'message': 'NG-IN corridor latency exceeded 45s target (62s actual)', 'time': '14:22 UTC', 'action': 'Auto-escalated to backup provider'},
      {'type': 'Low Balance', 'severity': 'medium', 'message': 'Prefund balance ₦847M approaching ₦500M threshold', 'time': '13:45 UTC', 'action': 'Top-up recommended'},
      {'type': 'Compliance', 'severity': 'high', 'message': 'New match on EU sanctions list for beneficiary Chen Wei', 'time': '12:10 UTC', 'action': 'Transfer TXN-PAYAPP-005 held for review'},
      {'type': 'Rate Alert', 'severity': 'low', 'message': 'NGN/CNY rate source stale (>30s)', 'time': '11:55 UTC', 'action': 'Fallback to Reuters rate active'},
      {'type': 'Capacity', 'severity': 'medium', 'message': 'NG-GB predicted ₦920M tomorrow (school fees pattern) — current liquidity ₦500M', 'time': '10:00 UTC', 'action': 'Pre-position ₦420M recommended'},
    ];

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Active Alerts', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                const SizedBox(height: 4),
                Text('SLA breaches, compliance holds, capacity warnings', style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        ...alerts.map((a) {
          final color = a['severity'] == 'high' ? Colors.red : a['severity'] == 'medium' ? Colors.orange : Colors.blue;
          return Card(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(4)),
                        child: Text(a['type']!, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: color)),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(4)),
                        child: Text(a['severity']!, style: TextStyle(fontSize: 10, color: color)),
                      ),
                      const Spacer(),
                      Text(a['time']!, style: TextStyle(fontSize: 10, color: Colors.grey.shade500)),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(a['message']!, style: const TextStyle(fontSize: 13)),
                  const SizedBox(height: 4),
                  Text('Action: ${a['action']}', style: TextStyle(fontSize: 11, color: Colors.grey.shade600, fontStyle: FontStyle.italic)),
                ],
              ),
            ),
          );
        }),
      ],
    );
  }
}

/// Payment Rails Tab — shows settlement rails available for participant corridors
class _PaymentRailsTab extends StatelessWidget {
  const _PaymentRailsTab();

  @override
  Widget build(BuildContext context) {
    final rails = [
      {'type': 'SWIFT', 'name': 'SWIFT gpi', 'settlement': 'USD', 'maxTime': '48h', 'status': 'operational', 'corridors': 'GB, US, CA, AE, TR, CN, ZA', 'fee': '\$15-25', 'format': 'MT103/ISO20022'},
      {'type': 'PAPSS', 'name': 'PAPSS (Pan-African)', 'settlement': 'LOCAL', 'maxTime': '2min', 'status': 'operational', 'corridors': 'GH, KE, ZA, SN, CI, CM', 'fee': '\$0.50', 'format': 'ISO20022'},
      {'type': 'CIPS', 'name': 'CIPS (China)', 'settlement': 'CNY', 'maxTime': '4h', 'status': 'operational', 'corridors': 'CN', 'fee': '\$8-12', 'format': 'ISO20022/CIPS'},
      {'type': 'UPI', 'name': 'UPI International', 'settlement': 'INR', 'maxTime': '30s', 'status': 'operational', 'corridors': 'IN', 'fee': '\$0.10', 'format': 'UPI/ISO20022'},
      {'type': 'SEPA', 'name': 'SEPA Instant', 'settlement': 'EUR', 'maxTime': '10s', 'status': 'operational', 'corridors': 'GB, TR', 'fee': '\$1.50', 'format': 'pain.001'},
      {'type': 'MOBILE_MONEY', 'name': 'Mobile Money', 'settlement': 'LOCAL', 'maxTime': '5min', 'status': 'operational', 'corridors': 'GH, KE, CM, CI, SN, ZA', 'fee': '\$0.30', 'format': 'GSMA MMAPI'},
      {'type': 'MOJALOOP', 'name': 'Mojaloop Hub', 'settlement': 'LOCAL', 'maxTime': '10min', 'status': 'operational', 'corridors': 'GH, KE, SN, CI, CM, ZA', 'fee': '\$0.50', 'format': 'FSPIOP'},
      {'type': 'ACH', 'name': 'ACH (US)', 'settlement': 'USD', 'maxTime': '24h', 'status': 'operational', 'corridors': 'US, CA', 'fee': '\$0.25', 'format': 'NACHA'},
      {'type': 'FASTER_PAY', 'name': 'Faster Payments', 'settlement': 'GBP', 'maxTime': '2h', 'status': 'operational', 'corridors': 'GB', 'fee': '\$0.50', 'format': 'ISO20022'},
    ];

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Summary cards
        Row(
          children: [
            Expanded(
              child: Card(
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('${rails.length}', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
                      const Text('Active Rails', style: TextStyle(fontSize: 11, color: Colors.grey)),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Card(
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('${rails.where((r) => r['status'] == 'operational').length}', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.green)),
                      const Text('Operational', style: TextStyle(fontSize: 11, color: Colors.grey)),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        const Text('Settlement Rail Network', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        const SizedBox(height: 4),
        const Text('All rails integrated via Mojaloop interoperability hub', style: TextStyle(fontSize: 12, color: Colors.grey)),
        const SizedBox(height: 12),
        // Rail cards
        ...rails.map((rail) {
          final isInstant = ['UPI', 'SEPA', 'FASTER_PAY'].contains(rail['type']);
          return Card(
            margin: const EdgeInsets.only(bottom: 8),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(rail['name']!, style: const TextStyle(fontWeight: FontWeight.bold)),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.green.shade100,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(rail['status']!, style: TextStyle(fontSize: 10, color: Colors.green.shade800)),
                      ),
                      if (isInstant) ...[
                        const SizedBox(width: 4),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: Colors.blue.shade100,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Text('INSTANT', style: TextStyle(fontSize: 9, color: Colors.blue, fontWeight: FontWeight.bold)),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      _railInfoChip('Type', rail['type']!),
                      _railInfoChip('Settlement', rail['settlement']!),
                      _railInfoChip('Max Time', rail['maxTime']!),
                      _railInfoChip('Fee', rail['fee']!),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      const Icon(Icons.public, size: 12, color: Colors.grey),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text('Corridors: ${rail['corridors']}', style: const TextStyle(fontSize: 11, color: Colors.grey)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text('Format: ${rail['format']}', style: TextStyle(fontSize: 10, color: Colors.grey.shade500)),
                ],
              ),
            ),
          );
        }),
      ],
    );
  }

  Widget _railInfoChip(String label, String value) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontSize: 9, color: Colors.grey)),
          Text(value, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }
}

// --- Settlement Tab (#33 - Card-based layout) ---
class _SettlementTab extends StatelessWidget {
  const _SettlementTab();

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: () async { await Future.delayed(const Duration(seconds: 1)); },
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Summary cards
          Row(children: [
            Expanded(child: _MetricCard(title: 'Total Batches', value: '4', subtitle: 'Across all rails', icon: Icons.layers, color: Colors.blue)),
            const SizedBox(width: 12),
            Expanded(child: _MetricCard(title: 'Netting Savings', value: '₦1.3B', subtitle: '21.1% saved', icon: Icons.savings, color: Colors.green)),
          ]),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(child: _MetricCard(title: 'Gross Volume', value: '₦6.1B', subtitle: 'All batches', icon: Icons.bar_chart, color: Colors.purple)),
            const SizedBox(width: 12),
            Expanded(child: _MetricCard(title: 'Avg Settlement', value: '145s', subtitle: '9 rails', icon: Icons.timer, color: Colors.orange)),
          ]),
          const SizedBox(height: 24),

          Text('Settlement Batches', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),

          // Batch cards with swipe gesture (#26)
          _SettlementBatchCard(
            batchId: 'STL-PAPSS-000142', rail: 'PAPSS', status: 'CONFIRMED',
            transfers: 47, grossNgn: '₦892.5M', netNgn: '₦743.2M', savings: '₦149.3M',
            statusColor: Colors.green,
          ),
          _SettlementBatchCard(
            batchId: 'STL-SWIFT-000089', rail: 'SWIFT', status: 'SUBMITTED',
            transfers: 12, grossNgn: '₦3.45B', netNgn: '₦3.12B', savings: '₦330M',
            statusColor: Colors.blue,
          ),
          _SettlementBatchCard(
            batchId: 'STL-CIPS-000034', rail: 'CIPS', status: 'NETTING',
            transfers: 5, grossNgn: '₦678M', netNgn: '---', savings: '---',
            statusColor: Colors.orange,
          ),
          _SettlementBatchCard(
            batchId: 'STL-ACH-000156', rail: 'ACH', status: 'FAILED',
            transfers: 8, grossNgn: '₦1.12B', netNgn: '₦980M', savings: '₦140M',
            statusColor: Colors.red,
          ),

          const SizedBox(height: 24),
          Text('Pending Queues', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8, runSpacing: 8,
            children: [
              _PendingQueueChip('SWIFT', 0), _PendingQueueChip('PAPSS', 23),
              _PendingQueueChip('CIPS', 0), _PendingQueueChip('UPI', 0),
              _PendingQueueChip('SEPA', 5), _PendingQueueChip('Mobile Money', 0),
              _PendingQueueChip('Mojaloop', 12), _PendingQueueChip('ACH', 0),
              _PendingQueueChip('Faster Pay', 0),
            ],
          ),
        ],
      ),
    );
  }
}

class _SettlementBatchCard extends StatelessWidget {
  final String batchId, rail, status, grossNgn, netNgn, savings;
  final int transfers;
  final Color statusColor;

  const _SettlementBatchCard({
    required this.batchId, required this.rail, required this.status,
    required this.transfers, required this.grossNgn, required this.netNgn,
    required this.savings, required this.statusColor,
  });

  @override
  Widget build(BuildContext context) {
    return Dismissible(
      key: Key(batchId),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20),
        color: Colors.blue.shade100,
        child: const Icon(Icons.info_outline, color: Colors.blue),
      ),
      confirmDismiss: (_) async {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$batchId details'), duration: const Duration(seconds: 2)),
        );
        return false;
      },
      child: Card(
        margin: const EdgeInsets.only(bottom: 12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Text(batchId, style: const TextStyle(fontWeight: FontWeight.bold, fontFamily: 'monospace', fontSize: 13)),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(color: statusColor.withOpacity(0.15), borderRadius: BorderRadius.circular(12)),
                  child: Text(status, style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: statusColor)),
                ),
              ]),
              const SizedBox(height: 8),
              Row(children: [
                const Icon(Icons.train, size: 14, color: Colors.grey),
                const SizedBox(width: 4),
                Text(rail, style: const TextStyle(fontSize: 12, color: Colors.grey)),
                const SizedBox(width: 16),
                const Icon(Icons.receipt_long, size: 14, color: Colors.grey),
                const SizedBox(width: 4),
                Text('$transfers transfers', style: const TextStyle(fontSize: 12, color: Colors.grey)),
              ]),
              const SizedBox(height: 8),
              Row(children: [
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('Gross', style: TextStyle(fontSize: 10, color: Colors.grey)),
                  Text(grossNgn, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                ])),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('Net', style: TextStyle(fontSize: 10, color: Colors.grey)),
                  Text(netNgn, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                ])),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('Savings', style: TextStyle(fontSize: 10, color: Colors.grey)),
                  Text(savings, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.green.shade700)),
                ])),
              ]),
            ],
          ),
        ),
      ),
    );
  }
}

class _PendingQueueChip extends StatelessWidget {
  final String rail;
  final int count;
  const _PendingQueueChip(this.rail, this.count);

  @override
  Widget build(BuildContext context) {
    return Chip(
      avatar: CircleAvatar(
        backgroundColor: count > 0 ? Colors.blue : Colors.grey.shade300,
        child: Text('$count', style: TextStyle(fontSize: 10, color: count > 0 ? Colors.white : Colors.grey)),
      ),
      label: Text(rail, style: const TextStyle(fontSize: 11)),
    );
  }
}
