// IEC 62443 Cybersecurity Compliance — Flutter Screen (v42)
import 'package:flutter/material.dart';

class Iec62443Screen extends StatefulWidget {
  const Iec62443Screen({super.key});
  @override
  State<Iec62443Screen> createState() => _Iec62443ScreenState();
}

class _Iec62443ScreenState extends State<Iec62443Screen> {
  bool _loading = true;
  int _total = 0, _completed = 0, _inProgress = 0;
  int _completionPct = 0;
  final List<Map<String, dynamic>> _controls = [];

  @override
  void initState() {
    super.initState();
    Future.delayed(const Duration(milliseconds: 500), () {
      setState(() {
        _total = 42; _completed = 18; _inProgress = 12; _completionPct = 43;
        _controls.addAll([
          {'id': 'IEC-SR-1.1', 'title': 'Human User Identification and Authentication', 'zone': 'OT Zone 1', 'status': 'completed'},
          {'id': 'IEC-SR-1.2', 'title': 'Software Process and Device Identification', 'zone': 'OT Zone 1', 'status': 'in_progress'},
          {'id': 'IEC-SR-2.1', 'title': 'Authorization Enforcement', 'zone': 'OT Zone 2', 'status': 'not_started'},
          {'id': 'IEC-SR-3.1', 'title': 'Communication Integrity', 'zone': 'DMZ', 'status': 'completed'},
        ]);
        _loading = false;
      });
    });
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'completed': return const Color(0xFF22c55e);
      case 'in_progress': return const Color(0xFFf59e0b);
      case 'not_applicable': return const Color(0xFF3b82f6);
      default: return const Color(0xFF6b7280);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(backgroundColor: Color(0xFF0d1117), body: Center(child: CircularProgressIndicator(color: Color(0xFFf59e0b))));
    return Scaffold(
      backgroundColor: const Color(0xFF0d1117),
      appBar: AppBar(backgroundColor: const Color(0xFF161b22), title: const Text('IEC 62443', style: TextStyle(color: Color(0xFFf59e0b), fontWeight: FontWeight.bold)), iconTheme: const IconThemeData(color: Color(0xFFe6edf3))),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Cybersecurity Compliance', style: TextStyle(color: Color(0xFF6b7280), fontSize: 13)),
          const SizedBox(height: 16),
          GridView.count(crossAxisCount: 2, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), mainAxisSpacing: 8, crossAxisSpacing: 8, childAspectRatio: 2.2, children: [
            _kpiCard('$_total', 'Total Controls', const Color(0xFFe6edf3)),
            _kpiCard('$_completionPct%', 'Completion', const Color(0xFF22c55e)),
            _kpiCard('$_inProgress', 'In Progress', const Color(0xFFf59e0b)),
            _kpiCard('${_total - _completed - _inProgress}', 'Not Started', const Color(0xFF6b7280)),
          ]),
          const SizedBox(height: 16),
          const Text('Security Controls', style: TextStyle(color: Color(0xFFe6edf3), fontSize: 16, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          ..._controls.map((c) => _controlCard(c)),
        ]),
      ),
    );
  }

  Widget _kpiCard(String value, String label, Color color) => Container(
    decoration: BoxDecoration(color: const Color(0xFF161b22), borderRadius: BorderRadius.circular(8), border: Border.all(color: const Color(0xFF30363d))),
    padding: const EdgeInsets.all(12),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [
      Text(value, style: TextStyle(color: color, fontSize: 20, fontWeight: FontWeight.bold)),
      Text(label, style: const TextStyle(color: Color(0xFF6b7280), fontSize: 11)),
    ]),
  );

  Widget _controlCard(Map<String, dynamic> c) => Container(
    margin: const EdgeInsets.only(bottom: 8),
    decoration: BoxDecoration(color: const Color(0xFF161b22), borderRadius: BorderRadius.circular(8), border: Border.all(color: const Color(0xFF30363d))),
    padding: const EdgeInsets.all(14),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        Text(c['id'], style: const TextStyle(color: Color(0xFFf59e0b), fontSize: 12, fontFamily: 'monospace', fontWeight: FontWeight.w600)),
        Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2), decoration: BoxDecoration(color: _statusColor(c['status']).withOpacity(0.2), borderRadius: BorderRadius.circular(4), border: Border.all(color: _statusColor(c['status']))),
          child: Text(c['status'].toString().replaceAll('_', ' '), style: TextStyle(color: _statusColor(c['status']), fontSize: 10, fontWeight: FontWeight.w600))),
      ]),
      const SizedBox(height: 4),
      Text(c['title'], style: const TextStyle(color: Color(0xFFe6edf3), fontSize: 13)),
      const SizedBox(height: 4),
      Text('Zone: ${c['zone']}', style: const TextStyle(color: Color(0xFF6b7280), fontSize: 11)),
    ]),
  );
}
