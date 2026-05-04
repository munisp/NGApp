import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Payment Switch'), actions: [
        IconButton(icon: const Icon(Icons.notifications_outlined), onPressed: () {}),
      ]),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Balance Card
            Card(
              color: theme.colorScheme.primaryContainer,
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('Total Balance', style: theme.textTheme.bodyMedium),
                  const SizedBox(height: 8),
                  Text('₦2,450,000.00', style: theme.textTheme.headlineLarge?.copyWith(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 16),
                  Row(mainAxisAlignment: MainAxisAlignment.spaceAround, children: [
                    _QuickAction(icon: Icons.send, label: 'Send', onTap: () => context.go('/remittance')),
                    _QuickAction(icon: Icons.receipt_long, label: 'History', onTap: () => context.go('/dashboard')),
                    _QuickAction(icon: Icons.repeat, label: 'Recurring', onTap: () => context.go('/recurring')),
                    _QuickAction(icon: Icons.qr_code, label: 'QR Pay', onTap: () {}),
                  ]),
                ]),
              ),
            ),
            const SizedBox(height: 24),
            Text('Services', style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            GridView.count(
              crossAxisCount: 3, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 12, crossAxisSpacing: 12,
              children: [
                _ServiceCard(icon: Icons.send, label: 'Transfer', onTap: () => context.go('/remittance')),
                _ServiceCard(icon: Icons.group, label: 'Batch', onTap: () => context.go('/batch')),
                _ServiceCard(icon: Icons.warning_amber, label: 'Disputes', onTap: () => context.go('/disputes')),
                _ServiceCard(icon: Icons.shield, label: 'Compliance', onTap: () => context.go('/compliance')),
                _ServiceCard(icon: Icons.support_agent, label: 'Support', onTap: () => context.go('/support')),
                _ServiceCard(icon: Icons.card_giftcard, label: 'Referrals', onTap: () => context.go('/referrals')),
                _ServiceCard(icon: Icons.speed, label: 'Limits', onTap: () => context.go('/limits')),
                _ServiceCard(icon: Icons.attach_money, label: 'Fees', onTap: () => context.go('/fees')),
                _ServiceCard(icon: Icons.security, label: 'Security', onTap: () => context.go('/security')),
              ],
            ),
            const SizedBox(height: 24),
            Text('Recent Transactions', style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            ...List.generate(3, (i) => _TransactionTile(
              name: ['Olumide Adeyemi', 'Chioma Okafor', 'Ibrahim Musa'][i],
              amount: ['₦50,000', '₦25,000', '₦100,000'][i],
              date: ['May 2', 'May 1', 'Apr 30'][i],
              isCredit: i == 1,
            )),
          ],
        ),
      ),
    );
  }
}

class _QuickAction extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  const _QuickAction({required this.icon, required this.label, required this.onTap});
  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Column(children: [
        CircleAvatar(child: Icon(icon, size: 20)),
        const SizedBox(height: 4),
        Text(label, style: Theme.of(context).textTheme.bodySmall),
      ]),
    );
  }
}

class _ServiceCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  const _ServiceCard({required this.icon, required this.label, required this.onTap});
  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          Icon(icon, size: 28, color: Theme.of(context).colorScheme.primary),
          const SizedBox(height: 8),
          Text(label, style: Theme.of(context).textTheme.bodySmall, textAlign: TextAlign.center),
        ]),
      ),
    );
  }
}

class _TransactionTile extends StatelessWidget {
  final String name, amount, date;
  final bool isCredit;
  const _TransactionTile({required this.name, required this.amount, required this.date, this.isCredit = false});
  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: CircleAvatar(child: Text(name[0])),
      title: Text(name),
      subtitle: Text(date),
      trailing: Text('${isCredit ? "+" : "-"}$amount', style: TextStyle(color: isCredit ? Colors.green : Colors.red, fontWeight: FontWeight.bold)),
    );
  }
}
