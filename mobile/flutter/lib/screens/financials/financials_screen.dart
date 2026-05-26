import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../services/api_service.dart';
import '../../utils/theme.dart';

/// FinancialsScreen — Mirrors the PWA equivalent page.
/// tRPC endpoint: financials.summary
/// Revenue and cost summary
/// @see client/src/pages/ for the PWA equivalent.
class FinancialsScreen extends ConsumerWidget {
  const FinancialsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(title: const Text('Financials')),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.construction, size: 48, color: OGRMMTheme.primary),
            const SizedBox(height: 16),
            Text('Financials', style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 8),
            Text(
              'Full implementation mirrors PWA\ntRPC: financials.summary',
              style: Theme.of(context).textTheme.bodySmall,
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
