import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class CertificateManagerScreen extends StatelessWidget {
    const CertificateManagerScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Certificate Manager',
      apiPath: '/api/security/certificates',
      columnLabels:   const CertificateManagerScreen({Key? key}) : super(key: key);
            'commonName': 'Common Name',
            'type': 'Type',
            'algorithm': 'Algorithm',
            'issuer': 'Issuer',
            'status': 'Status',
            'validFrom': 'Valid From',
            'validTo': 'Valid To',      },
    );
  }
}
