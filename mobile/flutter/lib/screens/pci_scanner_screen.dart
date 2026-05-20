import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class PciScannerScreen extends StatelessWidget {
  const PciScannerScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'PCI-DSS Scanner',
      apiPath: '/api/security-hardening/pci-scanner/list',
      columnLabels: ["Requirement", "Passing", "Status"],
    );
  }
}
