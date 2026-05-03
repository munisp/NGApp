import 'dart:async';
import 'dart:collection';

enum SyncStatus { pending, syncing, completed, failed, conflict }

enum ConnectionQuality { offline, poor, moderate, good, excellent }

class OfflineOperation {
  final String id;
  final String type;
  final Map<String, dynamic> payload;
  final int priority;
  SyncStatus status;
  int retryCount;
  final int maxRetries;
  DateTime createdAt;
  String? lastError;

  OfflineOperation({
    required this.id,
    required this.type,
    required this.payload,
    this.priority = 1,
    this.status = SyncStatus.pending,
    this.retryCount = 0,
    this.maxRetries = 5,
    DateTime? createdAt,
    this.lastError,
  }) : createdAt = createdAt ?? DateTime.now();
}

class OfflineSyncService {
  final Queue<OfflineOperation> _queue = Queue();
  ConnectionQuality _connectionQuality = ConnectionQuality.offline;
  int _completedCount = 0;
  int _failedCount = 0;
  Timer? _syncTimer;

  static final OfflineSyncService _instance = OfflineSyncService._internal();
  factory OfflineSyncService() => _instance;
  OfflineSyncService._internal();

  void enqueue(OfflineOperation op) {
    _queue.add(op);
  }

  Future<List<OfflineOperation>> dequeue(int batchSize) async {
    final batch = <OfflineOperation>[];
    final pending = _queue.where((op) => op.status == SyncStatus.pending).toList();
    pending.sort((a, b) => b.priority.compareTo(a.priority));

    for (var i = 0; i < pending.length && batch.length < batchSize; i++) {
      pending[i].status = SyncStatus.syncing;
      batch.add(pending[i]);
    }
    return batch;
  }

  void markCompleted(String id) {
    final op = _queue.firstWhere((o) => o.id == id, orElse: () => throw Exception('Not found'));
    op.status = SyncStatus.completed;
    _completedCount++;
  }

  void markFailed(String id, String error) {
    final op = _queue.firstWhere((o) => o.id == id, orElse: () => throw Exception('Not found'));
    op.retryCount++;
    op.lastError = error;
    if (op.retryCount >= op.maxRetries) {
      op.status = SyncStatus.failed;
      _failedCount++;
    } else {
      op.status = SyncStatus.pending;
    }
  }

  void updateConnectionQuality(ConnectionQuality quality) {
    _connectionQuality = quality;
    if (quality != ConnectionQuality.offline && quality != ConnectionQuality.poor) {
      _startAutoSync();
    } else {
      _stopAutoSync();
    }
  }

  void _startAutoSync() {
    _syncTimer?.cancel();
    final interval = _connectionQuality == ConnectionQuality.excellent
        ? const Duration(seconds: 5)
        : _connectionQuality == ConnectionQuality.good
            ? const Duration(seconds: 15)
            : const Duration(seconds: 30);
    _syncTimer = Timer.periodic(interval, (_) => _syncBatch());
  }

  void _stopAutoSync() {
    _syncTimer?.cancel();
    _syncTimer = null;
  }

  Future<void> _syncBatch() async {
    final batchSize = _connectionQuality == ConnectionQuality.excellent ? 20 : 5;
    await dequeue(batchSize);
  }

  int get queueDepth => _queue.where((o) => o.status == SyncStatus.pending).length;
  int get completedCount => _completedCount;
  int get failedCount => _failedCount;
  ConnectionQuality get connectionQuality => _connectionQuality;

  void dispose() {
    _syncTimer?.cancel();
  }
}
