import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class RouteSchemaEnforcerScreen extends StatelessWidget {
  const RouteSchemaEnforcerScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Route Schema Enforcer',
      apiPath: '/api/security-hardening/route-schema-enforcer/list',
      columnLabels: ["Path", "Method", "Status"],
    );
  }
}
