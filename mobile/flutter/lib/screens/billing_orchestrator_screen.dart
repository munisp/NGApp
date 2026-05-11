import 'package:flutter/material.dart';

class BillingOrchestratorScreen extends StatefulWidget {
  const BillingOrchestratorScreen({super.key});
  @override
  State<BillingOrchestratorScreen> createState() => _BillingOrchestratorScreenState();
}

class _BillingOrchestratorScreenState extends State<BillingOrchestratorScreen> {
  final _searchController = TextEditingController();
  String _searchQuery = '';
  final List<Map<String, String>> _items = [
    {'id': 'BO-001', 'rule': 'Transaction Fee', 'type': 'Per-Transaction', 'status': 'Active'},
  ];

  List<Map<String, String>> get _filtered {
    if (_searchQuery.isEmpty) return _items;
    final q = _searchQuery.toLowerCase();
    return _items.where((item) => item.values.any((v) => v.toLowerCase().contains(q))).toList();
  }

  void _showCreateDialog() {
    final keys = ['id', 'rule', 'type', 'status'];
    showModalBottomSheet(
      context: context, isScrollControlled: true,
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom, left: 16, right: 16, top: 24),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Create New', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 16),
          ...keys.map((k) => Padding(padding: const EdgeInsets.only(bottom: 12),
            child: TextField(decoration: InputDecoration(labelText: k, border: const OutlineInputBorder())))),
          const SizedBox(height: 8),
          SizedBox(width: double.infinity, child: ElevatedButton(
            onPressed: () => Navigator.pop(ctx),
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0F766E), foregroundColor: Colors.white),
            child: const Text('Save'))),
          const SizedBox(height: 24),
        ]),
      ),
    );
  }

  void _showDetail(Map<String, String> item) {
    final keys = ['id', 'rule', 'type', 'status'];
    final labels = ['ID', 'Rule', 'Type', 'Status'];
    showDialog(context: context, builder: (ctx) => AlertDialog(
      title: Text(item[keys[0]] ?? 'Billing Orchestrator'),
      content: Column(mainAxisSize: MainAxisSize.min, children: List.generate(keys.length, (i) =>
        Padding(padding: const EdgeInsets.only(bottom: 8), child: Row(children: [
          SizedBox(width: 90, child: Text('${labels[i]}:', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13))),
          Expanded(child: Text(item[keys[i]] ?? '', style: const TextStyle(fontSize: 13))),
        ])))),
      actions: [TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Close'))],
    ));
  }

  @override
  Widget build(BuildContext context) {
    final keys = ['id', 'rule', 'type', 'status'];
    final labels = ['ID', 'Rule', 'Type', 'Status'];
    final filtered = _filtered;
    return Scaffold(
      appBar: AppBar(title: const Text('Billing Orchestrator')),
      body: Column(children: [
        Padding(padding: const EdgeInsets.all(12), child: TextField(
          controller: _searchController,
          decoration: InputDecoration(hintText: 'Search...', prefixIcon: const Icon(Icons.search),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12))),
          onChanged: (v) => setState(() => _searchQuery = v))),
        Padding(padding: const EdgeInsets.symmetric(horizontal: 12), child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Text('${filtered.length} records', style: const TextStyle(color: Colors.grey)),
            TextButton.icon(onPressed: _showCreateDialog, icon: const Icon(Icons.add, size: 18), label: const Text('Add')),
          ])),
        Expanded(child: filtered.isEmpty
          ? const Center(child: Text('No records', style: TextStyle(color: Colors.grey)))
          : ListView.builder(itemCount: filtered.length, itemBuilder: (ctx, i) {
              final item = filtered[i];
              return Card(margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4), child: ListTile(
                leading: CircleAvatar(backgroundColor: const Color(0xFF0F766E).withValues(alpha: 0.1),
                  child: Text('${i+1}', style: const TextStyle(color: Color(0xFF0F766E), fontWeight: FontWeight.bold))),
                title: Text(item[keys[0]] ?? '', style: const TextStyle(fontWeight: FontWeight.w600)),
                subtitle: Text(keys.skip(1).take(2).map((k) => '$k: ${item[k] ?? ""}').join(' | '), style: const TextStyle(fontSize: 12)),
                trailing: PopupMenuButton<String>(onSelected: (a) {
                  if (a == 'delete') { setState(() => _items.remove(item));
                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Deleted'))); }
                }, itemBuilder: (_) => [
                  const PopupMenuItem(value: 'view', child: Text('View')),
                  const PopupMenuItem(value: 'edit', child: Text('Edit')),
                  const PopupMenuItem(value: 'delete', child: Text('Delete', style: TextStyle(color: Colors.red))),
                ]),
                onTap: () => _showDetail(item),
              ));
            })),
      ]),
      floatingActionButton: FloatingActionButton(onPressed: _showCreateDialog,
        backgroundColor: const Color(0xFF0F766E), child: const Icon(Icons.add, color: Colors.white)),
    );
  }
}
