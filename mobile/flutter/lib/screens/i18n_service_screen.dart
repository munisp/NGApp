import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class I18nServiceScreen extends StatelessWidget {
  const I18nServiceScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'i18n Localization',
      apiEndpoint: '/api/production/i18n/config',
      columnKeys: const ['id', 'status'],
      columnLabels: const ['ID', 'Status'],
      seedData: const [
        {'id': 'I18N_SERVICE_SCREEN-001', 'status': 'active'},
        {'id': 'I18N_SERVICE_SCREEN-002', 'status': 'pending'},
      ],
    );
  }
}
