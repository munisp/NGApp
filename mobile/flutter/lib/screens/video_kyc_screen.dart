import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class VideoKycScreen extends StatelessWidget {
  const VideoKycScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Video KYC',
      apiEndpoint: '/api/kyc-enhanced/video-kyc-sessions',
      columnKeys: const ['id', 'customerId', 'officerId', 'duration', 'geoVerified', 'status'],
      columnLabels: const ['ID', 'Customer', 'Officer', 'Duration', 'Geo', 'Status'],
      seedData: const [
        {'id': 'VIDEO_KYC-001', 'status': 'active'},
        {'id': 'VIDEO_KYC-002', 'status': 'pending'},
      ],
    );
  }
}
