import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class QualityCertificationScreen extends StatelessWidget {
  const QualityCertificationScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Quality Grading',
      apiPath: '/api/agriculture-enhancement/quality-certification/list',
      columnLabels: ["ID", "Name", "Status"],
    );
  }
}
