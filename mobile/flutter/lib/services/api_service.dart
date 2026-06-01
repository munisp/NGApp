import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// ApiService — HTTP client for the OG-RMM tRPC backend.
///
/// The Flutter app communicates with the same tRPC backend as the PWA.
/// All requests go through the /api/trpc batch endpoint.
/// Authentication uses Bearer token (same JWT as the PWA session cookie).
class ApiService {
  late final Dio _dio;
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  static const String _baseUrlKey = 'og_rmm_base_url';
  static const String _authTokenKey = 'og_rmm_auth_token';
  static const String _defaultBaseUrl = 'https://your-og-rmm-deployment.example.com';

  ApiService() {
    _dio = Dio(BaseOptions(
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 30),
      headers: {'Content-Type': 'application/json'},
    ));

    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final baseUrl = await getBaseUrl();
        options.baseUrl = baseUrl;
        final token = await _storage.read(key: _authTokenKey);
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (error, handler) {
        if (error.response?.statusCode == 401) {
          // Token expired — trigger re-auth
          _storage.delete(key: _authTokenKey);
        }
        handler.next(error);
      },
    ));
  }

  Future<String> getBaseUrl() async {
    return await _storage.read(key: _baseUrlKey) ?? _defaultBaseUrl;
  }

  Future<void> setBaseUrl(String url) async {
    await _storage.write(key: _baseUrlKey, value: url);
  }

  Future<void> setAuthToken(String token) async {
    await _storage.write(key: _authTokenKey, value: token);
  }

  Future<void> clearAuthToken() async {
    await _storage.delete(key: _authTokenKey);
  }

  /// tRPC query — GET /api/trpc/{procedure}?input={json}
  Future<T> query<T>(String procedure, {Map<String, dynamic>? input}) async {
    final inputJson = input != null ? jsonEncode({'0': {'json': input}}) : null;
    final response = await _dio.get(
      '/api/trpc/$procedure',
      queryParameters: inputJson != null ? {'input': inputJson, 'batch': '1'} : {'batch': '1'},
    );
    final data = response.data;
    if (data is List && data.isNotEmpty) {
      final result = data[0];
      if (result['result'] != null) {
        return result['result']['data']['json'] as T;
      }
      throw Exception(result['error']?['message'] ?? 'tRPC query failed');
    }
    throw Exception('Unexpected tRPC response format');
  }

  /// tRPC mutation — POST /api/trpc/{procedure}
  Future<T> mutate<T>(String procedure, {Map<String, dynamic>? input}) async {
    final response = await _dio.post(
      '/api/trpc/$procedure?batch=1',
      data: jsonEncode({'0': {'json': input ?? {}}}),
    );
    final data = response.data;
    if (data is List && data.isNotEmpty) {
      final result = data[0];
      if (result['result'] != null) {
        return result['result']['data']['json'] as T;
      }
      throw Exception(result['error']?['message'] ?? 'tRPC mutation failed');
    }
    throw Exception('Unexpected tRPC response format');
  }
}

final apiServiceProvider = Provider<ApiService>((ref) => ApiService());
