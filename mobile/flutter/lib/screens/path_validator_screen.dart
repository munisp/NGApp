import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class PathValidatorScreen extends StatelessWidget {
  const PathValidatorScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Path Validator',
      apiPath: '/api/security-hardening/path-validator/list',
      columnLabels: ["Pattern", "Blocked", "Status"],
    );
  }
}
