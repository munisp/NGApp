import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class KeycloakScreen extends StatelessWidget {
  const KeycloakScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Keycloak',
      apiEndpoint: '/api/keycloak/v1/realms',
      columnKeys: const ['id', 'realm', 'users', 'clients', 'status'],
      columnLabels: const ['ID', 'Realm', 'Users', 'Clients', 'Status'],
      seedData: const [
      {'id': 'KC-001', 'realm': '54bank', 'users': '245,000', 'clients': '12', 'status': 'Active'},
    ],
    );
  }
}
