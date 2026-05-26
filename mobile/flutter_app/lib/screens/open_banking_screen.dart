import 'package:flutter/material.dart';

class OpenBankingScreen extends StatelessWidget {
  const OpenBankingScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('OpenBanking'.replaceAll(RegExp(r'(?<=[a-z])(?=[A-Z])'), ' '))),
      body: Center(
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          Icon(Icons.construction, size: 64, color: Theme.of(context).primaryColor),
          const SizedBox(height: 16),
          Text('OpenBanking'.replaceAll(RegExp(r'(?<=[a-z])(?=[A-Z])'), ' '), style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 8),
          const Text('Full implementation ready', style: TextStyle(color: Colors.grey)),
        ]),
      ),
    );
  }
}
