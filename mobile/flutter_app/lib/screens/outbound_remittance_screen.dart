import 'package:flutter/material.dart';

class OutboundRemittanceScreen extends StatefulWidget {
  const OutboundRemittanceScreen({super.key});

  @override
  State<OutboundRemittanceScreen> createState() =>
      _OutboundRemittanceScreenState();
}

class _OutboundRemittanceScreenState extends State<OutboundRemittanceScreen> {
  int _currentStep = 0;
  String? _selectedCorridor;
  String? _selectedProvider;
  final _amountController = TextEditingController();
  final _beneficiaryNameController = TextEditingController();
  final _beneficiaryAccountController = TextEditingController();

  final List<Map<String, dynamic>> _corridors = [
    {'id': 'NG-GH', 'name': 'Nigeria → Ghana', 'currency': 'GHS', 'category': 'West Africa Labor', 'rate': 12.80, 'fee': '\$0.30'},
    {'id': 'NG-GB', 'name': 'Nigeria → UK', 'currency': 'GBP', 'category': 'Education', 'rate': 0.00053, 'fee': '\$0.80'},
    {'id': 'NG-US', 'name': 'Nigeria → USA', 'currency': 'USD', 'category': 'Education', 'rate': 0.00067, 'fee': '\$0.75'},
    {'id': 'NG-CA', 'name': 'Nigeria → Canada', 'currency': 'CAD', 'category': 'Education', 'rate': 0.00090, 'fee': '\$0.85'},
    {'id': 'NG-IN', 'name': 'Nigeria → India', 'currency': 'INR', 'category': 'Medical', 'rate': 0.056, 'fee': '\$0.50'},
    {'id': 'NG-CN', 'name': 'Nigeria → China', 'currency': 'CNY', 'category': 'Premium Business', 'rate': 0.0048, 'fee': '\$1.20'},
    {'id': 'NG-KE', 'name': 'Nigeria → Kenya', 'currency': 'KES', 'category': 'General Personal', 'rate': 0.086, 'fee': '\$0.35'},
    {'id': 'NG-SN', 'name': 'Nigeria → Senegal', 'currency': 'XOF', 'category': 'West Africa Labor', 'rate': 0.41, 'fee': '\$0.40'},
    {'id': 'NG-ZA', 'name': 'Nigeria → South Africa', 'currency': 'ZAR', 'category': 'General Personal', 'rate': 0.012, 'fee': '\$0.40'},
    {'id': 'NG-AE', 'name': 'Nigeria → UAE', 'currency': 'AED', 'category': 'Premium Business', 'rate': 0.0024, 'fee': '\$1.00'},
  ];

