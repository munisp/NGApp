import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class OtpHardeningScreen extends StatelessWidget {
    const OtpHardeningScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'OTP Hardening',
      apiPath: '/api/security/otp/policies',
      columnLabels:   const OtpHardeningScreen({Key? key}) : super(key: key);
            'name': 'Name',
            'channel': 'Channel',
            'otpLength': 'Otp Length',
            'ttlSeconds': 'Ttl Seconds',
            'maxAttempts': 'Max Attempts',
            'delivery': 'Delivery',
            'status': 'Status',      },
    );
  }
}
