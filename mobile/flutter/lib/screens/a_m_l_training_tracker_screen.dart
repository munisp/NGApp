import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class AMLTrainingTrackerScreen extends StatelessWidget {
  const AMLTrainingTrackerScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'AML Training Tracker',
      apiPath: '/api/aml-enhancement/aml-training-tracker/list',
      columnLabels: ["Staff", "Role", "Module"],
    );
  }
}
