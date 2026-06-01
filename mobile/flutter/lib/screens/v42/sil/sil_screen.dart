// SIL 2 Functional Safety — Flutter Screen (v42)
import 'package:flutter/material.dart';

class SilScreen extends StatefulWidget {
  const SilScreen({super.key});
  @override
  State<SilScreen> createState() => _SilScreenState();
}

class _SilScreenState extends State<SilScreen> {
  bool _loading = true;
  final List<Map<String, dynamic>> _functions = [];

  @override
  void initState() {
    super.initState();
    Future.delayed(const Duration(milliseconds: 500), () {
      setState(() {
        _functions.addAll([
          {'name': 'High Pressure Shutdown (HIPPS)', 'sil': 2, 'status': 'active', 'nextTest': '2025-06-01'},
          {'name': 'Emergency Depressurization (EDP)', 'sil': 3, 'status': 'active', 'nextTest': '2025-03-15'},
          {'name': 'Fire & Gas Detection Shutdown', 'sil': 2, 'status': 'active', 'nextTest': '2025-09-01'},
        ]);
        _loading = false;
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(backgroundColor: Color(0xFF0d1117), body: Center(child: CircularProgressIndicator(color: Color(0xFFf59e0b))));
    return Scaffold(
      backgroundColor: const Color(0xFF0d1117),
      appBar: AppBar(backgroundColor: const Color(0xFF161b22), title: const Text('SIL 2 Safety', style: TextStyle(color: Color(0xFFf59e0b), fontWeight: FontWeight.bold)), iconTheme: const IconThemeData(color: Color(0xFFe6edf3))),
      body: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _functions.length + 1,
        itemBuilder: (ctx, i) {
          if (i == 0) return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Functional Safety Management', style: TextStyle(color: Color(0xFF6b7280), fontSize: 13)),
            const SizedBox(height: 16),
            Row(children: [
              _kpi('${_functions.length}', 'SIFs', const Color(0xFFe6edf3)),
              const SizedBox(width: 8),
              _kpi('2', 'Overdue', const Color(0xFFef4444)),
              const SizedBox(width: 8),
              _kpi('7', 'SIL 2', const Color(0xFF22c55e)),
            ]),
            const SizedBox(height: 16),
            const Text('Safety Instrumented Functions', style: TextStyle(color: Color(0xFFe6edf3), fontSize: 16, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
          ]);
          final fn = _functions[i - 1];
          return Container(
            margin: const EdgeInsets.only(bottom: 8),
            decoration: BoxDecoration(color: const Color(0xFF161b22), borderRadius: BorderRadius.circular(8), border: Border.all(color: const Color(0xFF30363d))),
            padding: const EdgeInsets.all(14),
            child: Row(children: [
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(fn['name'], style: const TextStyle(color: Color(0xFFe6edf3), fontSize: 13, fontWeight: FontWeight.w600)),
                const SizedBox(height: 4),
                Text('SIL ${fn['sil']} · Next test: ${fn['nextTest']}', style: const TextStyle(color: Color(0xFF6b7280), fontSize: 11)),
              ])),
              Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3), decoration: BoxDecoration(color: const Color(0xFF22c55e22), borderRadius: BorderRadius.circular(4), border: Border.all(color: const Color(0xFF22c55e))),
                child: const Text('active', style: TextStyle(color: Color(0xFF22c55e), fontSize: 10, fontWeight: FontWeight.w600))),
            ]),
          );
        },
      ),
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
