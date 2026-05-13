import 'package:flutter/material.dart';
import '../services/api_service.dart';

class OpenBankingScreen extends StatefulWidget {
  const OpenBankingScreen({super.key});

  @override
  State<OpenBankingScreen> createState() => _OpenBankingScreenState();
}

class _OpenBankingScreenState extends State<OpenBankingScreen> {
  final ApiService _api = ApiService();
  List<Map<String, dynamic>> _consents = [];
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _loadConsents();
  }

  Future<void> _loadConsents() async {
    setState(() { _isLoading = true; });
    try {
      final data = await _api.get('/api/trpc/openBanking.listConsents');
      setState(() { _consents = List<Map<String, dynamic>>.from(data['result']?['data'] ?? []); });
    } catch (e) {
      // Graceful fallback
    } finally {
      setState(() { _isLoading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Open Banking')),
      body: _isLoading
        ? const Center(child: CircularProgressIndicator())
        : ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Connected Accounts', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 8),
                      Text('${_consents.length} active consents'),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              _ActionCard(title: 'Account Information', subtitle: 'View balances and transactions', icon: Icons.account_balance_wallet, onTap: () {}),
              _ActionCard(title: 'Payment Initiation', subtitle: 'Initiate payments via Open Banking', icon: Icons.send, onTap: () {}),
              _ActionCard(title: 'Consent Management', subtitle: 'Manage TPP access consents', icon: Icons.security, onTap: () {}),
              _ActionCard(title: 'API Explorer', subtitle: 'Test Open Banking APIs', icon: Icons.api, onTap: () {}),
            ],
          ),
    );
  }
}

class _ActionCard extends StatelessWidget {
  final String title;
  final String subtitle;
  final IconData icon;
  final VoidCallback onTap;
  const _ActionCard({required this.title, required this.subtitle, required this.icon, required this.onTap});

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
