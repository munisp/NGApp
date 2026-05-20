import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class PosTerminalScreen extends StatelessWidget {
  const PosTerminalScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'POS Terminal',
      apiEndpoint: '/api/pos/v1/terminals',
      columnKeys: const ['terminal', 'merchant', 'location', 'txns', 'status'],
      columnLabels: const ['Terminal', 'Merchant', 'Location', 'Txns Today', 'Status'],
      seedData: const [
      {'terminal': 'POS-2030001', 'merchant': 'Chicken Republic VI', 'location': 'Victoria Island', 'txns': '145', 'status': 'Online'},
      {'terminal': 'POS-2030002', 'merchant': 'Shoprite Jabi', 'location': 'Jabi, Abuja', 'txns': '89', 'status': 'Online'},
    ],
    );
  }
}
