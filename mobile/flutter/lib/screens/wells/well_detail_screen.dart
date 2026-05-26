import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../services/api_service.dart';
import '../../utils/theme.dart';

class WellDetailScreen extends ConsumerWidget {{
  final String wellId;
  const WellDetailScreen({{super.key, required this.wellId}});

  @override
  Widget build(BuildContext context, WidgetRef ref) {{
    return Scaffold(
      appBar: AppBar(title: Text('Well $wellId')),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.oil_barrel, size: 48, color: OGRMMTheme.primary),
            const SizedBox(height: 16),
            Text('Well Detail: $wellId', style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 8),
            const Text('Telemetry charts, alarms, workover history\ntRPC: wells.getById',
              style: TextStyle(color: OGRMMTheme.textSecondary), textAlign: TextAlign.center),
          ],
        ),
      ),
    );
  }}
}}
