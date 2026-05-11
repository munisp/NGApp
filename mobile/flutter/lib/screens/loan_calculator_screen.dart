import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class LoanCalculatorScreen extends StatelessWidget {
  const LoanCalculatorScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Loan Calculator',
      apiEndpoint: '/api/loans/v1/calculator',
      columnKeys: const ['product', 'amount', 'tenor', 'rate', 'monthly'],
      columnLabels: const ['Product', 'Amount', 'Tenor', 'Rate', 'Monthly'],
      seedData: const [
      {'product': 'Personal Loan', 'amount': 'NGN 5M', 'tenor': '24 months', 'rate': '22%', 'monthly': 'NGN 261,000'},
      {'product': 'Mortgage', 'amount': 'NGN 50M', 'tenor': '240 months', 'rate': '12%', 'monthly': 'NGN 550,000'},
    ],
    );
  }
}
