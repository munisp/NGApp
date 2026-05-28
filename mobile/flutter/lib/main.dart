import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'navigation/app_router.dart';
import 'utils/theme.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(
    const ProviderScope(
      child: OGRMMApp(),
    ),
  );
}

class OGRMMApp extends ConsumerWidget {
  const OGRMMApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(appRouterProvider);
    return MaterialApp.router(
      title: 'OG-RMM Platform',
      debugShowCheckedModeBanner: false,
      theme: OGRMMTheme.dark(),
      routerConfig: router,
    );
  }
}
