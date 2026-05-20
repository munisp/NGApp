import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class BeneficiaryMgmtScreen extends StatelessWidget {
  const BeneficiaryMgmtScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Beneficiaries',
      apiEndpoint: '/api/beneficiaries/v1/list',
      columnKeys: const ['id', 'name', 'bank', 'account', 'nickname'],
      columnLabels: const ['ID', 'Name', 'Bank', 'Account', 'Nickname'],
      seedData: const [
      {'id': 'BEN-001', 'name': 'Dangote Group', 'bank': 'First Bank', 'account': '2012345678', 'nickname': 'Payroll'},
      {'id': 'BEN-002', 'name': 'MTN Nigeria', 'bank': 'GTBank', 'account': '0123456789', 'nickname': 'Airtime'},
    ],
    );
  }
}
