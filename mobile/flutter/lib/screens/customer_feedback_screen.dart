import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class CustomerFeedbackScreen extends StatelessWidget {
  const CustomerFeedbackScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Customer Feedback',
      apiEndpoint: '/api/feedback/v1/entries',
      columnKeys: const ['id', 'customer', 'rating', 'comment'],
      columnLabels: const ['ID', 'Customer', 'Rating', 'Comment'],
      seedData: const [
      {'id': 'FB-001', 'customer': 'Amina Bello', 'rating': '5/5', 'comment': 'Great mobile app experience'},
    ],
    );
  }
}
