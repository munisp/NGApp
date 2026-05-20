import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class PgTuningParamsScreen extends StatelessWidget {
  const PgTuningParamsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Tuning Params',
      apiEndpoint: '/api/platform/postgres/tuning-params',
      columnKeys: const ['parameter', 'currentValue', 'recommendedValue', 'category', 'impact'],
      columnLabels: const ['Parameter', 'Current', 'Recommended', 'Category', 'Impact'],
      seedData: const [
              {'parameter': 'shared_buffers', 'currentValue': '4GB', 'recommendedValue': '8GB', 'category': 'memory', 'impact': 'high'},
      ],
    );
  }
}
