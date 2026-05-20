import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class SmsOtpServiceScreen extends StatelessWidget {
  const SmsOtpServiceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'SMS OTP Service',
      apiPath: '/api/channel-banking/sms-otp-service/list',
      columnLabels: ["ID", "Name", "Status"],
    );
  }
}
