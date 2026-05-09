import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'services/api_service.dart';
import 'services/offline_service.dart';
import 'services/connectivity_service.dart';
import 'screens/home_screen.dart';
import 'screens/customers_screen.dart';
import 'screens/transfers_screen.dart';
import 'screens/loans_screen.dart';
import 'screens/cards_screen.dart';
import 'screens/settings_screen.dart';

void main() {
  runApp(const Bank54App());
}

class Bank54App extends StatelessWidget {
  const Bank54App({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider<ApiService>(create: (_) => ApiService()),
        Provider<OfflineService>(create: (_) => OfflineService()),
        ChangeNotifierProvider<ConnectivityService>(create: (_) => ConnectivityService()),
      ],
      child: MaterialApp(
        title: '54Bank',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(
            seedColor: const Color(0xFF0F766E),
            brightness: Brightness.light,
          ),
          useMaterial3: true,
          fontFamily: 'Inter',
        ),
        darkTheme: ThemeData(
          colorScheme: ColorScheme.fromSeed(
            seedColor: const Color(0xFF0F766E),
            brightness: Brightness.dark,
          ),
          useMaterial3: true,
          fontFamily: 'Inter',
        ),
        initialRoute: '/',
        routes: {
          '/': (_) => const HomeScreen(),
          '/customers': (_) => const CustomersScreen(),
          '/transfers': (_) => const TransfersScreen(),
          '/loans': (_) => const LoansScreen(),
          '/cards': (_) => const CardsScreen(),
          '/settings': (_) => const SettingsScreen(),
        },
      ),
    );
  }
}
