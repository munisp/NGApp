import 'package:flutter/material.dart';

class MobileMoneyScreen extends StatefulWidget {
  const MobileMoneyScreen({super.key});
  @override
  State<MobileMoneyScreen> createState() => _MobileMoneyScreenState();
}

class _MobileMoneyScreenState extends State<MobileMoneyScreen> {
  String _selectedProvider = 'mtn_momo';
  final _phoneController = TextEditingController();
  final _amountController = TextEditingController();

  final _providers = [
    {'id': 'mtn_momo', 'name': 'MTN MoMo', 'color': Colors.yellow},
    {'id': 'airtel_money', 'name': 'Airtel Money', 'color': Colors.red},
    {'id': 'glo_cash', 'name': 'Glo Cash', 'color': Colors.green},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Mobile Money')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          ..._providers.map((p) => RadioListTile<String>(
            title: Text(p['name'] as String),
            value: p['id'] as String,
            groupValue: _selectedProvider,
            onChanged: (v) => setState(() => _selectedProvider = v!),
          )),
          const SizedBox(height: 16),
          TextField(controller: _phoneController, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Recipient Phone', border: OutlineInputBorder(), prefixText: '+234 ')),
          const SizedBox(height: 16),
          TextField(controller: _amountController, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Amount', border: OutlineInputBorder(), prefixText: '₦ ')),
          const SizedBox(height: 24),
          SizedBox(width: double.infinity, child: ElevatedButton.icon(onPressed: () {}, icon: const Icon(Icons.send), label: const Text('Send Money'))),
          const SizedBox(height: 32),
          Text('Transfer History', style: Theme.of(context).textTheme.titleMedium),
          ...List.generate(5, (i) => ListTile(
            leading: CircleAvatar(backgroundColor: Colors.green.shade100, child: const Icon(Icons.phone_android, color: Colors.green)),
            title: Text('+234 80${i}234${i}678'),
            subtitle: Text('MTN MoMo • ${DateTime.now().subtract(Duration(hours: i * 6)).toString().substring(0, 16)}'),
            trailing: Text('₦${(2000 + i * 500)}'),
          )),
        ]),
      ),
    );
  }

  @override
  void dispose() { _phoneController.dispose(); _amountController.dispose(); super.dispose(); }
}
