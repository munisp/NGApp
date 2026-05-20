import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class ChatbotScreen extends StatelessWidget {
  const ChatbotScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'AI Chatbot',
      apiEndpoint: '/api/chatbot/v1/sessions',
      columnKeys: const ['id', 'customer', 'topic', 'resolution'],
      columnLabels: const ['ID', 'Customer', 'Topic', 'Resolution'],
      seedData: const [
      {'id': 'CHAT-001', 'customer': 'Amina Bello', 'topic': 'Card Activation', 'resolution': 'Resolved'},
    ],
    );
  }
}
