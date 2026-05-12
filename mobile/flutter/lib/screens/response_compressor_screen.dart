import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class ResponseCompressorScreen extends StatelessWidget {
  const ResponseCompressorScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Response Compressor',
      apiPath: '/api/performance/response-compressor/list',
      columnLabels: ["Algorithm", "Level", "Ratio"],
    );
  }
}
