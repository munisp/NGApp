import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class SecretsVaultScreen extends StatelessWidget {
  const SecretsVaultScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Secrets Vault Manager',
      apiPath: '/api/security-hardening/secrets-vault/list',
      columnLabels: ["Path", "Engine", "Status"],
    );
  }
}
