import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class WhatsappBankingFlowsScreen extends StatelessWidget {
  const WhatsappBankingFlowsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'WhatsApp Banking Flows',
      apiPath: '/api/channel-banking/whatsapp-banking-flows/list',
      columnLabels: ["ID", "Name", "Status"],
    );
  }
}
