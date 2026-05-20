import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class CorrespondentBankingScreen extends StatelessWidget {
  const CorrespondentBankingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Correspondent Banking',
      apiEndpoint: '/api/correspondent/v1/banks',
      columnKeys: const ['bic', 'name', 'country', 'currency', 'status'],
      columnLabels: const ['BIC', 'Bank', 'Country', 'Ccy', 'Status'],
      seedData: const [
      {'bic': 'CITIUS33', 'name': 'Citibank New York', 'country': 'USA', 'currency': 'USD', 'status': 'Active'},
      {'bic': 'BARCGB22', 'name': 'Barclays London', 'country': 'UK', 'currency': 'GBP', 'status': 'Active'},
    ],
    );
  }
}
