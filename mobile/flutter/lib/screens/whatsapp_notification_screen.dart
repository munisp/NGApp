import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class WhatsappNotificationScreen extends StatelessWidget {
  const WhatsappNotificationScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'WhatsApp Notifications',
      apiPath: '/api/channel-banking/whatsapp-notification/list',
      columnLabels: ["ID", "Name", "Status"],
    );
  }
}
