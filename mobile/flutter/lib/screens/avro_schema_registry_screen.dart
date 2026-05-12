import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class AvroSchemaRegistryScreen extends StatelessWidget {
  const AvroSchemaRegistryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Avro Schema Registry',
      apiPath: '/api/performance/avro-schema/list',
      columnLabels: ["Subject", "Version", "Compat"],
    );
  }
}
