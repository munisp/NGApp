import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class SecurityAuditLoggerScreen extends StatelessWidget {
    const SecurityAuditLoggerScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Security Audit Logger',
      apiPath: '/api/security/audit/events',
      columnLabels:   const SecurityAuditLoggerScreen({Key? key}) : super(key: key);
            'eventType': 'Event Type',
            'subType': 'Sub Type',
            'actor': 'Actor',
            'channel': 'Channel',
            'severity': 'Severity',
            'riskScore': 'Risk Score',
            'timestamp': 'Timestamp',      },
    );
  }
}
