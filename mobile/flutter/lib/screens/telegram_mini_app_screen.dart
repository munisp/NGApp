import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class TelegramMiniAppScreen extends StatelessWidget {
  const TelegramMiniAppScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Telegram Mini App',
      apiPath: '/api/channel-banking/telegram-mini-app/list',
      columnLabels: ["ID", "Name", "Status"],
    );
  }
}
