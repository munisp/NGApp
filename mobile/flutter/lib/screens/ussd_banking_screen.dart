import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class UssdBankingScreen extends StatelessWidget {
  const UssdBankingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'USSD Banking',
      apiEndpoint: '/api/resilience/ussd/sessions',
      columnKeys: const ['id', 'msisdn', 'shortCode', 'menu', 'language', 'status'],
      columnLabels: const ['ID', 'Phone', 'Code', 'Menu', 'Lang', 'Status'],
      seedData: const [
      {'id': 'US-001', 'msisdn': '+2348012345678', 'shortCode': '*545#', 'menu': 'main_menu', 'language': 'en', 'status': 'active'},
      {'id': 'US-002', 'msisdn': '+2349087654321', 'shortCode': '*545#', 'menu': 'transfer_confirm', 'language': 'ha', 'status': 'active'},
    ],
    );
  }
}
