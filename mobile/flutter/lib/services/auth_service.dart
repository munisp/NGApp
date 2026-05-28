import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'api_service.dart';

class AuthState {
  final bool isAuthenticated;
  final Map<String, dynamic>? user;
  final bool loading;
  final String? error;

  const AuthState({
    this.isAuthenticated = false,
    this.user,
    this.loading = true,
    this.error,
  });

  AuthState copyWith({bool? isAuthenticated, Map<String, dynamic>? user, bool? loading, String? error}) {
    return AuthState(
      isAuthenticated: isAuthenticated ?? this.isAuthenticated,
      user: user ?? this.user,
      loading: loading ?? this.loading,
      error: error ?? this.error,
    );
  }
}

class AuthNotifier extends AsyncNotifier<AuthState> {
  @override
  Future<AuthState> build() async {
    return _checkAuth();
  }

  Future<AuthState> _checkAuth() async {
    final api = ref.read(apiServiceProvider);
    try {
      final user = await api.query<Map<String, dynamic>>('auth.me');
      return AuthState(isAuthenticated: true, user: user, loading: false);
    } catch (_) {
      return const AuthState(isAuthenticated: false, loading: false);
    }
  }

  Future<void> logout() async {
    final api = ref.read(apiServiceProvider);
    try {
      await api.mutate('auth.logout');
    } catch (_) {}
    await api.clearAuthToken();
    state = const AsyncData(AuthState(isAuthenticated: false, loading: false));
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = AsyncData(await _checkAuth());
  }
}

final authStateProvider = AsyncNotifierProvider<AuthNotifier, AuthState>(AuthNotifier.new);
