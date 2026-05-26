import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/tenant_provider.dart';

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final tenant = context.watch<TenantProvider>().currentTenant;
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Dashboard', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
            Text(tenant.name, style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.onSurfaceVariant)),
          ],
        ),
        actions: [
          IconButton(icon: const Icon(Icons.notifications_outlined), onPressed: () {}),
          PopupMenuButton<String>(
            onSelected: (id) => context.read<TenantProvider>().switchTenant(id),
            itemBuilder: (ctx) => context.read<TenantProvider>().tenants.map((t) =>
              PopupMenuItem(value: t.id, child: Text(t.name))).toList(),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: CircleAvatar(radius: 16, child: Text(tenant.name[0], style: const TextStyle(fontSize: 14))),
            ),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {},
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _buildMetricsGrid(context, tenant),
            const SizedBox(height: 16),
            _buildQuickActions(context, tenant),
            const SizedBox(height: 16),
            _buildRecentActivity(context),
          ],
        ),
      ),
    );
  }

  Widget _buildMetricsGrid(BuildContext context, Tenant tenant) {
    final metrics = [
      _MetricData('Total Customers', '45,230', Icons.people, Colors.blue, '+12.3%'),
      _MetricData('Active Agents', '2,847', Icons.storefront, Colors.green, '+8.1%'),
      _MetricData('Revenue (MTD)', '₦2.4B', Icons.trending_up, Colors.purple, '+15.7%'),
      _MetricData('SLA Compliance', '97.2%', Icons.timer, Colors.orange, '-0.3%'),
    ];

    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2, crossAxisSpacing: 12, mainAxisSpacing: 12, childAspectRatio: 1.4,
      ),
      itemCount: metrics.length,
      itemBuilder: (ctx, i) {
        final m = metrics[i];
        return Card(
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(children: [
                  Icon(m.icon, size: 20, color: m.color),
                  const Spacer(),
                  Text(m.change, style: TextStyle(fontSize: 11, color: m.change.startsWith('+') ? Colors.green : Colors.red, fontWeight: FontWeight.w500)),
                ]),
                Text(m.value, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
                Text(m.label, style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.onSurfaceVariant)),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildQuickActions(BuildContext context, Tenant tenant) {
    final actions = <_ActionData>[
      if (tenant.products['core_banking'] == true) _ActionData('Core Banking', Icons.account_balance, Colors.blue),
      if (tenant.products['agent_banking'] == true) _ActionData('Agent Banking', Icons.storefront, Colors.green),
      if (tenant.products['remittance'] == true) _ActionData('Remittance', Icons.swap_horiz, Colors.orange),
      _ActionData('Compliance', Icons.shield, Colors.purple),
      _ActionData('Security', Icons.security, Colors.red),
      _ActionData('Campaigns', Icons.campaign, Colors.teal),
    ];

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Quick Actions', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            Wrap(
              spacing: 16, runSpacing: 12,
              children: actions.map((a) => GestureDetector(
                onTap: () {},
                child: SizedBox(
                  width: 70,
                  child: Column(children: [
                    CircleAvatar(radius: 22, backgroundColor: a.color.withOpacity(0.1), child: Icon(a.icon, color: a.color, size: 22)),
                    const SizedBox(height: 4),
                    Text(a.label, style: const TextStyle(fontSize: 11), textAlign: TextAlign.center, maxLines: 2),
                  ]),
                ),
              )).toList(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRecentActivity(BuildContext context) {
    final activities = [
      ('New customer registered — Fatima Ibrahim', '2 min ago', Icons.person_add, Colors.blue),
      ('Agent float top-up approved — ₦2.5M', '15 min ago', Icons.check_circle, Colors.green),
      ('KYC verification completed — Musa Bello', '1 hour ago', Icons.verified, Colors.purple),
      ('SQL injection attempt blocked', '2 hours ago', Icons.shield, Colors.red),
      ('Campaign "Q2 Cross-sell" launched', '3 hours ago', Icons.campaign, Colors.teal),
    ];

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Recent Activity', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            ...activities.map((a) => ListTile(
              contentPadding: EdgeInsets.zero,
              leading: CircleAvatar(radius: 18, backgroundColor: a.$4.withOpacity(0.1), child: Icon(a.$3, size: 18, color: a.$4)),
              title: Text(a.$1, style: const TextStyle(fontSize: 13)),
              trailing: Text(a.$2, style: TextStyle(fontSize: 11, color: Theme.of(context).colorScheme.onSurfaceVariant)),
            )),
          ],
        ),
      ),
    );
  }
}

class _MetricData {
  final String label, value, change;
  final IconData icon;
  final Color color;
  _MetricData(this.label, this.value, this.icon, this.color, this.change);
}

class _ActionData {
  final String label;
  final IconData icon;
  final Color color;
  _ActionData(this.label, this.icon, this.color);
}
