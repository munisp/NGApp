import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:hive/hive.dart';
import 'dart:async';

class OfflineService {
  final Box _queue = Hive.box('offline_queue');
  final Connectivity _connectivity = Connectivity();
  StreamSubscription? _subscription;
  bool _isOnline = true;

  bool get isOnline => _isOnline;
  int get queueLength => _queue.length;

  void init() {
    _subscription = _connectivity.onConnectivityChanged.listen((results) {
      final wasOffline = !_isOnline;
      _isOnline = results.any((r) => r != ConnectivityResult.none);
      if (wasOffline && _isOnline) {
        syncQueue();
      }
    });
  }

  Future<void> enqueue(String operation, Map<String, dynamic> payload, {int priority = 5}) async {
    final key = 'op_${DateTime.now().millisecondsSinceEpoch}';
    await _queue.put(key, {
      'operation': operation,
      'payload': payload,
      'priority': priority,
      'timestamp': DateTime.now().toIso8601String(),
      'retryCount': 0,
    });
  }

  Future<void> syncQueue() async {
    if (!_isOnline || _queue.isEmpty) return;
    final keys = _queue.keys.toList();
    for (final key in keys) {
      try {
        // Process through API service
        await _queue.delete(key);
      } catch (_) {
        break;
      }
    }
  }

  void dispose() {
    _subscription?.cancel();
  }
}
