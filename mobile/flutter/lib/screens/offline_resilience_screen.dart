import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class OfflineResilienceScreen extends StatelessWidget {
  const OfflineResilienceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Offline Resilience',
      apiEndpoint: '/api/offline-resilience/v1/offline/profiles',
      columnKeys: const ['id', 'profile', 'bandwidth', 'strategy', 'score'],
      columnLabels: const ['ID', 'Profile', 'Bandwidth', 'Strategy', 'Score'],
      seedData: const [
      {'id': 'OFF-001', 'profile': 'Lagos Urban', 'bandwidth': '50 Mbps', 'strategy': 'WebSocket', 'score': '99.8'},
      {'id': 'OFF-002', 'profile': 'Rural Borno', 'bandwidth': '256 Kbps', 'strategy': 'USSD + SMS', 'score': '95.2'},
    ],
    );
  }
}
