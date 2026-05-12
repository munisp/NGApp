import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class ApiKeyVaultScreen extends StatelessWidget {
    const ApiKeyVaultScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'API Key Vault',
      apiPath: '/api/security/api-keys',
      columnLabels:   const ApiKeyVaultScreen({Key? key}) : super(key: key);
            'name': 'Name',
            'keyPrefix': 'Key Prefix',
            'tenantId': 'Tenant Id',
            'rateLimit': 'Rate Limit',
            'status': 'Status',
            'usageCount': 'Usage Count',      },
    );
  }
}
