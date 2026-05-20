import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class CropYieldPredictionScreen extends StatelessWidget {
  const CropYieldPredictionScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Yield Prediction',
      apiPath: '/api/agriculture-enhancement/crop-yield-prediction/list',
      columnLabels: ["ID", "Name", "Status"],
    );
  }
}
