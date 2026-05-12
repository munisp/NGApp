import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class TbMulticurrencyScreen extends StatelessWidget {
  const TbMulticurrencyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'TigerBeetle Multi-Currency',
      apiEndpoint: '/api/ai-ml/tb-multicurrency/accounts',
      columnKeys: const ['id', 'currency', 'code', 'totalAccounts', 'fxRateNgn'],
      columnLabels: const ['ID', 'Currency', 'Code', 'Accounts', 'FX Rate'],
      seedData: const [
        {'id': 'TB_MULTICURRENCY-001', 'status': 'active'},
        {'id': 'TB_MULTICURRENCY-002', 'status': 'pending'},
      ],
    );
  }
}
