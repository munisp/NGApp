import 'package:flutter/material.dart';
import '../services/api_service.dart';

class CardProcessingScreen extends StatefulWidget {
  const CardProcessingScreen({super.key});

  @override
  State<CardProcessingScreen> createState() => _CardProcessingScreenState();
}

class _CardProcessingScreenState extends State<CardProcessingScreen> {
  final ApiService _api = ApiService();
  bool _isLoading = false;
  List<Map<String, dynamic>> _transactions = [];

  @override
  void initState() {
    super.initState();
    _loadTransactions();
  }

  Future<void> _loadTransactions() async {
    setState(() { _isLoading = true; });
    try {
      final data = await _api.get('/api/trpc/cardProcessing.listTransactions');
      setState(() {
        _transactions = List<Map<String, dynamic>>.from(data['result']?['data'] ?? []);
      });
    } catch (e) {
      // Handle error gracefully
    } finally {
      setState(() { _isLoading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Card Processing')),
      body: _isLoading
        ? const Center(child: CircularProgressIndicator())
        : RefreshIndicator(
            onRefresh: _loadTransactions,
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                _buildStatRow(),
                const SizedBox(height: 16),
                const Text('Recent Transactions', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                ..._transactions.map((t) => _TransactionTile(transaction: t)),
                if (_transactions.isEmpty) const Center(child: Padding(padding: EdgeInsets.all(32), child: Text('No card transactions'))),
              ],
            ),
          ),
    );
  }

  Widget _buildStatRow() {
    return Row(
      children: [
        Expanded(child: _MiniCard(label: 'Total', value: '${_transactions.length}', color: Colors.blue)),
        const SizedBox(width: 8),
        Expanded(child: _MiniCard(label: 'Approved', value: '${_transactions.where((t) => t['status'] == 'approved').length}', color: Colors.green)),
        const SizedBox(width: 8),
        Expanded(child: _MiniCard(label: 'Declined', value: '${_transactions.where((t) => t['status'] == 'declined').length}', color: Colors.red)),
      ],
    );
  }
}

class _TransactionTile extends StatelessWidget {
  final Map<String, dynamic> transaction;
  const _TransactionTile({required this.transaction});

  @override
  Widget build(BuildContext context) {
    final status = transaction['status'] ?? 'pending';
    return Card(
      child: ListTile(
        leading: Icon(
          status == 'approved' ? Icons.check_circle : status == 'declined' ? Icons.cancel : Icons.pending,
          color: status == 'approved' ? Colors.green : status == 'declined' ? Colors.red : Colors.orange,
        ),
        title: Text('₦${transaction['amount'] ?? 0}'),
        subtitle: Text('${transaction['cardType'] ?? 'Visa'} •••• ${transaction['lastFour'] ?? '****'}'),
        trailing: Chip(label: Text(status, style: const TextStyle(fontSize: 12))),
      ),
    );
  }
}

class _MiniCard extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  const _MiniCard({required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Card(
      color: color.withValues(alpha: 0.1),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          children: [
            Text(value, style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: color)),
            Text(label, style: TextStyle(fontSize: 12, color: color)),
          ],
        ),
      ),
    );
  }
}
