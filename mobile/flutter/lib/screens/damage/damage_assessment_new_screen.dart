import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../services/api_service.dart';
import '../../utils/theme.dart';

/// DamageAssessmentNewScreen — Mirrors the PWA equivalent page.
/// tRPC endpoint: damageAssessment.create
/// New damage assessment form
/// @see client/src/pages/ for the PWA equivalent.
class DamageAssessmentNewScreen extends ConsumerWidget {
  const DamageAssessmentNewScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(title: const Text('DamageAssessmentNew')),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.construction, size: 48, color: OGRMMTheme.primary),
            const SizedBox(height: 16),
            Text('DamageAssessmentNew', style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 8),
            Text(
              'Full implementation mirrors PWA\ntRPC: damageAssessment.create',
              style: Theme.of(context).textTheme.bodySmall,
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