  final List<Map<String, String>> _providers = [
    {'id': 'flutterwave', 'name': 'Flutterwave', 'speed': '30 min', 'type': 'Bank Transfer'},
    {'id': 'worldremit', 'name': 'WorldRemit', 'speed': '2 hours', 'type': 'MTO'},
    {'id': 'chipper', 'name': 'Chipper Cash', 'speed': '15 min', 'type': 'Mobile Money'},
    {'id': 'mojaloop_hub', 'name': 'Mojaloop Hub', 'speed': '10 min', 'type': 'Interop Switch'},
    {'id': 'wise', 'name': 'Wise', 'speed': '4 hours', 'type': 'Bank Transfer'},
    {'id': 'mtn_momo', 'name': 'MTN MoMo', 'speed': '5 min', 'type': 'Mobile Wallet'},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Send Money Abroad'),
        elevation: 0,
      ),
      body: Stepper(
        currentStep: _currentStep,
        onStepContinue: _onStepContinue,
        onStepCancel: _onStepCancel,
        steps: [
          Step(
            title: const Text('Select Corridor'),
            content: _buildCorridorSelection(),
            isActive: _currentStep >= 0,
            state: _currentStep > 0 ? StepState.complete : StepState.indexed,
          ),
          Step(
            title: const Text('Enter Amount'),
            content: _buildAmountEntry(),
            isActive: _currentStep >= 1,
            state: _currentStep > 1 ? StepState.complete : StepState.indexed,
          ),
          Step(
            title: const Text('Beneficiary Details'),
            content: _buildBeneficiaryDetails(),
            isActive: _currentStep >= 2,
            state: _currentStep > 2 ? StepState.complete : StepState.indexed,
          ),
          Step(
            title: const Text('Select Provider'),
            content: _buildProviderSelection(),
            isActive: _currentStep >= 3,
            state: _currentStep > 3 ? StepState.complete : StepState.indexed,
          ),
          Step(
            title: const Text('Review & Confirm'),
            content: _buildReviewConfirm(),
            isActive: _currentStep >= 4,
            state: _currentStep > 4 ? StepState.complete : StepState.indexed,
          ),
        ],
      ),
    );
  }

  Widget _buildCorridorSelection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Where are you sending money to?',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w500),
        ),
        const SizedBox(height: 12),
        ..._corridors.map((corridor) => Card(
          margin: const EdgeInsets.only(bottom: 8),
          child: ListTile(
            title: Text(corridor['name'] as String),
            subtitle: Text('${corridor['category']} • ${corridor['currency']}'),
            trailing: Text(corridor['fee'] as String, style: const TextStyle(color: Colors.green)),
            selected: _selectedCorridor == corridor['id'],
            selectedTileColor: Colors.blue.withAlpha(25),
            onTap: () => setState(() => _selectedCorridor = corridor['id'] as String),
          ),
        )),
      ],
    );
  }

  Widget _buildAmountEntry() {
    final corridor = _corridors.firstWhere(
      (c) => c['id'] == _selectedCorridor,
      orElse: () => _corridors.first,
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TextField(
          controller: _amountController,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(
            labelText: 'Amount (NGN)',
            prefixText: '\u20A6 ',
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 16),
        if (_amountController.text.isNotEmpty)
          Card(
            color: Colors.blue.shade50,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Exchange Rate: 1 NGN = ${corridor['rate']} ${corridor['currency']}'),
                  const SizedBox(height: 4),
                  Text('Corridor Fee: ${corridor['fee']}'),
                  const SizedBox(height: 4),
                  const Text('Estimated delivery: Same day', style: TextStyle(color: Colors.green)),
                ],
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildBeneficiaryDetails() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TextField(
          controller: _beneficiaryNameController,
          decoration: const InputDecoration(
            labelText: 'Beneficiary Full Name',
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _beneficiaryAccountController,
          decoration: const InputDecoration(
            labelText: 'Account Number / Mobile Number',
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 12),
        DropdownButtonFormField<String>(
          decoration: const InputDecoration(
            labelText: 'Payout Type',
            border: OutlineInputBorder(),
          ),
          items: const [
            DropdownMenuItem(value: 'bank_account', child: Text('Bank Account')),
            DropdownMenuItem(value: 'mobile_wallet', child: Text('Mobile Wallet')),
            DropdownMenuItem(value: 'cash_pickup', child: Text('Cash Pickup')),
          ],
          onChanged: (value) {},
        ),
        const SizedBox(height: 12),
        DropdownButtonFormField<String>(
          decoration: const InputDecoration(
            labelText: 'Purpose of Transfer',
            border: OutlineInputBorder(),
          ),
          items: const [
            DropdownMenuItem(value: 'family_support', child: Text('Family Support')),
            DropdownMenuItem(value: 'education', child: Text('Education/Tuition')),
            DropdownMenuItem(value: 'medical', child: Text('Medical')),
            DropdownMenuItem(value: 'business', child: Text('Business Payment')),
            DropdownMenuItem(value: 'personal', child: Text('Personal')),
          ],
          onChanged: (value) {},
        ),
      ],
    );
  }

  Widget _buildProviderSelection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Choose your payout provider:',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w500),
        ),
        const SizedBox(height: 8),
        const Text(
          'Providers are ranked by score (success rate, cost, speed, capacity)',
          style: TextStyle(fontSize: 12, color: Colors.grey),
        ),
        const SizedBox(height: 12),
        ..._providers.map((provider) => Card(
          margin: const EdgeInsets.only(bottom: 8),
          child: ListTile(
            leading: const CircleAvatar(child: Icon(Icons.account_balance)),
            title: Text(provider['name']!),
            subtitle: Text('${provider['type']} • ETA: ${provider['speed']}'),
            trailing: Radio<String>(
              value: provider['id']!,
              groupValue: _selectedProvider,
              onChanged: (value) => setState(() => _selectedProvider = value),
            ),
            onTap: () => setState(() => _selectedProvider = provider['id']!),
          ),
        )),
      ],
    );
  }

  Widget _buildReviewConfirm() {
    final corridor = _corridors.firstWhere(
      (c) => c['id'] == _selectedCorridor,
      orElse: () => _corridors.first,
    );
    final provider = _providers.firstWhere(
      (p) => p['id'] == _selectedProvider,
      orElse: () => _providers.first,
    );

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Transfer Summary', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const Divider(),
            _summaryRow('Corridor', corridor['name'] as String),
            _summaryRow('Amount', '\u20A6${_amountController.text}'),
            _summaryRow('Currency', corridor['currency'] as String),
            _summaryRow('Beneficiary', _beneficiaryNameController.text),
            _summaryRow('Account', _beneficiaryAccountController.text),
            _summaryRow('Provider', provider['name']!),
            _summaryRow('ETA', provider['speed']!),
            _summaryRow('Fee', corridor['fee'] as String),
            const Divider(),
            const Text(
              'By confirming, you agree that this transfer will be subject to compliance screening (AML/CFT/Sanctions).',
              style: TextStyle(fontSize: 11, color: Colors.grey),
            ),
          ],
        ),
      ),
    );
  }

  Widget _summaryRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: Colors.grey)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }

  void _onStepContinue() {
    if (_currentStep == 0 && _selectedCorridor == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a corridor')),
      );
      return;
    }
    if (_currentStep == 3 && _selectedProvider == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a provider')),
      );
      return;
    }
    if (_currentStep < 4) {
      setState(() => _currentStep++);
    } else {
      _submitTransfer();
    }
  }

  void _onStepCancel() {
    if (_currentStep > 0) {
      setState(() => _currentStep--);
    }
  }

  void _submitTransfer() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Transfer Submitted'),
        content: const Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.check_circle, color: Colors.green, size: 64),
            SizedBox(height: 16),
            Text('Your outbound remittance has been submitted for processing.'),
            SizedBox(height: 8),
            Text('Status: Compliance Screening', style: TextStyle(fontWeight: FontWeight.bold)),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              Navigator.of(context).pop();
            },
            child: const Text('Done'),
          ),
          TextButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              Navigator.of(context).pushReplacement(
                MaterialPageRoute(builder: (_) => const OutboundTrackingScreen()),
              );
            },
            child: const Text('Track Status'),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _amountController.dispose();
    _beneficiaryNameController.dispose();
    _beneficiaryAccountController.dispose();
    super.dispose();
  }
}

