import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class MtlsMeshScreen extends StatelessWidget {
  const MtlsMeshScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'mTLS Service Mesh',
      apiPath: '/api/security-hardening/mtls-mesh/list',
      columnLabels: ["Service", "Peers", "Status"],
    );
  }
}
