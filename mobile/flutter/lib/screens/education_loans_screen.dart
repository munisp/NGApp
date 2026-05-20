import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class EducationLoansScreen extends StatelessWidget {
  const EducationLoansScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Education Loans',
      apiEndpoint: '/api/education-loans/v1/loans',
      columnKeys: const ['id', 'student', 'institution', 'amount', 'status'],
      columnLabels: const ['ID', 'Student', 'Institution', 'Amount', 'Status'],
      seedData: const [
      {'id': 'EDU-001', 'student': 'Tunde Adeyemi', 'institution': 'University of Lagos', 'amount': 'NGN 2.5M', 'status': 'Disbursed'},
    ],
    );
  }
}
