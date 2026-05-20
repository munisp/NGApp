import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Notifications',
      apiEndpoint: '/api/notifications/v1/all',
      columnKeys: const ['id', 'title', 'channel', 'time', 'status'],
      columnLabels: const ['ID', 'Title', 'Channel', 'Time', 'Status'],
      seedData: const [
      {'id': 'NTF-001', 'title': 'Transfer Completed - NGN 5M to GTCO', 'channel': 'Push', 'time': '14:30', 'status': 'Delivered'},
      {'id': 'NTF-002', 'title': 'Card Blocked - Suspicious Activity', 'channel': 'SMS', 'time': '12:15', 'status': 'Read'},
      {'id': 'NTF-003', 'title': 'Loan Disbursement Approved', 'channel': 'Email', 'time': '09:45', 'status': 'Pending'},
      {'id': 'NTF-004', 'title': 'KYC Document Expiring', 'channel': 'In-App', 'time': '08:00', 'status': 'Delivered'},
    ],
    );
  }
}
