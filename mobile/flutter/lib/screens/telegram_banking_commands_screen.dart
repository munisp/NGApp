import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class TelegramBankingCommandsScreen extends StatelessWidget {
  const TelegramBankingCommandsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Telegram Banking Commands',
      apiPath: '/api/channel-banking/telegram-banking-commands/list',
      columnLabels: ["ID", "Name", "Status"],
    );
  }
}
