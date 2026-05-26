// SaaS Platform — Flutter Screen (v42)
import 'package:flutter/material.dart';

class SaasScreen extends StatelessWidget {
  const SaasScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0d1117),
      appBar: AppBar(backgroundColor: const Color(0xFF161b22), title: const Text('SaaS Platform', style: TextStyle(color: Color(0xFFf59e0b), fontWeight: FontWeight.bold)), iconTheme: const IconThemeData(color: Color(0xFFe6edf3))),
      body: SingleChildScrollView(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('White-label Billing & Analytics Marketplace', style: TextStyle(color: Color(0xFF6b7280), fontSize: 13)),
        const SizedBox(height: 16),
        GridView.count(crossAxisCount: 2, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), mainAxisSpacing: 8, crossAxisSpacing: 8, childAspectRatio: 2.2, children: [
          _kpi('4', 'Plans', const Color(0xFFe6edf3)),
          _kpi('12', 'Active Subs', const Color(0xFF22c55e)),
          _kpi('\$24.5k', 'MRR', const Color(0xFFf59e0b)),
          _kpi('8', 'Marketplace Apps', const Color(0xFFa855f7)),
        ]),
        const SizedBox(height: 16),
        Container(padding: const EdgeInsets.all(14), decoration: BoxDecoration(color: const Color(0xFF161b22), borderRadius: BorderRadius.circular(8), border: Border.all(color: const Color(0xFF30363d))),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Marketplace', style: TextStyle(color: Color(0xFFe6edf3), fontSize: 14, fontWeight: FontWeight.w600)),
            const SizedBox(height: 4),
            const Text('31 total app installs across all tenants.', style: TextStyle(color: Color(0xFF9ca3af), fontSize: 12)),
          ])),
      ])),
    );
  }

  Widget _kpi(String value, String label, Color color) => Container(
    decoration: BoxDecoration(color: const Color(0xFF161b22), borderRadius: BorderRadius.circular(8), border: Border.all(color: const Color(0xFF30363d))),
    padding: const EdgeInsets.all(12),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [
      Text(value, style: TextStyle(color: color, fontSize: 20, fontWeight: FontWeight.bold)),
      Text(label, style: const TextStyle(color: Color(0xFF6b7280), fontSize: 11)),
    ]),
  );
}
