import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class AtmManagementScreen extends StatelessWidget {
  const AtmManagementScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'ATM Management',
      apiEndpoint: '/api/atm/v1/machines',
      columnKeys: const ['terminal', 'location', 'cash', 'status'],
      columnLabels: const ['Terminal', 'Location', 'Cash Level', 'Status'],
      seedData: const [
      {'terminal': 'ATM-LAG-001', 'location': 'Marina, Lagos', 'cash': '72%', 'status': 'Online'},
      {'terminal': 'ATM-ABJ-001', 'location': 'Garki, Abuja', 'cash': '45%', 'status': 'Low Cash'},
      {'terminal': 'ATM-KAN-001', 'location': 'Nassarawa, Kano', 'cash': '0%', 'status': 'Out of Cash'},
    ],
    );
  }
}
