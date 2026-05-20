import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class UssdBankingGatewayScreen extends StatelessWidget {
  const UssdBankingGatewayScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'USSD Banking Gateway',
      apiPath: '/api/channel-banking/ussd-banking-gateway/list',
      columnLabels: ["ID", "Name", "Status"],
    );
  }
}
