import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class MojaloopAdminLimitsScreen extends StatelessWidget {
  const MojaloopAdminLimitsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Admin Limits',
      apiEndpoint: '/api/platform/mojaloop/admin/limits',
      columnKeys: const ['fspId', 'limitType', 'value', 'currentUsage', 'utilizationPct', 'status'],
      columnLabels: const ['FSP', 'Limit Type', 'Limit', 'Usage', 'Util %', 'Status'],
      seedData: const [
              {'fspId': '54BANK', 'limitType': 'NET_DEBIT_CAP', 'value': '500000000000', 'currentUsage': '42000000000', 'utilizationPct': '8.4', 'status': 'active'},
              {'fspId': '54BANK', 'limitType': 'DAILY_TRANSFER_LIMIT', 'value': '100000000000', 'currentUsage': '35000000000', 'utilizationPct': '35', 'status': 'active'},
      ],
    );
  }
}
