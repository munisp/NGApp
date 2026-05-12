import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class CbnAgriReturnsScreen extends StatelessWidget {
  const CbnAgriReturnsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'CBN Agri Returns',
      apiPath: '/api/agriculture-enhancement/cbn-agri-returns/list',
      columnLabels: ["ID", "Name", "Status"],
    );
  }
}
