import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class FluvioWASMTransformScreen extends StatelessWidget {
  const FluvioWASMTransformScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Fluvio WASM Transform',
      apiPath: '/api/performance/fluvio-wasm/list',
      columnLabels: ["Name", "Type", "Latency (μs)"],
    );
  }
}
