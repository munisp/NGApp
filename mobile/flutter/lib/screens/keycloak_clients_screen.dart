import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class KeycloakClientsScreen extends StatelessWidget {
  const KeycloakClientsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Keycloak Clients',
      apiEndpoint: '/api/platform/keycloak/clients',
      columnKeys: const ['clientId', 'name', 'accessType', 'activeTokens', 'status'],
      columnLabels: const ['Client', 'Name', 'Type', 'Tokens', 'Status'],
      seedData: const [
              {'clientId': '54bank-pwa', 'name': '54Bank PWA', 'accessType': 'public', 'activeTokens': '45000', 'status': 'active'},
      ],
    );
  }
}
