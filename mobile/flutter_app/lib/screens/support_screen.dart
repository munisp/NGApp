import 'package:flutter/material.dart';
import '../services/api_service.dart';

class SupportScreen extends StatefulWidget {
  const SupportScreen({super.key});
  @override
  State<SupportScreen> createState() => _SupportScreenState();
}

class _SupportScreenState extends State<SupportScreen> {
  final ApiService _api = ApiService();
  List<Map<String, dynamic>> _tickets = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadTickets();
  }

  Future<void> _loadTickets() async {
    setState(() => _loading = true);
    try {
      final response = await _api.getSupportTickets();
      final data = response.data;
      setState(() {
        _tickets = List<Map<String, dynamic>>.from(data['result']?['data']?['tickets'] ?? []);
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Support')),
      floatingActionButton: FloatingActionButton(onPressed: () => _showNewTicket(context), child: const Icon(Icons.add_comment)),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _tickets.isEmpty
              ? Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                  Icon(Icons.support_agent, size: 64, color: Colors.grey.shade400),
                  const SizedBox(height: 16),
                  const Text('No support tickets'),
                  const SizedBox(height: 8),
                  const Text('Tap + to create one', style: TextStyle(color: Colors.grey)),
                ]))
              : RefreshIndicator(
                  onRefresh: _loadTickets,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _tickets.length,
                    itemBuilder: (context, i) {
                      final t = _tickets[i];
                      final status = t['status'] ?? 'open';
                      return Card(child: ListTile(
                        leading: Icon(
                          status == 'resolved' ? Icons.check_circle : status == 'in_progress' ? Icons.pending : Icons.error_outline,
                          color: status == 'resolved' ? Colors.green : status == 'in_progress' ? Colors.orange : Colors.blue,
                        ),
                        title: Text(t['subject'] ?? 'Ticket #${t['id'] ?? i}'),
                        subtitle: Text('${t['category'] ?? 'General'} • ${t['created_at'] ?? ''}'),
                        trailing: Chip(label: Text(status, style: const TextStyle(fontSize: 10))),
                        onTap: () {},
                      ));
                    },
                  ),
                ),
    );
  }

  void _showNewTicket(BuildContext context) {
    final subjectCtrl = TextEditingController();
    final messageCtrl = TextEditingController();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom, left: 16, right: 16, top: 16),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Text('New Support Ticket', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 16),
          TextField(controller: subjectCtrl, decoration: const InputDecoration(labelText: 'Subject', border: OutlineInputBorder())),
          const SizedBox(height: 12),
          TextField(controller: messageCtrl, decoration: const InputDecoration(labelText: 'Describe your issue', border: OutlineInputBorder()), maxLines: 4),
          const SizedBox(height: 16),
          SizedBox(width: double.infinity, child: ElevatedButton(
            onPressed: () async {
              await _api.createSupportTicket({'subject': subjectCtrl.text, 'message': messageCtrl.text});
              if (mounted) Navigator.pop(ctx);
              _loadTickets();
            },
            child: const Text('Submit Ticket'),
          )),
          const SizedBox(height: 16),
        ]),
      ),
    );
  }
}
