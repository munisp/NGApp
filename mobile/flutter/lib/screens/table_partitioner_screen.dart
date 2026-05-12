import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class TablePartitionerScreen extends StatelessWidget {
  const TablePartitionerScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Table Partitioner',
      apiPath: '/api/performance/table-partitioner/list',
      columnLabels: ["Table", "Key", "Type"],
    );
  }
}
