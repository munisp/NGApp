import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class OutputEncoderScreen extends StatelessWidget {
  const OutputEncoderScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Output Encoder',
      apiPath: '/api/security-hardening/output-encoder/list',
      columnLabels: ["Context", "Encoder", "Status"],
    );
  }
}
