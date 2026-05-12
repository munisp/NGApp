import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class TxnPatternAnalyzerScreen extends StatelessWidget {
  const TxnPatternAnalyzerScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Transaction Pattern Analyzer',
      apiPath: '/api/aml-enhancement/txn-pattern-analyzer/list',
      columnLabels: ["Customer ID", "Customer", "Anomaly Score"],
    );
  }
}
