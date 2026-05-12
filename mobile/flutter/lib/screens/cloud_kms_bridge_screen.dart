import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class CloudKmsBridgeScreen extends StatelessWidget {
  const CloudKmsBridgeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Cloud KMS Bridge',
      apiPath: '/api/security-hardening/cloud-kms/list',
      columnLabels: ["Provider", "Algorithm", "Status"],
    );
  }
}
