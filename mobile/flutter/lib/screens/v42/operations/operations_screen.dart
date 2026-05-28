// Operations v42 — Flutter Screen
import 'package:flutter/material.dart';

class OperationsV42Screen extends StatelessWidget {
  const OperationsV42Screen({super.key});
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0d1117),
      appBar: AppBar(backgroundColor: const Color(0xFF161b22), title: const Text('Operations v42', style: TextStyle(color: Color(0xFFf59e0b), fontWeight: FontWeight.bold)), iconTheme: const IconThemeData(color: Color(0xFFe6edf3))),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        const Text('Allocation · Reservoir · Emissions · Drone', style: TextStyle(color: Color(0xFF6b7280), fontSize: 13)),
        const SizedBox(height: 16),
        _section('Production Allocation Engine', [
          _infoItem('Prorates well production to field/facility totals using configurable allocation rules.'),
          _infoItem('Methods: Volumetric, Model-driven (PINN), Manual override with audit trail.'),
        ]),
        _section('Emissions & Carbon Accounting', [
          _kpiRow('12,450 tCO₂e', 'Total Emissions', const Color(0xFFef4444)),
          _kpiRow('8 sources', 'Emission Sources', const Color(0xFFf59e0b)),
        ]),
        _section('Drone Inspection Management', [
          _kpiRow('15 total', 'Inspections', const Color(0xFFe6edf3)),
          _kpiRow('8 completed', 'Completed', const Color(0xFF22c55e)),
          _kpiRow('3 in progress', 'In Progress', const Color(0xFFf59e0b)),
        ]),
      ]),
    );
  }

  Widget _section(String title, List<Widget> children) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    Text(title, style: const TextStyle(color: Color(0xFFe6edf3), fontSize: 15, fontWeight: FontWeight.w600)),
    const SizedBox(height: 8),
    Container(margin: const EdgeInsets.only(bottom: 16), decoration: BoxDecoration(color: const Color(0xFF161b22), borderRadius: BorderRadius.circular(8), border: Border.all(color: const Color(0xFF30363d))),
      padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: children)),
  ]);

  Widget _infoItem(String text) => Padding(padding: const EdgeInsets.only(bottom: 6), child: Text(text, style: const TextStyle(color: Color(0xFF9ca3af), fontSize: 12)));
  Widget _kpiRow(String value, String label, Color color) => Padding(padding: const EdgeInsets.only(bottom: 6), child: Row(children: [
    Text(value, style: TextStyle(color: color, fontSize: 16, fontWeight: FontWeight.bold)),
    const SizedBox(width: 8),
    Text(label, style: const TextStyle(color: Color(0xFF6b7280), fontSize: 12)),
  ]));
}
