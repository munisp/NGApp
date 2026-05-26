// Historian (QuestDB/TimescaleDB) — Flutter Screen (v42)
import 'package:flutter/material.dart';

class HistorianScreen extends StatelessWidget {
  const HistorianScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final streams = [
      {'tag': 'WELL-001.PRESSURE', 'type': 'float', 'active': true, 'retention': 365},
      {'tag': 'WELL-001.TEMPERATURE', 'type': 'float', 'active': true, 'retention': 365},
      {'tag': 'FPSO-001.FLOWRATE', 'type': 'float', 'active': true, 'retention': 730},
      {'tag': 'COMPRESSOR-01.STATUS', 'type': 'boolean', 'active': true, 'retention': 90},
    ];
    return Scaffold(
      backgroundColor: const Color(0xFF0d1117),
      appBar: AppBar(backgroundColor: const Color(0xFF161b22), title: const Text('Historian', style: TextStyle(color: Color(0xFFf59e0b), fontWeight: FontWeight.bold)), iconTheme: const IconThemeData(color: Color(0xFFe6edf3))),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        const Text('QuestDB / TimescaleDB Time-Series', style: TextStyle(color: Color(0xFF6b7280), fontSize: 13)),
        const SizedBox(height: 16),
        Row(children: [
          _kpi('156', 'Streams', const Color(0xFFe6edf3)),
          const SizedBox(width: 8),
          _kpi('148', 'Active', const Color(0xFF22c55e)),
          const SizedBox(width: 8),
          _kpi('80', 'Float Tags', const Color(0xFF3b82f6)),
        ]),
        const SizedBox(height: 16),
        const Text('Data Streams', style: TextStyle(color: Color(0xFFe6edf3), fontSize: 16, fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        ...streams.map((s) => Container(
          margin: const EdgeInsets.only(bottom: 8),
          decoration: BoxDecoration(color: const Color(0xFF161b22), borderRadius: BorderRadius.circular(8), border: Border.all(color: const Color(0xFF30363d))),
          padding: const EdgeInsets.all(14),
          child: Row(children: [
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(s['tag'].toString(), style: const TextStyle(color: Color(0xFFe6edf3), fontSize: 13, fontWeight: FontWeight.w600, fontFamily: 'monospace')),
              Text('${s['type']} · ${s['retention']}d retention', style: const TextStyle(color: Color(0xFF6b7280), fontSize: 11)),
            ])),
            Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3), decoration: BoxDecoration(color: const Color(0xFF22c55e22), borderRadius: BorderRadius.circular(4), border: Border.all(color: const Color(0xFF22c55e))),
              child: const Text('active', style: TextStyle(color: Color(0xFF22c55e), fontSize: 10, fontWeight: FontWeight.w600))),
          ]),
        )),
      ]),
    );
  }

  Widget _kpi(String value, String label, Color color) => Expanded(child: Container(
    decoration: BoxDecoration(color: const Color(0xFF161b22), borderRadius: BorderRadius.circular(8), border: Border.all(color: const Color(0xFF30363d))),
    padding: const EdgeInsets.all(12),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(value, style: TextStyle(color: color, fontSize: 20, fontWeight: FontWeight.bold)),
      Text(label, style: const TextStyle(color: Color(0xFF6b7280), fontSize: 11)),
    ]),
  ));
}
