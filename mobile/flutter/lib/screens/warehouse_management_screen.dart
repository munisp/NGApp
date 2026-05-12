import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class WarehouseManagementScreen extends StatelessWidget {
  const WarehouseManagementScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Warehouse Mgmt',
      apiPath: '/api/agriculture-enhancement/warehouse-management/list',
      columnLabels: ["ID", "Name", "Status"],
    );
  }
}
