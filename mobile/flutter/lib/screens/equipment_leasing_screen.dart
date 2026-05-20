import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class EquipmentLeasingScreen extends StatelessWidget {
  const EquipmentLeasingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Equipment Leasing',
      apiPath: '/api/agriculture-enhancement/equipment-leasing/list',
      columnLabels: ["ID", "Name", "Status"],
    );
  }
}
