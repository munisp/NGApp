import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class CifManagementScreen extends StatelessWidget {
  const CifManagementScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'CIF / Address Mgmt',
      apiEndpoint: '/api/cif/v1/records',
      columnKeys: const ['cifNo', 'name', 'address', 'state'],
      columnLabels: const ['CIF', 'Name', 'Address', 'State'],
      seedData: const [
      {'cifNo': 'CIF-00001', 'name': 'Dangote Industries', 'address': '1 Alfred Rewane Rd, Ikoyi', 'state': 'Lagos'},
      {'cifNo': 'CIF-00002', 'name': 'Amina Bello', 'address': '15 Ahmadu Bello Way', 'state': 'Abuja FCT'},
    ],
    );
  }
}
