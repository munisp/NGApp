import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class WireTransferMonitorScreen extends StatelessWidget {
  const WireTransferMonitorScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Wire Transfer Monitor (Travel Rule)',
      apiPath: '/api/aml-enhancement/wire-transfer-monitor/list',
      columnLabels: ["Originator", "Beneficiary", "Amount"],
    );
  }
}
