import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class MojaloopAdminParticipantsScreen extends StatelessWidget {
  const MojaloopAdminParticipantsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Admin Participants',
      apiEndpoint: '/api/platform/mojaloop/admin/participants',
      columnKeys: const ['fspId', 'name', 'type', 'country', 'status', 'ndcLimit'],
      columnLabels: const ['FSP', 'Name', 'Type', 'Country', 'Status', 'NDC'],
      seedData: const [
              {'fspId': '54BANK', 'name': '54Bank Nigeria', 'type': 'DFSP', 'country': 'Nigeria', 'status': 'active', 'ndcLimit': '500000000000'},
              {'fspId': 'ECOBANK-GH', 'name': 'Ecobank Ghana', 'type': 'DFSP', 'country': 'Ghana', 'status': 'active', 'ndcLimit': '100000000000'},
      ],
    );
  }
}
