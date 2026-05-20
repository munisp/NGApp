import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class BandwidthAdaptationScreen extends StatelessWidget {
  const BandwidthAdaptationScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Bandwidth Adaptation',
      apiEndpoint: '/api/resilience/bandwidth/profiles',
      columnKeys: const ['id', 'connectionType', 'estimatedKbps', 'strategy', 'compressionLevel'],
      columnLabels: const ['ID', 'Connection', 'Kbps', 'Strategy', 'Compression'],
      seedData: const [
      {'id': 'BP-001', 'connectionType': '4G', 'estimatedKbps': '10240', 'strategy': 'full_sync', 'compressionLevel': 'none'},
      {'id': 'BP-002', 'connectionType': '3G', 'estimatedKbps': '2048', 'strategy': 'delta_sync', 'compressionLevel': 'gzip'},
      {'id': 'BP-003', 'connectionType': '2G', 'estimatedKbps': '128', 'strategy': 'essential_only', 'compressionLevel': 'brotli'},
      {'id': 'BP-004', 'connectionType': 'GPRS', 'estimatedKbps': '9.6', 'strategy': 'sms_fallback', 'compressionLevel': 'max'},
      {'id': 'BP-005', 'connectionType': 'offline', 'estimatedKbps': '0', 'strategy': 'store_and_forward', 'compressionLevel': 'max'},
    ],
    );
  }
}
