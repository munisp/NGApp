import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class WhatsappBusinessGatewayScreen extends StatelessWidget {
  const WhatsappBusinessGatewayScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'WhatsApp Business Gateway',
      apiPath: '/api/channel-banking/whatsapp-business-gateway/list',
      columnLabels: ["ID", "Name", "Status"],
    );
  }
}
