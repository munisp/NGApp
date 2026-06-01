// SOC 2 Audit Trail — Flutter Screen (v42)
import 'package:flutter/material.dart';

class Soc2Screen extends StatelessWidget {
  const Soc2Screen({super.key});
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0d1117),
      appBar: AppBar(backgroundColor: const Color(0xFF161b22), title: const Text('SOC 2 Audit', style: TextStyle(color: Color(0xFFf59e0b), fontWeight: FontWeight.bold)), iconTheme: const IconThemeData(color: Color(0xFFe6edf3))),
      body: SingleChildScrollView(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Trust Services Criteria Compliance', style: TextStyle(color: Color(0xFF6b7280), fontSize: 13)),
        const SizedBox(height: 16),
        GridView.count(crossAxisCount: 2, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), mainAxisSpacing: 8, crossAxisSpacing: 8, childAspectRatio: 2.2, children: [
          _kpi('28', 'Controls', const Color(0xFFe6edf3)),
          _kpi('20', 'Compliant', const Color(0xFF22c55e)),
          _kpi('3', 'Non-Compliant', const Color(0xFFef4444)),
          _kpi('147', 'Events (24h)', const Color(0xFF3b82f6)),
        ]),
        const SizedBox(height: 16),
        const Text('Recent Audit Events', style: TextStyle(color: Color(0xFFe6edf3), fontSize: 16, fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        _eventRow('user.login', 'john.doe', 'system', 'success'),
        _eventRow('data.export', 'jane.smith', 'well_data', 'success'),
        _eventRow('config.change', 'admin', 'alarm_rules', 'success'),
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

  Widget _eventRow(String type, String actor, String resource, String outcome) => Container(
    margin: const EdgeInsets.only(bottom: 8),
    decoration: BoxDecoration(color: const Color(0xFF161b22), borderRadius: BorderRadius.circular(8), border: Border.all(color: const Color(0xFF30363d))),
    padding: const EdgeInsets.all(12),
    child: Row(children: [
      Container(width: 8, height: 8, decoration: const BoxDecoration(color: Color(0xFF3b82f6), shape: BoxShape.circle)),
      const SizedBox(width: 10),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(type, style: const TextStyle(color: Color(0xFFe6edf3), fontSize: 13, fontWeight: FontWeight.w600, fontFamily: 'monospace')),
        Text('$actor · $resource', style: const TextStyle(color: Color(0xFF6b7280), fontSize: 11)),
      ])),
      Container(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2), decoration: BoxDecoration(color: const Color(0xFF22c55e22), borderRadius: BorderRadius.circular(4), border: Border.all(color: const Color(0xFF22c55e))),
        child: Text(outcome, style: const TextStyle(color: Color(0xFF22c55e), fontSize: 10, fontWeight: FontWeight.w600))),
    ]),
  );
}
