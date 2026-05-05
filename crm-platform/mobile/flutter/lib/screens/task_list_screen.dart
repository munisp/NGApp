import 'package:flutter/material.dart';

class TaskListScreen extends StatefulWidget {
  const TaskListScreen({super.key});

  @override
  State<TaskListScreen> createState() => _TaskListScreenState();
}

class _TaskListScreenState extends State<TaskListScreen> {
  String _filter = 'all';

  final _tasks = [
    {'id': 'task-001', 'title': 'Review KYC for Adebayo Okonkwo', 'type': 'kyc_review', 'priority': 'high', 'status': 'open', 'assignee': 'Compliance Officer', 'due': '2025-05-05', 'sla_breached': false},
    {'id': 'task-002', 'title': 'Approve Agent Onboarding — Lagos Zone', 'type': 'approval', 'priority': 'medium', 'status': 'in_progress', 'assignee': 'Operations Manager', 'due': '2025-05-06', 'sla_breached': false},
    {'id': 'task-003', 'title': 'Resolve disputed transaction TXN-4521', 'type': 'dispute', 'priority': 'critical', 'status': 'open', 'assignee': 'Dispute Handler', 'due': '2025-05-04', 'sla_breached': true},
    {'id': 'task-004', 'title': 'Monthly compliance report filing', 'type': 'compliance', 'priority': 'medium', 'status': 'review', 'assignee': 'Compliance Officer', 'due': '2025-05-10', 'sla_breached': false},
    {'id': 'task-005', 'title': 'Campaign review — Q2 Cross-sell', 'type': 'campaign', 'priority': 'low', 'status': 'open', 'assignee': 'Marketing Lead', 'due': '2025-05-15', 'sla_breached': false},
    {'id': 'task-006', 'title': 'Investigate failed login attempts', 'type': 'escalation', 'priority': 'high', 'status': 'in_progress', 'assignee': 'Security Team', 'due': '2025-05-04', 'sla_breached': false},
  ];

  Color _priorityColor(String priority) {
    switch (priority) {
      case 'critical': return Colors.red;
      case 'high': return Colors.orange;
      case 'medium': return Colors.blue;
      default: return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filter == 'all' ? _tasks : _tasks.where((t) => t['status'] == _filter).toList();

    return Scaffold(
      appBar: AppBar(title: const Text('Tasks', style: TextStyle(fontWeight: FontWeight.bold))),
      body: Column(
        children: [
          SizedBox(
            height: 48,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              children: ['all', 'open', 'in_progress', 'review', 'done'].map((s) => Padding(
                padding: const EdgeInsets.only(right: 8),
                child: FilterChip(
                  label: Text(s == 'all' ? 'All' : s.replaceAll('_', ' ')),
                  selected: _filter == s,
                  onSelected: (_) => setState(() => _filter = s),
                ),
              )).toList(),
            ),
          ),
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: filtered.length,
              itemBuilder: (ctx, i) {
                final t = filtered[i];
                final breached = t['sla_breached'] == true;
                return Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  color: breached ? Colors.red.shade50 : null,
                  child: ListTile(
                    leading: Container(
                      width: 4, height: 40,
                      decoration: BoxDecoration(color: _priorityColor(t['priority'] as String), borderRadius: BorderRadius.circular(2)),
                    ),
                    title: Row(
                      children: [
                        Expanded(child: Text(t['title'] as String, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600))),
                        if (breached) const Icon(Icons.warning, size: 16, color: Colors.red),
                      ],
                    ),
                    subtitle: Text('${t['assignee']} • Due: ${t['due']}', style: const TextStyle(fontSize: 12)),
                    trailing: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(color: _priorityColor(t['priority'] as String).withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
                      child: Text(t['priority'] as String, style: TextStyle(fontSize: 10, color: _priorityColor(t['priority'] as String), fontWeight: FontWeight.w600)),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(onPressed: () {}, child: const Icon(Icons.add_task)),
    );
  }
}
