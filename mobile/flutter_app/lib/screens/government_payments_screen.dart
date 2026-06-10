import 'package:flutter/material.dart';
import '../services/api_service.dart';

class GovernmentPaymentsScreen extends StatefulWidget {
  const GovernmentPaymentsScreen({super.key});

  @override
  State<GovernmentPaymentsScreen> createState() => _GovernmentPaymentsScreenState();
}

class _GovernmentPaymentsScreenState extends State<GovernmentPaymentsScreen> {
  final ApiService _api = ApiService();
  String _selectedAgency = 'FIRS';

  final agencies = [
    {'code': 'FIRS', 'name': 'Federal Inland Revenue Service', 'icon': Icons.account_balance},
    {'code': 'NCS', 'name': 'Nigeria Customs Service', 'icon': Icons.local_shipping},
    {'code': 'NIMC', 'name': 'National Identity Management', 'icon': Icons.badge},
    {'code': 'CAC', 'name': 'Corporate Affairs Commission', 'icon': Icons.business},
    {'code': 'NIS', 'name': 'Nigeria Immigration Service', 'icon': Icons.flight},
    {'code': 'FRSC', 'name': 'Federal Road Safety Corps', 'icon': Icons.directions_car},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Government Payments')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text('Select Agency', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          ...agencies.map((a) => Card(
            margin: const EdgeInsets.only(bottom: 8),
            color: _selectedAgency == a['code'] ? Theme.of(context).primaryColor.withValues(alpha: 0.1) : null,
            child: ListTile(
              leading: CircleAvatar(child: Icon(a['icon'] as IconData)),
              title: Text(a['name'] as String),
              subtitle: Text(a['code'] as String),
              trailing: _selectedAgency == a['code'] ? const Icon(Icons.check_circle, color: Colors.green) : null,
              onTap: () => setState(() { _selectedAgency = a['code'] as String; }),
            ),
          )),
          const SizedBox(height: 16),
          ElevatedButton.icon(
            onPressed: () {},
            icon: const Icon(Icons.payment),
            label: Text('Make Payment to $_selectedAgency'),
          ),
        ],
      ),
    );
  }
}
