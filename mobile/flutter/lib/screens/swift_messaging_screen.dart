import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class SwiftMessagingScreen extends StatelessWidget {
  const SwiftMessagingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'SWIFT Messaging',
      apiEndpoint: '/api/swift-messaging/v1/swift/messages',
      columnKeys: const ['id', 'type', 'sender', 'amount', 'status'],
      columnLabels: const ['ID', 'Type', 'Sender', 'Amount', 'Status'],
      seedData: const [
      {'id': 'MT-001', 'type': 'MT103', 'sender': 'CITIUS33', 'amount': 'USD 5M', 'status': 'Delivered'},
    ],
    );
  }
}
