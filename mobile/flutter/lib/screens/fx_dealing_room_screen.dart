import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class FxDealingRoomScreen extends StatelessWidget {
  const FxDealingRoomScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'FX Dealing Room',
      apiEndpoint: '/api/fx/v1/deals',
      columnKeys: const ['id', 'pair', 'amount', 'rate', 'status'],
      columnLabels: const ['ID', 'Pair', 'Amount', 'Rate', 'Status'],
      seedData: const [
      {'id': 'FX-001', 'pair': 'USD/NGN', 'amount': 'USD 5M', 'rate': '1,565', 'status': 'Settled'},
    ],
    );
  }
}
