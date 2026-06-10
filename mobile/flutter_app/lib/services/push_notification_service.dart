import 'package:flutter/foundation.dart';

class PushNotificationService {
  static final PushNotificationService _instance = PushNotificationService._internal();
  factory PushNotificationService() => _instance;
  PushNotificationService._internal();

  String? _fcmToken;
  bool _initialized = false;
  final List<Map<String, dynamic>> _notifications = [];

  Future<void> initialize() async {
    if (_initialized) return;
    try {
      // FCM initialization would go here
      // FirebaseMessaging.instance.getToken() etc.
      _initialized = true;
      debugPrint('[PushNotification] Service initialized');
    } catch (e) {
      debugPrint('[PushNotification] Init failed: $e');
    }
  }

  Future<String?> getToken() async {
    return _fcmToken;
  }

  Future<void> registerToken(String userId) async {
    final token = await getToken();
    if (token == null) return;
    // Register token with backend
    debugPrint('[PushNotification] Token registered for user $userId');
  }

  void handleNotification(Map<String, dynamic> message) {
    _notifications.add({
      'title': message['notification']?['title'] ?? '',
      'body': message['notification']?['body'] ?? '',
      'data': message['data'],
      'timestamp': DateTime.now().toIso8601String(),
      'read': false,
    });
  }

  List<Map<String, dynamic>> getNotifications() => _notifications;

  int get unreadCount => _notifications.where((n) => n['read'] == false).length;

  void markAsRead(int index) {
    if (index < _notifications.length) {
      _notifications[index]['read'] = true;
    }
  }

  void markAllAsRead() {
    for (final n in _notifications) {
      n['read'] = true;
    }
  }
}
