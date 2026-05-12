import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class VaultIntegrationScreen extends StatelessWidget {
  const VaultIntegrationScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Vault Integration',
      apiPath: '/api/security-hardening/vault-integration/list',
      columnLabels: ["Path", "Type", "Status"],
    );
  }
}
