import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class GridTokenCardScreen extends StatelessWidget {
    const GridTokenCardScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Grid Token Cards',
      apiPath: '/api/security/grid-cards',
      columnLabels:   const GridTokenCardScreen({Key? key}) : super(key: key);
            'customerName': 'Customer Name',
            'cardSerial': 'Card Serial',
            'gridSize': 'Grid Size',
            'status': 'Status',
            'usageCount': 'Usage Count',
            'branchCode': 'Branch Code',      },
    );
  }
}
