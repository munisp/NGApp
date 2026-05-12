import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class KeyRotationEngineScreen extends StatelessWidget {
  const KeyRotationEngineScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Key Rotation Engine',
      apiPath: '/api/security-hardening/key-rotation/list',
      columnLabels: ["Key", "Interval", "Status"],
    );
  }
}
