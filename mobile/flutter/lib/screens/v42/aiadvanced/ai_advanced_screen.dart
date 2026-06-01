// PINN & Agentic AI — Flutter Screen (v42)
import 'package:flutter/material.dart';

class AiAdvancedScreen extends StatelessWidget {
  const AiAdvancedScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final models = [
      {'name': 'Well ALPHA-001 IPR Model', 'type': 'inflow_performance', 'status': 'trained', 'acc': '94.0%'},
      {'name': 'Field-Wide Nodal Analysis', 'type': 'nodal_analysis', 'status': 'training', 'acc': 'N/A'},
      {'name': 'Reservoir Pressure Predictor', 'type': 'reservoir_pressure', 'status': 'trained', 'acc': '91.2%'},
    ];
    return Scaffold(
      backgroundColor: const Color(0xFF0d1117),
      appBar: AppBar(backgroundColor: const Color(0xFF161b22), title: const Text('PINN & Agentic AI', style: TextStyle(color: Color(0xFFf59e0b), fontWeight: FontWeight.bold)), iconTheme: const IconThemeData(color: Color(0xFFe6edf3))),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        const Text('Physics-Informed Neural Networks + Autonomous Workflows', style: TextStyle(color: Color(0xFF6b7280), fontSize: 13)),
        const SizedBox(height: 16),
        const Text('PINN Models', style: TextStyle(color: Color(0xFFe6edf3), fontSize: 16, fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        ...models.map((m) => Container(
          margin: const EdgeInsets.only(bottom: 8),
          decoration: BoxDecoration(color: const Color(0xFF161b22), borderRadius: BorderRadius.circular(8), border: Border.all(color: const Color(0xFF30363d))),
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              Expanded(child: Text(m['name']!, style: const TextStyle(color: Color(0xFFe6edf3), fontSize: 13, fontWeight: FontWeight.w600))),
              Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3), decoration: BoxDecoration(color: m['status'] == 'trained' ? const Color(0xFF22c55e22) : const Color(0xFFf59e0b22), borderRadius: BorderRadius.circular(4), border: Border.all(color: m['status'] == 'trained' ? const Color(0xFF22c55e) : const Color(0xFFf59e0b))),
                child: Text(m['status']!, style: TextStyle(color: m['status'] == 'trained' ? const Color(0xFF22c55e) : const Color(0xFFf59e0b), fontSize: 10, fontWeight: FontWeight.w600))),
            ]),
            const SizedBox(height: 4),
            Text(m['type']!.replaceAll('_', ' '), style: const TextStyle(color: Color(0xFF6b7280), fontSize: 11)),
            if (m['acc'] != 'N/A') Text('Accuracy: ${m['acc']}', style: const TextStyle(color: Color(0xFF22c55e), fontSize: 12)),
          ]),
        )),
      ]),
    );
  }
}
