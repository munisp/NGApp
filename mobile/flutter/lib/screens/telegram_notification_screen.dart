import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class TelegramNotificationScreen extends StatelessWidget {
  const TelegramNotificationScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Telegram Notifications',
      apiPath: '/api/channel-banking/telegram-notification/list',
      columnLabels: ["ID", "Name", "Status"],
    );
  }
}
