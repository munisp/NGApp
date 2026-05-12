import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class FastJSONSerializerScreen extends StatelessWidget {
  const FastJSONSerializerScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Fast JSON Serializer',
      apiPath: '/api/performance/fast-json/list',
      columnLabels: ["Schema", "Ser/sec", "Avg (ns)"],
    );
  }
}
