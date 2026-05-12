import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class ImageScannerScreen extends StatelessWidget {
  const ImageScannerScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Container Image Scanner',
      apiPath: '/api/security-hardening/image-scanner/list',
      columnLabels: ["Image", "Vulns", "Status"],
    );
  }
}
