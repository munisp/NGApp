import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class HAZonesScreen extends StatelessWidget {
  const HAZonesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'HA Zones',
      apiEndpoint: '/api/platform/ha/zones',
      columnKeys: const ['zone', 'region', 'services', 'replicas', 'traffic', 'status'],
      columnLabels: const ['Zone', 'Region', 'Services', 'Replicas', 'Traffic', 'Status'],
      seedData: const [
              {'zone': 'lagos-1a', 'region': 'West Africa (Lagos)', 'services': '172', 'replicas': '45', 'traffic': '55%', 'status': 'active'},
              {'zone': 'abuja-1a', 'region': 'Central Nigeria (Abuja)', 'services': '172', 'replicas': '25', 'traffic': '10%', 'status': 'active'},
      ],
    );
  }
}
