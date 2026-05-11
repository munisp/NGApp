import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class InterestAccrualScreen extends StatelessWidget {
  const InterestAccrualScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Interest Accrual',
      apiEndpoint: '/api/interest/v1/accruals',
      columnKeys: const ['account', 'product', 'principal', 'rate', 'accrued'],
      columnLabels: const ['Account', 'Product', 'Principal', 'Rate', 'Accrued'],
      seedData: const [
      {'account': '0012345678', 'product': '54Save Premium', 'principal': 'NGN 10M', 'rate': '7.0%', 'accrued': 'NGN 57,534'},
    ],
    );
  }
}
