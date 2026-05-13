import 'package:flutter/material.dart';
import '../services/api_service.dart';

class TradePaymentsScreen extends StatefulWidget {
  const TradePaymentsScreen({super.key});

  @override
  State<TradePaymentsScreen> createState() => _TradePaymentsScreenState();
}

class _TradePaymentsScreenState extends State<TradePaymentsScreen> {
  final ApiService _api = ApiService();
  bool _isLoading = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Trade Payments')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _TradeCard(title: 'Letters of Credit', subtitle: 'Manage import/export LCs', icon: Icons.description, onTap: () {}),
          _TradeCard(title: 'Bank Guarantees', subtitle: 'View and create guarantees', icon: Icons.security, onTap: () {}),
          _TradeCard(title: 'Documentary Collections', subtitle: 'D/P and D/A collections', icon: Icons.folder, onTap: () {}),
          _TradeCard(title: 'Trade Finance', subtitle: 'Pre/post-shipment finance', icon: Icons.account_balance, onTap: () {}),
          _TradeCard(title: 'Form M / Form A', subtitle: 'CBN trade forms', icon: Icons.article, onTap: () {}),
          _TradeCard(title: 'Customs Duty', subtitle: 'NCS duty payments', icon: Icons.local_shipping, onTap: () {}),
        ],
      ),
    );
  }
}

class _TradeCard extends StatelessWidget {
  final String title;
  final String subtitle;
  final IconData icon;
  final VoidCallback onTap;

  const _TradeCard({required this.title, required this.subtitle, required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: CircleAvatar(child: Icon(icon)),
        title: Text(title),
        subtitle: Text(subtitle),
        trailing: const Icon(Icons.chevron_right),
        onTap: onTap,
      ),
    );
  }
}
