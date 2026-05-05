import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/tenant_provider.dart';

class CustomerListScreen extends StatefulWidget {
  const CustomerListScreen({super.key});

  @override
  State<CustomerListScreen> createState() => _CustomerListScreenState();
}

class _CustomerListScreenState extends State<CustomerListScreen> {
  final _searchController = TextEditingController();
  String _statusFilter = 'all';
  List<Map<String, dynamic>> _customers = _seedCustomers;

  @override
  Widget build(BuildContext context) {
    final tenant = context.watch<TenantProvider>().currentTenant;
    final filtered = _customers.where((c) {
      if (_statusFilter != 'all' && c['status'] != _statusFilter) return false;
      if (_searchController.text.isNotEmpty) {
        final q = _searchController.text.toLowerCase();
        return c['name'].toString().toLowerCase().contains(q) || c['phone'].toString().contains(q);
      }
      return true;
    }).toList();

    return Scaffold(
      appBar: AppBar(title: const Text('Customers', style: TextStyle(fontWeight: FontWeight.bold))),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: 'Search customers...',
                prefixIcon: const Icon(Icons.search),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                contentPadding: const EdgeInsets.symmetric(horizontal: 16),
              ),
              onChanged: (_) => setState(() {}),
            ),
          ),
          SizedBox(
            height: 40,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              children: ['all', 'active', 'inactive', 'dormant'].map((s) => Padding(
                padding: const EdgeInsets.only(right: 8),
                child: FilterChip(
                  label: Text(s == 'all' ? 'All' : s[0].toUpperCase() + s.substring(1)),
                  selected: _statusFilter == s,
                  onSelected: (_) => setState(() => _statusFilter = s),
                ),
              )).toList(),
            ),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              itemCount: filtered.length,
              itemBuilder: (ctx, i) {
                final c = filtered[i];
                return Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    leading: CircleAvatar(child: Text(c['name'][0])),
                    title: Text(c['name'], style: const TextStyle(fontWeight: FontWeight.w600)),
                    subtitle: Text('${c['phone']} • ${c['kyc_level']}', style: const TextStyle(fontSize: 12)),
                    trailing: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: c['status'] == 'active' ? Colors.green.withOpacity(0.1) : Colors.grey.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(c['status'], style: TextStyle(fontSize: 11, color: c['status'] == 'active' ? Colors.green : Colors.grey)),
                    ),
                    onTap: () {},
                  ),
                );
              },
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {},
        child: const Icon(Icons.person_add),
      ),
    );
  }
}

final List<Map<String, dynamic>> _seedCustomers = [
  {'id': 'cust-001', 'name': 'Fatima Ibrahim', 'phone': '+2348012345678', 'status': 'active', 'kyc_level': 'Level 3', 'risk_score': 12, 'products': ['Core Banking', 'Agent Banking']},
  {'id': 'cust-002', 'name': 'Adebayo Okonkwo', 'phone': '+2347098765432', 'status': 'active', 'kyc_level': 'Level 2', 'risk_score': 25, 'products': ['Agent Banking']},
  {'id': 'cust-003', 'name': 'Ngozi Okwu', 'phone': '+2349055566677', 'status': 'active', 'kyc_level': 'Level 3', 'risk_score': 8, 'products': ['Remittance', 'Payments']},
  {'id': 'cust-004', 'name': 'Musa Bello', 'phone': '+2348033344455', 'status': 'dormant', 'kyc_level': 'Level 1', 'risk_score': 45, 'products': ['Core Banking']},
  {'id': 'cust-005', 'name': 'Amina Mohammed', 'phone': '+2347066677788', 'status': 'active', 'kyc_level': 'Level 2', 'risk_score': 18, 'products': ['Mobile Money']},
  {'id': 'cust-006', 'name': 'Chinedu Eze', 'phone': '+2348044455566', 'status': 'active', 'kyc_level': 'Level 3', 'risk_score': 5, 'products': ['Core Banking', 'Payments']},
  {'id': 'cust-007', 'name': 'Hauwa Abubakar', 'phone': '+2349077788899', 'status': 'inactive', 'kyc_level': 'Level 1', 'risk_score': 32, 'products': ['Agent Banking']},
];

class CustomerDetailScreen extends StatelessWidget {
  final Map<String, dynamic> customer;
  const CustomerDetailScreen({super.key, required this.customer});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(customer['name'])),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  CircleAvatar(radius: 40, child: Text(customer['name'][0], style: const TextStyle(fontSize: 32))),
                  const SizedBox(height: 12),
                  Text(customer['name'], style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                  Text(customer['phone'], style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      _badge(customer['status'], customer['status'] == 'active' ? Colors.green : Colors.grey),
                      const SizedBox(width: 8),
                      _badge(customer['kyc_level'], Colors.blue),
                      const SizedBox(width: 8),
                      _badge('Risk: ${customer['risk_score']}', customer['risk_score'] > 30 ? Colors.red : Colors.green),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          Card(
            child: Column(
              children: [
                ListTile(title: const Text('Products'), subtitle: Text((customer['products'] as List).join(', '))),
                ListTile(title: const Text('KYC Level'), trailing: Text(customer['kyc_level'])),
                ListTile(title: const Text('Risk Score'), trailing: Text('${customer['risk_score']}')),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _badge(String text, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
      child: Text(text, style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.w500)),
    );
  }
}
