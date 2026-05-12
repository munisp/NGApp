import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class DockerHardenerScreen extends StatelessWidget {
  const DockerHardenerScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Docker Hardener',
      apiPath: '/api/security-hardening/docker-hardener/list',
      columnLabels: ["Check", "Severity", "Status"],
    );
  }
}
