// OSDU/WITSML/SAP Integrations — Flutter Screen (v42)
import 'package:flutter/material.dart';

class IntegrationsScreen extends StatelessWidget {
  const IntegrationsScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final integrations = [
      {'name': 'OSDU R3', 'desc': 'Open Subsurface Data Universe', 'count': '24 datasets', 'color': const Color(0xFF3b82f6)},
      {'name': 'WITSML 2.0', 'desc': 'Well Information Transfer Markup Language', 'count': '18 wells', 'color': const Color(0xFF22c55e)},
      {'name': 'OPC-UA Server', 'desc': 'Industrial Automation Protocol', 'count': '312 nodes', 'color': const Color(0xFFf59e0b)},
      {'name': 'SAP PM / Maximo', 'desc': 'CMMS Work Order Integration', 'count': '7 work orders', 'color': const Color(0xFFa855f7)},
    ];
    return Scaffold(
      backgroundColor: const Color(0xFF0d1117),
      appBar: AppBar(backgroundColor: const Color(0xFF161b22), title: const Text('Integrations', style: TextStyle(color: Color(0xFFf59e0b), fontWeight: FontWeight.bold)), iconTheme: const IconThemeData(color: Color(0xFFe6edf3))),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        const Text('OSDU · WITSML · PRODML · OPC-UA · SAP/Maximo', style: TextStyle(color: Color(0xFF6b7280), fontSize: 13)),
        const SizedBox(height: 16),
        ...integrations.map((intg) {
          final color = intg['color'] as Color;
          return Container(
            margin: const EdgeInsets.only(bottom: 10),
            decoration: BoxDecoration(color: const Color(0xFF161b22), borderRadius: BorderRadius.circular(8), border: Border.all(color: const Color(0xFF30363d))),
            child: Row(children: [
              Container(width: 4, height: 80, decoration: BoxDecoration(color: color, borderRadius: const BorderRadius.only(topLeft: Radius.circular(8), bottomLeft: Radius.circular(8)))),
              Expanded(child: Padding(padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(intg['name'].toString(), style: const TextStyle(color: Color(0xFFe6edf3), fontSize: 15, fontWeight: FontWeight.w700)),
                const SizedBox(height: 2),
                Text(intg['desc'].toString(), style: const TextStyle(color: Color(0xFF6b7280), fontSize: 12)),
                const SizedBox(height: 6),
                Text(intg['count'].toString(), style: TextStyle(color: color, fontSize: 18, fontWeight: FontWeight.bold)),
              ]))),
            ]),
          );
        }),
      ]),
    );
  }
}
