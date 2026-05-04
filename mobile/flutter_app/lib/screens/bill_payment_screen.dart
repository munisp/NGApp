import 'package:flutter/material.dart';

class BillPaymentScreen extends StatefulWidget {
  const BillPaymentScreen({super.key});
  @override
  State<BillPaymentScreen> createState() => _BillPaymentScreenState();
}

class _BillPaymentScreenState extends State<BillPaymentScreen> {
  String _selectedCategory = 'electricity';
  final _accountController = TextEditingController();
  final _amountController = TextEditingController();

  final _categories = [
    {'id': 'electricity', 'name': 'Electricity', 'icon': Icons.flash_on},
    {'id': 'airtime', 'name': 'Airtime', 'icon': Icons.phone_android},
    {'id': 'cable', 'name': 'Cable TV', 'icon': Icons.tv},
    {'id': 'internet', 'name': 'Internet', 'icon': Icons.wifi},
    {'id': 'water', 'name': 'Water', 'icon': Icons.water_drop},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Bill Payments')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          SizedBox(
            height: 80,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              itemCount: _categories.length,
              itemBuilder: (ctx, i) {
                final cat = _categories[i];
                final selected = cat['id'] == _selectedCategory;
                return GestureDetector(
                  onTap: () => setState(() => _selectedCategory = cat['id'] as String),
                  child: Container(
                    width: 80, margin: const EdgeInsets.only(right: 12),
                    decoration: BoxDecoration(
                      color: selected ? Theme.of(context).primaryColor.withValues(alpha: 0.1) : Colors.grey.shade100,
                      borderRadius: BorderRadius.circular(12),
                      border: selected ? Border.all(color: Theme.of(context).primaryColor) : null,
                    ),
                    child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                      Icon(cat['icon'] as IconData, color: selected ? Theme.of(context).primaryColor : Colors.grey),
                      const SizedBox(height: 4),
                      Text(cat['name'] as String, style: TextStyle(fontSize: 11, fontWeight: selected ? FontWeight.bold : FontWeight.normal)),
                    ]),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 24),
          TextField(controller: _accountController, decoration: const InputDecoration(labelText: 'Account/Meter Number', border: OutlineInputBorder())),
          const SizedBox(height: 16),
          TextField(controller: _amountController, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Amount (NGN)', border: OutlineInputBorder(), prefixText: '₦ ')),
          const SizedBox(height: 24),
          SizedBox(width: double.infinity, child: ElevatedButton(onPressed: () {}, child: const Text('Pay Now'))),
          const SizedBox(height: 32),
          Text('Recent Payments', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),
          ...List.generate(5, (i) => ListTile(
            leading: const CircleAvatar(child: Icon(Icons.receipt_long)),
            title: Text('Payment #${2000 + i}'),
            subtitle: const Text('Electricity - EKEDC'),
            trailing: Text('₦${(5000 + i * 1200)}'),
          )),
        ]),
      ),
    );
  }

  @override
  void dispose() { _accountController.dispose(); _amountController.dispose(); super.dispose(); }
}
