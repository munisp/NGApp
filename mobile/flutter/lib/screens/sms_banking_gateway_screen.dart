import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class SmsBankingGatewayScreen extends StatelessWidget {
  const SmsBankingGatewayScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'SMS Banking Gateway',
      apiPath: '/api/channel-banking/sms-banking-gateway/list',
      columnLabels: ["ID", "Name", "Status"],
    );
  }
}
