import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class CorporateDocVerifyScreen extends StatelessWidget {
  const CorporateDocVerifyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Corporate Doc Verification',
      apiEndpoint: '/api/kyc-enhanced/corporate-docs',
      columnKeys: const ['id', 'companyId', 'docType', 'ocrExtracted', 'verified'],
      columnLabels: const ['ID', 'Company', 'Doc Type', 'OCR', 'Verified'],
      seedData: const [
        {'id': 'CORPORATE_DOC_VERIFY-001', 'status': 'active'},
        {'id': 'CORPORATE_DOC_VERIFY-002', 'status': 'pending'},
      ],
    );
  }
}
