import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class TelegramBotGatewayScreen extends StatelessWidget {
  const TelegramBotGatewayScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Telegram Bot Gateway',
      apiPath: '/api/channel-banking/telegram-bot-gateway/list',
      columnLabels: ["ID", "Name", "Status"],
    );
  }
}
