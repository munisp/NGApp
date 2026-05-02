import 'package:flutter/material.dart';

/// Outbound Remittance Participant Dashboard (Mobile).
///
/// For use by fintech/IMTO operators to:
/// - Monitor transfer pipeline and corridor health
/// - View prefund balance and deductions
/// - Review compliance escalations
/// - Track provider performance
///
/// This is NOT a consumer "send money" screen.
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
    _tabController = TabController(length: 5, vsync: this);
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
            Tab(text: 'Compliance'),
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
          _ComplianceTab(),
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
    return SingleChildScrollView(
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
