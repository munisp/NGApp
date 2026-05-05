import 'package:flutter/material.dart';

class CampaignScreen extends StatelessWidget {
  const CampaignScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final campaigns = [
      {'name': 'Q2 Cross-sell — Savings', 'channel': 'WhatsApp', 'status': 'active', 'sent': 12500, 'delivered': 12312, 'opened': 8456, 'converted': 1234, 'revenue': 45000000},
      {'name': 'Agent Recruitment Drive', 'channel': 'SMS', 'status': 'active', 'sent': 5000, 'delivered': 4890, 'opened': 3200, 'converted': 450, 'revenue': 12000000},
      {'name': 'Dormant Account Revival', 'channel': 'Voice', 'status': 'completed', 'sent': 800, 'delivered': 780, 'opened': 650, 'converted': 120, 'revenue': 8500000},
      {'name': 'Mobile Money Promo', 'channel': 'WhatsApp', 'status': 'draft', 'sent': 0, 'delivered': 0, 'opened': 0, 'converted': 0, 'revenue': 0},
    ];

    return Scaffold(
      appBar: AppBar(title: const Text('Campaigns', style: TextStyle(fontWeight: FontWeight.bold))),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Quick Stats
          Row(
            children: [
              Expanded(child: _statCard('Active', '2', Colors.green)),
              const SizedBox(width: 8),
              Expanded(child: _statCard('Sent', '18.3K', Colors.blue)),
              const SizedBox(width: 8),
              Expanded(child: _statCard('Converted', '1.8K', Colors.purple)),
            ],
          ),
          const SizedBox(height: 16),
          ...campaigns.map((c) => Card(
            margin: const EdgeInsets.only(bottom: 8),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(child: Text(c['name'] as String, style: const TextStyle(fontWeight: FontWeight.w600))),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: c['status'] == 'active' ? Colors.green.withOpacity(0.1) : c['status'] == 'completed' ? Colors.blue.withOpacity(0.1) : Colors.grey.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(c['status'] as String, style: TextStyle(fontSize: 11, color: c['status'] == 'active' ? Colors.green : c['status'] == 'completed' ? Colors.blue : Colors.grey)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text('Channel: ${c['channel']}', style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.onSurfaceVariant)),
                  if ((c['sent'] as int) > 0) ...[
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        _metric('Sent', '${((c['sent'] as int) / 1000).toStringAsFixed(1)}K'),
                        _metric('Delivered', '${(((c['delivered'] as int) / (c['sent'] as int)) * 100).toStringAsFixed(0)}%'),
                        _metric('Opened', '${(((c['opened'] as int) / (c['sent'] as int)) * 100).toStringAsFixed(0)}%'),
                        _metric('Converted', '${c['converted']}'),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          )),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {},
        icon: const Icon(Icons.add),
        label: const Text('New Campaign'),
      ),
    );
  }

  Widget _statCard(String label, String value, Color color) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          children: [
            Text(value, style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: color)),
            Text(label, style: const TextStyle(fontSize: 12)),
          ],
        ),
      ),
    );
  }

  Widget _metric(String label, String value) {
    return Column(
      children: [
        Text(value, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
        Text(label, style: const TextStyle(fontSize: 10, color: Colors.grey)),
      ],
    );
  }
}
