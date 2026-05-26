import 'package:flutter/material.dart';

class ComplianceScreen extends StatelessWidget {
  const ComplianceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final frameworks = [
      {'name': 'NDPR', 'full': 'Nigeria Data Protection', 'score': 93.8, 'controls': 8, 'compliant': 7},
      {'name': 'CBN', 'full': 'Central Bank of Nigeria', 'score': 95.0, 'controls': 10, 'compliant': 9},
      {'name': 'PCI-DSS', 'full': 'Payment Card Industry', 'score': 93.8, 'controls': 8, 'compliant': 7},
      {'name': 'AML/CFT', 'full': 'Anti-Money Laundering', 'score': 100.0, 'controls': 8, 'compliant': 8},
    ];

    return Scaffold(
      appBar: AppBar(title: const Text('Compliance', style: TextStyle(fontWeight: FontWeight.bold))),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            color: Colors.green.shade50,
            child: const Padding(
              padding: EdgeInsets.all(16),
              child: Column(
                children: [
                  Icon(Icons.verified, size: 48, color: Colors.green),
                  SizedBox(height: 8),
                  Text('95.7%', style: TextStyle(fontSize: 36, fontWeight: FontWeight.bold, color: Colors.green)),
                  Text('Overall Compliance Score', style: TextStyle(color: Colors.green)),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          ...frameworks.map((f) => Card(
            margin: const EdgeInsets.only(bottom: 8),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(f['name'] as String, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                        Text(f['full'] as String, style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.onSurfaceVariant)),
                      ]),
                      Text('${f['score']}%', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: (f['score'] as double) >= 95 ? Colors.green : Colors.orange)),
                    ],
                  ),
                  const SizedBox(height: 8),
                  LinearProgressIndicator(value: (f['score'] as double) / 100, backgroundColor: Colors.grey.shade200, color: (f['score'] as double) >= 95 ? Colors.green : Colors.orange),
                  const SizedBox(height: 4),
                  Text('${f['compliant']}/${f['controls']} controls compliant', style: const TextStyle(fontSize: 11, color: Colors.grey)),
                ],
              ),
            ),
          )),
        ],
      ),
    );
  }
}
