import 'package:flutter/material.dart';
import '../widgets/api_list_screen.dart';

class OllamaLlmScreen extends StatelessWidget {
  const OllamaLlmScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ApiListScreen(
      title: 'Ollama Local LLM',
      apiEndpoint: '/api/ai-ml/ollama/models',
      columnKeys: const ['id', 'name', 'size', 'ctx', 'latencyMs', 'tps'],
      columnLabels: const ['ID', 'Model', 'Size', 'Context', 'Latency', 'TPS'],
      seedData: const [
        {'id': 'OLLAMA_LLM-001', 'status': 'active'},
        {'id': 'OLLAMA_LLM-002', 'status': 'pending'},
      ],
    );
  }
}
