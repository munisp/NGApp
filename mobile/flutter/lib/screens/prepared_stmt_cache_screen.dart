import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class PreparedStmtCacheScreen extends StatelessWidget {
  const PreparedStmtCacheScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Prepared Statement Cache',
      apiPath: '/api/performance/prepared-stmt/list',
      columnLabels: ["Pattern", "Executions 24h", "Avg (ms)"],
    );
  }
}
