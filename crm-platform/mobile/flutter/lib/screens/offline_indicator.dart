import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/sync_provider.dart';

class OfflineIndicator extends StatelessWidget {
  const OfflineIndicator({super.key});

  @override
  Widget build(BuildContext context) {
    final sync = context.watch<SyncProvider>();

    if (sync.isOnline && sync.pendingChanges == 0) return const SizedBox.shrink();

    return SafeArea(
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 300),
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 16),
        color: sync.isOnline
            ? Colors.blue.withOpacity(0.9)
            : Colors.red.withOpacity(0.9),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              sync.isOnline ? Icons.sync : Icons.cloud_off,
              size: 14,
              color: Colors.white,
            ),
            const SizedBox(width: 8),
            Text(
              sync.isOnline
                  ? 'Syncing ${sync.pendingChanges} changes...'
                  : 'Offline — Changes saved locally',
              style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w500),
            ),
          ],
        ),
      ),
    );
  }
}
