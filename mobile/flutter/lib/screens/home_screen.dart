import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/connectivity_service.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final connectivity = context.watch<ConnectivityService>();
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('54Bank'),
        centerTitle: false,
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 12),
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: connectivity.isOnline ? Colors.green.shade100 : Colors.red.shade100,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(connectivity.isOnline ? Icons.wifi : Icons.wifi_off,
                    size: 14, color: connectivity.isOnline ? Colors.green : Colors.red),
                const SizedBox(width: 4),
                Text(connectivity.qualityLabel,
                    style: TextStyle(fontSize: 11, color: connectivity.isOnline ? Colors.green.shade800 : Colors.red.shade800)),
              ],
            ),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Balance card
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                gradient: const LinearGradient(colors: [Color(0xFF0F766E), Color(0xFF0D9488)]),
                borderRadius: BorderRadius.circular(16),
              ),
              child: const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Total Balance', style: TextStyle(color: Colors.white70, fontSize: 14)),
                  SizedBox(height: 8),
                  Text('NGN 24,500,000.00', style: TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.bold)),
                  SizedBox(height: 4),
                  Text('Across 3 accounts', style: TextStyle(color: Colors.white60, fontSize: 12)),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Quick actions
            Text('Quick Actions', style: theme.textTheme.titleMedium),
            const SizedBox(height: 12),
            GridView.count(
              crossAxisCount: 4,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              childAspectRatio: 0.85,
              children: [
                _QuickAction(icon: Icons.send, label: 'Transfer', onTap: () => Navigator.pushNamed(context, '/transfers')),
                _QuickAction(icon: Icons.receipt_long, label: 'Bills', onTap: () {}),
                _QuickAction(icon: Icons.credit_card, label: 'Cards', onTap: () => Navigator.pushNamed(context, '/cards')),
                _QuickAction(icon: Icons.account_balance, label: 'Loans', onTap: () => Navigator.pushNamed(context, '/loans')),
                _QuickAction(icon: Icons.people, label: 'Customers', onTap: () => Navigator.pushNamed(context, '/customers')),
                _QuickAction(icon: Icons.agriculture, label: 'Agri', onTap: () {}),
                _QuickAction(icon: Icons.qr_code, label: 'QR Pay', onTap: () {}),
                _QuickAction(icon: Icons.settings, label: 'Settings', onTap: () => Navigator.pushNamed(context, '/settings')),
              ],
            ),
            const SizedBox(height: 24),

            // Banking services
            Text('Banking Services', style: theme.textTheme.titleMedium),
            const SizedBox(height: 12),
            ..._bankingServices.map((s) => _ServiceTile(service: s)),

            if (!connectivity.isOnline) ...[
              const SizedBox(height: 24),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.amber.shade50,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.amber.shade200),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.cloud_off, color: Colors.amber),
                    SizedBox(width: 12),
                    Expanded(child: Text('You are offline. Operations will be queued and synced when connected.',
                        style: TextStyle(fontSize: 13))),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _QuickAction extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  const _QuickAction({required this.icon, required this.label, required this.onTap});
  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: Theme.of(context).colorScheme.primaryContainer, borderRadius: BorderRadius.circular(12)),
            child: Icon(icon, color: Theme.of(context).colorScheme.primary),
          ),
          const SizedBox(height: 6),
          Text(label, style: const TextStyle(fontSize: 11)),
        ],
      ),
    );
  }
}

final _bankingServices = [
  {'title': 'Mortgage Servicing', 'subtitle': 'Property loans & collateral', 'icon': Icons.home_work},
  {'title': 'Islamic Banking', 'subtitle': 'Murabaha, Ijara, Mudarabah', 'icon': Icons.mosque},
  {'title': 'Trade Finance', 'subtitle': 'Letters of credit & guarantees', 'icon': Icons.public},
  {'title': 'Esusu Groups', 'subtitle': 'Rotating savings', 'icon': Icons.group},
  {'title': 'Agent Banking', 'subtitle': 'Field agents & commissions', 'icon': Icons.storefront},
  {'title': 'Education Loans', 'subtitle': 'Student financing', 'icon': Icons.school},
  {'title': 'Virtual Accounts', 'subtitle': 'VAN management', 'icon': Icons.account_balance_wallet},
  {'title': 'Dispute Management', 'subtitle': 'Claims & chargebacks', 'icon': Icons.gavel},
];

class _ServiceTile extends StatelessWidget {
  final Map<String, dynamic> service;
  const _ServiceTile({required this.service});
  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: Icon(service['icon'] as IconData, color: Theme.of(context).colorScheme.primary),
        title: Text(service['title'] as String),
        subtitle: Text(service['subtitle'] as String, style: const TextStyle(fontSize: 12)),
        trailing: const Icon(Icons.chevron_right),
        onTap: () {},
      ),
    );
  }
}
