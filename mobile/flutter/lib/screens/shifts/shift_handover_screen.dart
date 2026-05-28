import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../services/api_service.dart';
import '../../utils/theme.dart';

/// ShiftHandoverScreen — Mirrors the PWA equivalent page.
/// tRPC endpoint: shiftHandover.list
/// Shift handover notes
/// @see client/src/pages/ for the PWA equivalent.
class ShiftHandoverScreen extends ConsumerWidget {
  const ShiftHandoverScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(title: const Text('ShiftHandover')),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.construction, size: 48, color: OGRMMTheme.primary),
            const SizedBox(height: 16),
            Text('ShiftHandover', style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 8),
            Text(
              'Full implementation mirrors PWA\ntRPC: shiftHandover.list',
              style: Theme.of(context).textTheme.bodySmall,
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
