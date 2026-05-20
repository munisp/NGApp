import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class LoanOriginationScreen extends StatelessWidget {
  const LoanOriginationScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Loan Origination',
      apiEndpoint: '/api/loans/v1/applications',
      columnKeys: const ['id', 'applicant', 'product', 'amount', 'status'],
      columnLabels: const ['ID', 'Applicant', 'Product', 'Amount', 'Status'],
      seedData: const [
      {'id': 'LN-001', 'applicant': 'Dangote Agrosacks', 'product': 'Term Loan', 'amount': 'NGN 5B', 'status': 'Approved'},
      {'id': 'LN-002', 'applicant': 'Amina Bello', 'product': 'Personal Loan', 'amount': 'NGN 2M', 'status': 'Disbursed'},
      {'id': 'LN-003', 'applicant': 'BUA Foods Plc', 'product': 'Working Capital', 'amount': 'NGN 10B', 'status': 'Under Review'},
      {'id': 'LN-004', 'applicant': 'Emeka Nwankwo', 'product': 'SME Loan', 'amount': 'NGN 15M', 'status': 'Pending Docs'},
    ],
    );
  }
}
