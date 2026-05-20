import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class FieldLevelEncryptionScreen extends StatelessWidget {
    const FieldLevelEncryptionScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Field-Level Encryption',
      apiPath: '/api/security/encryption/policies',
      columnLabels:   const FieldLevelEncryptionScreen({Key? key}) : super(key: key);
            'tableName': 'Table Name',
            'fieldName': 'Field Name',
            'algorithm': 'Algorithm',
            'dataClassification': 'Data Classification',
            'maskPattern': 'Mask Pattern',
            'status': 'Status',      },
    );
  }
}
