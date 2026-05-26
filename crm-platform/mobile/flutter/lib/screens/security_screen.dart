import 'package:flutter/material.dart';

class SecurityScreen extends StatelessWidget {
  const SecurityScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Security', style: TextStyle(fontWeight: FontWeight.bold))),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            color: Colors.green.shade50,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  const Icon(Icons.shield, size: 48, color: Colors.green),
                  const SizedBox(height: 8),
                  const Text('96.8%', style: TextStyle(fontSize: 36, fontWeight: FontWeight.bold, color: Colors.green)),
                  Text('Security Score', style: TextStyle(color: Colors.green.shade700)),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          _statusTile('DDoS Protection', 'Active', Icons.flash_on, Colors.green),
          _statusTile('WAF Engine', '14 Rules Active', Icons.security, Colors.blue),
          _statusTile('PBAC', '6 Policies', Icons.lock, Colors.purple),
          _statusTile('Encryption', 'AES-256-GCM', Icons.enhanced_encryption, Colors.orange),
          _statusTile('Threats Blocked (24h)', '142', Icons.block, Colors.red),
          _statusTile('Circuit Breaker', 'Closed', Icons.memory, Colors.green),
          const SizedBox(height: 16),
          const Text('OWASP Top 10 Coverage', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          ...['A01: Broken Access Control', 'A02: Crypto Failures', 'A03: Injection',
              'A04: Insecure Design', 'A05: Security Misconfig', 'A06: Vulnerable Components',
              'A07: Auth Failures', 'A08: Data Integrity', 'A09: Logging Failures', 'A10: SSRF'].map(
            (item) => ListTile(
              dense: true,
              leading: const Icon(Icons.check_circle, color: Colors.green, size: 20),
              title: Text(item, style: const TextStyle(fontSize: 13)),
              trailing: Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(color: Colors.green.withOpacity(0.1), borderRadius: BorderRadius.circular(4)),
                child: const Text('Protected', style: TextStyle(fontSize: 10, color: Colors.green)),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _statusTile(String label, String value, IconData icon, Color color) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: CircleAvatar(backgroundColor: color.withOpacity(0.1), child: Icon(icon, color: color, size: 20)),
        title: Text(label, style: const TextStyle(fontSize: 14)),
        trailing: Text(value, style: TextStyle(fontWeight: FontWeight.w600, color: color)),
      ),
    );
  }
}
