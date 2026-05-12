import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class CbnAgsmeisScreen extends StatelessWidget {
  const CbnAgsmeisScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'CBN AGSMEIS',
      apiPath: '/api/agriculture-enhancement/cbn-agsmeis/list',
      columnLabels: ["ID", "Name", "Status"],
    );
  }
}
