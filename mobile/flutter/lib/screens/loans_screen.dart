import 'package:flutter/material.dart';

class LoansScreen extends StatelessWidget {
  const LoansScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final loanTypes = [
      {'type': 'Agriculture Loan', 'icon': Icons.agriculture, 'color': Colors.green},
      {'type': 'Education Loan', 'icon': Icons.school, 'color': Colors.purple},
      {'type': 'Mortgage', 'icon': Icons.home_work, 'color': Colors.indigo},
      {'type': 'Group Lending', 'icon': Icons.people, 'color': Colors.orange},
      {'type': 'Islamic Finance', 'icon': Icons.mosque, 'color': Colors.teal},
    ];

    return Scaffold(
      appBar: AppBar(title: const Text('Loans')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Loan Products', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            ...loanTypes.map((lt) => Card(
              margin: const EdgeInsets.only(bottom: 12),
              child: ListTile(
                leading: CircleAvatar(
                  backgroundColor: (lt['color'] as Color).withAlpha(30),
                  child: Icon(lt['icon'] as IconData, color: lt['color'] as Color),
                ),
                title: Text(lt['type'] as String),
                subtitle: const Text('Apply now'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () {},
              ),
            )),
            const SizedBox(height: 24),
            const Text('My Loans', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            ...List.generate(3, (i) => Card(
              margin: const EdgeInsets.only(bottom: 12),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Loan #${1000 + i}', style: const TextStyle(fontWeight: FontWeight.bold)),
                        Chip(
                          label: Text(['Repaying', 'Grace Period', 'Approved'][i], style: const TextStyle(fontSize: 11)),
                          backgroundColor: [Colors.blue.shade100, Colors.amber.shade100, Colors.green.shade100][i],
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text('NGN ${(i + 1) * 2500000}', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 4),
                    LinearProgressIndicator(value: [0.65, 0.0, 1.0][i], backgroundColor: Colors.grey.shade200),
                    const SizedBox(height: 4),
                    Text('${[65, 0, 100][i]}% disbursed', style: const TextStyle(fontSize: 12, color: Colors.grey)),
                  ],
                ),
              ),
            )),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {},
        icon: const Icon(Icons.add),
        label: const Text('Apply'),
      ),
    );
  }
}
