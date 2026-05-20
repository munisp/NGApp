import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class SiemExporterScreen extends StatelessWidget {
  const SiemExporterScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'SIEM Exporter',
      apiPath: '/api/security-hardening/siem-exporter/list',
      columnLabels: ["Name", "Format", "Status"],
    );
  }
}
