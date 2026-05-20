import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class SqlParameterizerScreen extends StatelessWidget {
  const SqlParameterizerScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'SQL Parameterizer',
      apiPath: '/api/security-hardening/sql-parameterizer/list',
      columnLabels: ["Query", "Parameterized", "Status"],
    );
  }
}
