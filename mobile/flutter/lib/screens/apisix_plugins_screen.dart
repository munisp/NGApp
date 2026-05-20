import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class ApisixPluginsScreen extends StatelessWidget {
  const ApisixPluginsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'APISIX Plugins',
      apiEndpoint: '/api/platform/apisix/plugins',
      columnKeys: const ['name', 'scope', 'category', 'routesUsing', 'status'],
      columnLabels: const ['Name', 'Scope', 'Category', 'Routes', 'Status'],
      seedData: const [
              {'name': 'jwt-auth', 'scope': 'global', 'category': 'authentication', 'routesUsing': '175', 'status': 'enabled'},
      ],
    );
  }
}
