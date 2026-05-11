import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class KeycloakIdPsScreen extends StatelessWidget {
  const KeycloakIdPsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Identity Providers',
      apiEndpoint: '/api/platform/keycloak/identity-providers',
      columnKeys: const ['alias', 'displayName', 'providerId', 'usersLinked', 'status'],
      columnLabels: const ['Alias', 'Name', 'Type', 'Users', 'Status'],
      seedData: const [
              {'alias': 'nibss-bvn', 'displayName': 'NIBSS BVN', 'providerId': 'oidc', 'usersLinked': '1.4M', 'status': 'active'},
      ],
    );
  }
}
