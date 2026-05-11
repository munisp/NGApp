import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class LakehouseDomainCDCScreen extends StatelessWidget {
  const LakehouseDomainCDCScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Lakehouse Domain CDC',
      apiEndpoint: '/api/platform/lakehouse/domains',
      columnKeys: const ['domain', 'avgEventsPerDay', 'avgPayloadBytes'],
      columnLabels: const ['Domain', 'Events/Day', 'Payload'],
      seedData: const [
              {'domain': 'core_banking', 'avgEventsPerDay': '125000', 'avgPayloadBytes': '2048'},
              {'domain': 'payments', 'avgEventsPerDay': '450000', 'avgPayloadBytes': '1536'},
              {'domain': 'lending', 'avgEventsPerDay': '85000', 'avgPayloadBytes': '3072'},
              {'domain': 'gl_accounting', 'avgEventsPerDay': '320000', 'avgPayloadBytes': '1024'},
              {'domain': 'fraud', 'avgEventsPerDay': '180000', 'avgPayloadBytes': '4096'},
      ],
    );
  }
}
