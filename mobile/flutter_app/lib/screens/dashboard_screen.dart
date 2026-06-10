import 'package:flutter/material.dart';

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Dashboard')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: _StatCard(title: 'Total Sent', value: '₦5.2M', color: Colors.blue)),
            const SizedBox(width: 12),
            Expanded(child: _StatCard(title: 'Total Received', value: '₦3.8M', color: Colors.green)),
          ]),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(child: _StatCard(title: 'Transactions', value: '142', color: Colors.orange)),
            const SizedBox(width: 12),
            Expanded(child: _StatCard(title: 'Active Disputes', value: '2', color: Colors.red)),
          ]),
          const SizedBox(height: 24),
          Text('Transaction History', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          ...List.generate(10, (i) => ListTile(
            leading: CircleAvatar(backgroundColor: i % 2 == 0 ? Colors.red.shade100 : Colors.green.shade100, child: Icon(i % 2 == 0 ? Icons.arrow_upward : Icons.arrow_downward, color: i % 2 == 0 ? Colors.red : Colors.green)),
            title: Text('Transaction #${1000 + i}'),
            subtitle: Text('May ${2 - (i ~/ 3)}, 2026'),
            trailing: Text('₦${(50000 - i * 3000).toString()}', style: TextStyle(fontWeight: FontWeight.bold, color: i % 2 == 0 ? Colors.red : Colors.green)),
          )),
        ]),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String title, value;
  final Color color;
  const _StatCard({required this.title, required this.value, required this.color});
  @override
  Widget build(BuildContext context) {
    return Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(title, style: Theme.of(context).textTheme.bodySmall),
      const SizedBox(height: 8),
      Text(value, style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold, color: color)),
    ])));
  }
}
