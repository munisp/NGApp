import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class UssdSimToolkitScreen extends StatelessWidget {
  const UssdSimToolkitScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'USSD SIM Toolkit',
      apiPath: '/api/channel-banking/ussd-sim-toolkit/list',
      columnLabels: ["ID", "Name", "Status"],
    );
  }
}
