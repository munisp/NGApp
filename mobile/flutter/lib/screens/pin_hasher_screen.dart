import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class PinHasherScreen extends StatelessWidget {
  const PinHasherScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'PIN Hasher (Argon2)',
      apiPath: '/api/security-hardening/pin-hasher/list',
      columnLabels: ["Algorithm", "Memory Cost", "Status"],
    );
  }
}
