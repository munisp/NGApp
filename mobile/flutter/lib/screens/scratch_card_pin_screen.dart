import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class ScratchCardPinScreen extends StatelessWidget {
    const ScratchCardPinScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Scratch Card PINs',
      apiPath: '/api/security/scratch-cards',
      columnLabels:   const ScratchCardPinScreen({Key? key}) : super(key: key);
            'serialNumber': 'Serial Number',
            'cardType': 'Card Type',
            'status': 'Status',
            'branchCode': 'Branch Code',
            'maxAttempts': 'Max Attempts',
            'usedAttempts': 'Used Attempts',      },
    );
  }
}
