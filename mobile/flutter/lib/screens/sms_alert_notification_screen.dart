import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class SmsAlertNotificationScreen extends StatelessWidget {
  const SmsAlertNotificationScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'SMS Alert Notification',
      apiPath: '/api/channel-banking/sms-alert-notification/list',
      columnLabels: ["ID", "Name", "Status"],
    );
  }
}
