import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class WhatsappPaymentIntegrationScreen extends StatelessWidget {
  const WhatsappPaymentIntegrationScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'WhatsApp Payment',
      apiPath: '/api/channel-banking/whatsapp-payment-integration/list',
      columnLabels: ["ID", "Name", "Status"],
    );
  }
}
