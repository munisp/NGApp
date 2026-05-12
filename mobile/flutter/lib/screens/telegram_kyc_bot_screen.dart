import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class TelegramKycBotScreen extends StatelessWidget {
  const TelegramKycBotScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Telegram KYC Bot',
      apiPath: '/api/channel-banking/telegram-kyc-bot/list',
      columnLabels: ["ID", "Name", "Status"],
    );
  }
}
