import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../services/api_service.dart';
import '../../utils/theme.dart';

/// WellsScreen — Mirrors the PWA equivalent page.
/// tRPC endpoint: wells.list
/// Well list with search, filter, and create
/// @see client/src/pages/ for the PWA equivalent.
class WellsScreen extends ConsumerWidget {
  const WellsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(title: const Text('Wells')),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.construction, size: 48, color: OGRMMTheme.primary),
            const SizedBox(height: 16),
            Text('Wells', style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 8),
            Text(
              'Full implementation mirrors PWA\ntRPC: wells.list',
              style: Theme.of(context).textTheme.bodySmall,
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
