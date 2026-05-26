import 'package:flutter/material.dart';
import 'package:connectivity_plus/connectivity_plus.dart';

enum SyncStatus { synced, syncing, offline, error }
enum BandwidthProfile { excellent, good, fair, poor, offline }

class SyncProvider extends ChangeNotifier {
  SyncStatus _status = SyncStatus.synced;
  BandwidthProfile _bandwidth = BandwidthProfile.excellent;
  int _pendingChanges = 0;
  DateTime? _lastSyncTime;
  bool _isOnline = true;

  SyncStatus get status => _status;
  BandwidthProfile get bandwidth => _bandwidth;
  int get pendingChanges => _pendingChanges;
  DateTime? get lastSyncTime => _lastSyncTime;
  bool get isOnline => _isOnline;

  SyncProvider() {
    _initConnectivity();
  }

  void _initConnectivity() {
    Connectivity().onConnectivityChanged.listen((results) {
      final result = results.isNotEmpty ? results.first : ConnectivityResult.none;
      _isOnline = result != ConnectivityResult.none;
      _bandwidth = _isOnline ? BandwidthProfile.good : BandwidthProfile.offline;
      _status = _isOnline ? SyncStatus.synced : SyncStatus.offline;
      notifyListeners();

      if (_isOnline && _pendingChanges > 0) {
        syncNow();
      }
    });
  }

  Future<void> syncNow() async {
    if (!_isOnline) return;
    _status = SyncStatus.syncing;
    notifyListeners();

    try {
      // Process local IndexedDB/SQLite sync queue
      await Future.delayed(const Duration(seconds: 1));
      _pendingChanges = 0;
      _lastSyncTime = DateTime.now();
      _status = SyncStatus.synced;
    } catch (e) {
      _status = SyncStatus.error;
    }
    notifyListeners();
  }

  void addPendingChange() {
    _pendingChanges++;
    notifyListeners();
  }
}
