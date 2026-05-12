import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class SessionSecurityScreen extends StatelessWidget {
    const SessionSecurityScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Session Security',
      apiPath: '/api/security/sessions',
      columnLabels:   const SessionSecurityScreen({Key? key}) : super(key: key);
            'customerId': 'Customer Id',
            'channel': 'Channel',
            'ipAddress': 'Ip Address',
            'geoLocation': 'Geo Location',
            'status': 'Status',
            'mfaLevel': 'Mfa Level',
            'riskScore': 'Risk Score',      },
    );
  }
}
