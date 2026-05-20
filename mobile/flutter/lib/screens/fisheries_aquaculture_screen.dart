import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class FisheriesAquacultureScreen extends StatelessWidget {
  const FisheriesAquacultureScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Fisheries Banking',
      apiPath: '/api/agriculture-enhancement/fisheries-aquaculture/list',
      columnLabels: ["ID", "Name", "Status"],
    );
  }
}
