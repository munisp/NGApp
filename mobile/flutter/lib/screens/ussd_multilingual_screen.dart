import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class UssdMultilingualScreen extends StatelessWidget {
  const UssdMultilingualScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'USSD Multilingual',
      apiPath: '/api/channel-banking/ussd-multilingual/list',
      columnLabels: ["ID", "Name", "Status"],
    );
  }
}
