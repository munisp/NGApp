import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class LakehouseClientsScreen extends StatelessWidget {
  const LakehouseClientsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Lakehouse Clients',
      apiEndpoint: '/api/platform/lakehouse/clients',
      columnKeys: const ['language', 'module', 'description'],
      columnLabels: const ['Language', 'Module', 'Description'],
      seedData: const [
              {'language': 'Go', 'module': 'github.com/54bank/lakehouse-client-go', 'description': 'Go client for 79 services'},
              {'language': 'Rust', 'module': 'lakehouse-client-rs', 'description': 'Rust client for 52 services'},
              {'language': 'Python', 'module': 'lakehouse_client', 'description': 'Python client for 39 services'},
      ],
    );
  }
}
