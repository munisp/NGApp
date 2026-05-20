import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class RequestValidatorScreen extends StatelessWidget {
  const RequestValidatorScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Request Validator',
      apiEndpoint: '/api/production/request-validator/schemas',
      columnKeys: const ['id', 'status'],
      columnLabels: const ['ID', 'Status'],
      seedData: const [
        {'id': 'REQUEST_VALIDATOR_SCREEN-001', 'status': 'active'},
        {'id': 'REQUEST_VALIDATOR_SCREEN-002', 'status': 'pending'},
      ],
    );
  }
}
