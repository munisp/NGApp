import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class UssdTransactionEngineScreen extends StatelessWidget {
  const UssdTransactionEngineScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'USSD Transaction Engine',
      apiPath: '/api/channel-banking/ussd-transaction-engine/list',
      columnLabels: ["ID", "Name", "Status"],
    );
  }
}
