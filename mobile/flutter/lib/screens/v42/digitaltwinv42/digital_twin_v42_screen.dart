// 3D Digital Twin v42 — Flutter Screen
import 'package:flutter/material.dart';

class DigitalTwinV42Screen extends StatelessWidget {
  const DigitalTwinV42Screen({super.key});
  @override
  Widget build(BuildContext context) {
    final models = [
      {'id': 'DT-WELL001', 'name': 'Well ALPHA-001 Digital Twin', 'type': 'wellhead'},
      {'id': 'DT-FPSO001', 'name': 'FPSO Titan Digital Twin', 'type': 'fpso'},
      {'id': 'DT-COMP001', 'name': 'Compressor Train A', 'type': 'compressor'},
    ];
    return Scaffold(
      backgroundColor: const Color(0xFF0d1117),
      appBar: AppBar(backgroundColor: const Color(0xFF161b22), title: const Text('3D Digital Twin v42', style: TextStyle(color: Color(0xFFf59e0b), fontWeight: FontWeight.bold)), iconTheme: const IconThemeData(color: Color(0xFFe6edf3))),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        Container(padding: const EdgeInsets.all(12), decoration: BoxDecoration(color: const Color(0xFF1e3a5f), borderRadius: BorderRadius.circular(8), border: Border.all(color: const Color(0xFF3b82f6))),
          child: const Text('3D rendering available in web PWA. Mobile shows model list and sensor bindings.', style: TextStyle(color: Color(0xFF93c5fd), fontSize: 12))),
        const SizedBox(height: 16),
        const Text('Twin Models', style: TextStyle(color: Color(0xFFe6edf3), fontSize: 16, fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        ...models.map((m) => Container(
          margin: const EdgeInsets.only(bottom: 8),
          decoration: BoxDecoration(color: const Color(0xFF161b22), borderRadius: BorderRadius.circular(8), border: Border.all(color: const Color(0xFF30363d))),
          padding: const EdgeInsets.all(14),
          child: Row(children: [
            Text(m['type'] == 'fpso' ? '🛢️' : m['type'] == 'wellhead' ? '⛽' : '⚙️', style: const TextStyle(fontSize: 24)),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(m['name']!, style: const TextStyle(color: Color(0xFFe6edf3), fontSize: 13, fontWeight: FontWeight.w600)),
              Text('${m['id']} · ${m['type']}', style: const TextStyle(color: Color(0xFF6b7280), fontSize: 11)),
            ])),
            Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3), decoration: BoxDecoration(color: const Color(0xFF22c55e22), borderRadius: BorderRadius.circular(4), border: Border.all(color: const Color(0xFF22c55e))),
              child: const Text('active', style: TextStyle(color: Color(0xFF22c55e), fontSize: 10, fontWeight: FontWeight.w600))),
          ]),
        )),
      ]),
    );
  }
}
