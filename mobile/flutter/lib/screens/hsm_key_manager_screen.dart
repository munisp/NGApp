import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class HsmKeyManagerScreen extends StatelessWidget {
    const HsmKeyManagerScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'HSM Key Management',
      apiPath: '/api/security/hsm/keys',
      columnLabels:   const HsmKeyManagerScreen({Key? key}) : super(key: key);
            'name': 'Name',
            'keyType': 'Key Type',
            'algorithm': 'Algorithm',
            'purpose': 'Purpose',
            'status': 'Status',
            'keySizeBits': 'Key Size Bits',
            'hsmSlot': 'Hsm Slot',      },
    );
  }
}
