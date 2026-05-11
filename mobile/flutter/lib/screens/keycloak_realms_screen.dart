import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class KeycloakRealmsScreen extends StatelessWidget {
  const KeycloakRealmsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Keycloak Realms',
      apiEndpoint: '/api/platform/keycloak/realms',
      columnKeys: const ['name', 'totalUsers', 'activeUsers24h', 'totalClients', 'mfaEnforced', 'status'],
      columnLabels: const ['Name', 'Users', 'Active 24h', 'Clients', 'MFA', 'Status'],
      seedData: const [
              {'name': '54bank', 'totalUsers': '1.5M', 'activeUsers24h': '85K', 'totalClients': '24', 'mfaEnforced': 'true', 'status': 'active'},
      ],
    );
  }
}
