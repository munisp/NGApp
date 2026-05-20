import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class KeycloakRolesScreen extends StatelessWidget {
  const KeycloakRolesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Keycloak Roles',
      apiEndpoint: '/api/platform/keycloak/roles',
      columnKeys: const ['name', 'realm', 'usersAssigned', 'composite'],
      columnLabels: const ['Name', 'Realm', 'Users', 'Composite'],
      seedData: const [
              {'name': 'bank_customer', 'realm': '54bank', 'usersAssigned': '1450000', 'composite': 'true'},
      ],
    );
  }
}
