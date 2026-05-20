import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class Iso20022HubScreen extends StatelessWidget {
  const Iso20022HubScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'ISO 20022 Hub',
      apiEndpoint: '/api/iso20022/v1/messages',
      columnKeys: const ['id', 'msgType', 'direction', 'status'],
      columnLabels: const ['ID', 'Type', 'Direction', 'Status'],
      seedData: const [
      {'id': 'ISO-001', 'msgType': 'pacs.008', 'direction': 'Outbound', 'status': 'Sent'},
    ],
    );
  }
}
