import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class ImmutableAuditScreen extends StatelessWidget {
  const ImmutableAuditScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Immutable Audit Chain',
      apiPath: '/api/security-hardening/immutable-audit/list',
      columnLabels: ["Block #", "Txns", "Status"],
    );
  }
}