class OutboundTrackingScreen extends StatelessWidget {
  const OutboundTrackingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final steps = [
      {'step': 'A. Request Admitted', 'status': 'completed', 'time': '14:32:01'},
      {'step': 'B. Workflow Created', 'status': 'completed', 'time': '14:32:01'},
      {'step': 'C. Compliance Screening', 'status': 'completed', 'time': '14:32:02'},
      {'step': 'D. Pricing & Funding', 'status': 'completed', 'time': '14:32:02'},
      {'step': 'E. Routing & Execution', 'status': 'active', 'time': '14:32:03'},
      {'step': 'F. Settlement', 'status': 'pending', 'time': ''},
      {'step': 'G. Audit & Reporting', 'status': 'pending', 'time': ''},
    ];

    return Scaffold(
      appBar: AppBar(title: const Text('Transfer Status')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('TRF-2024-000042', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  const Text('Nigeria → Ghana • \u20A6750,000 → GHS 3,750'),
                  const SizedBox(height: 4),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.blue.shade100,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: const Text('Processing', style: TextStyle(color: Colors.blue, fontSize: 12)),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          const Text('Transaction Lifecycle', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          ...steps.map((step) => _buildLifecycleStep(
            step['step']!,
            step['status']!,
            step['time']!,
          )),
        ],
      ),
    );
  }

  Widget _buildLifecycleStep(String label, String status, String time) {
    IconData icon;
    Color color;
    switch (status) {
      case 'completed':
        icon = Icons.check_circle;
        color = Colors.green;
        break;
      case 'active':
        icon = Icons.radio_button_checked;
        color = Colors.blue;
        break;
      default:
        icon = Icons.radio_button_unchecked;
        color = Colors.grey;
    }

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(icon, color: color, size: 24),
          const SizedBox(width: 12),
          Expanded(child: Text(label, style: TextStyle(color: status == 'pending' ? Colors.grey : Colors.black))),
          if (time.isNotEmpty) Text(time, style: const TextStyle(fontSize: 12, color: Colors.grey)),
        ],
      ),
    );
  }
}
