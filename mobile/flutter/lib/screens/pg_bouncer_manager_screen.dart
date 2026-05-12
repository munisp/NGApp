import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class PgBouncerManagerScreen extends StatelessWidget {
  const PgBouncerManagerScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'PgBouncer Pool Manager',
      apiPath: '/api/performance/pgbouncer/list',
      columnLabels: ["Database", "Pool Mode", "Active"],
    );
  }
}
