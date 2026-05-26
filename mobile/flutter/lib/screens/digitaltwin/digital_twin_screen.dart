import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../services/api_service.dart';
import '../../utils/theme.dart';

/// DigitalTwinScreen — Mirrors the PWA equivalent page.
/// tRPC endpoint: digitalTwin.getWellModel
/// Digital twin nodal analysis
/// @see client/src/pages/ for the PWA equivalent.
class DigitalTwinScreen extends ConsumerWidget {
  const DigitalTwinScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(title: const Text('DigitalTwin')),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.construction, size: 48, color: OGRMMTheme.primary),
            const SizedBox(height: 16),
            Text('DigitalTwin', style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 8),
            Text(
              'Full implementation mirrors PWA\ntRPC: digitalTwin.getWellModel',
              style: Theme.of(context).textTheme.bodySmall,
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
