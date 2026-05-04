import 'package:flutter/material.dart';

class BankingDashboardScreen extends StatelessWidget {
  const BankingDashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Banking Services'),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black87,
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('CBN-Regulated Institution Monitoring',
                style: TextStyle(color: Colors.grey[600], fontSize: 14)),
            const SizedBox(height: 16),
            Row(
              children: [
                _StatCard('Institutions', '18', Colors.blue),
                const SizedBox(width: 8),
                _StatCard('Licensed', '12', Colors.green),
                const SizedBox(width: 8),
                _StatCard('Suspended', '2', Colors.red),
                const SizedBox(width: 8),
                _StatCard('Avg Score', '76%', Colors.blue),
              ],
            ),
            const SizedBox(height: 24),
            const Text('Quick Actions',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
            const SizedBox(height: 12),
            ...[
              'KYC Management',
              'AML Cases',
              'SWIFT Transactions',
              'Fraud Alerts',
              'CBN Reports',
              'Correspondent Banks',
              'Watchlist Screening',
              'Payments Monitor'
            ].map((action) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Card(
                child: ListTile(
                  title: Text(action),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () {},
                ),
              ),
            )),
          ],
        ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _StatCard(this.label, this.value, this.color);

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            children: [
              Text(value,
                  style: TextStyle(
                      fontSize: 20, fontWeight: FontWeight.w700, color: color)),
              const SizedBox(height: 4),
              Text(label,
                  style: TextStyle(fontSize: 11, color: Colors.grey[500]),
                  textAlign: TextAlign.center),
            ],
          ),
        ),
      ),
    );
  }
}
