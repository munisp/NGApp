import 'package:flutter/material.dart';

class DpcoPortalScreen extends StatelessWidget {
  const DpcoPortalScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('DPCO Operations Portal'),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black87,
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Data Protection Compliance Organisation Management',
                style: TextStyle(color: Colors.grey[600], fontSize: 14)),
            const SizedBox(height: 16),
            Row(
              children: [
                _StatCard('Licensed DPCOs', '5', Colors.blue),
                const SizedBox(width: 8),
                _StatCard('Active Clients', '16', Colors.green),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                _StatCard('Pending CARs', '12', Colors.orange),
                const SizedBox(width: 8),
                _StatCard('Training', '10', Colors.purple),
              ],
            ),
            const SizedBox(height: 24),
            const Text('DPCO Functions',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
            const SizedBox(height: 12),
            ...[
              ('DPCO Registry', 'Licensed organisations', Icons.business),
              ('Client Portfolio', 'Engagement management', Icons.people),
              ('Audit Workspace', 'Compliance auditing', Icons.assignment),
              ('Verification Statements', 'Compliance verification', Icons.verified),
              ('Evidence Vault', 'Document management', Icons.folder_special),
              ('Performance Scorecard', 'DPCO metrics', Icons.score),
              ('Billing & Earnings', 'Revenue tracking', Icons.payment),
              ('AI Audit Tools', 'AI-powered assistance', Icons.smart_toy),
            ].map((item) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Card(
                child: ListTile(
                  leading: Icon(item.$3, color: Colors.blue),
                  title: Text(item.$1),
                  subtitle: Text(item.$2,
                      style: TextStyle(color: Colors.grey[500], fontSize: 12)),
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
                      fontSize: 22, fontWeight: FontWeight.w700, color: color)),
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
