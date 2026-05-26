import 'package:flutter/material.dart';

class SecurityDashboardScreen extends StatefulWidget {
  const SecurityDashboardScreen({super.key});

  @override
  State<SecurityDashboardScreen> createState() => _SecurityDashboardScreenState();
}

class _SecurityDashboardScreenState extends State<SecurityDashboardScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 5, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Security Center'),
        bottom: TabBar(
          controller: _tabController,
          isScrollable: true,
          tabs: const [
            Tab(text: 'Overview', icon: Icon(Icons.dashboard)),
            Tab(text: 'DDoS', icon: Icon(Icons.shield)),
            Tab(text: 'Ransomware', icon: Icon(Icons.lock)),
            Tab(text: 'PBAC', icon: Icon(Icons.policy)),
            Tab(text: 'Resilience', icon: Icon(Icons.wifi)),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildOverviewTab(),
          _buildDDoSTab(),
          _buildRansomwareTab(),
          _buildPBACTab(),
          _buildResilienceTab(),
        ],
      ),
    );
  }

  Widget _buildOverviewTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildMetricRow([
            _buildMetricCard('Security Score', '92/100', 'Grade: A', Colors.green),
            _buildMetricCard('DDoS Blocked', '12', 'Last 30 days', Colors.orange),
          ]),
          const SizedBox(height: 16),
          _buildMetricRow([
            _buildMetricCard('Ransomware', '0.0/1.0', 'No threat', Colors.green),
            _buildMetricCard('PBAC Denied', '12,836', 'Policy violations', Colors.red),
          ]),
          const SizedBox(height: 24),
          const Text('Compliance Scores', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          _buildComplianceCard('OWASP Top 10', 90, 9, 10),
          _buildComplianceCard('PCI DSS', 91.7, 11, 12),
          _buildComplianceCard('CBN Guidelines', 100, 8, 8),
          _buildComplianceCard('NDPA', 85.7, 6, 7),
        ],
      ),
    );
  }

  Widget _buildDDoSTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildMetricRow([
            _buildMetricCard('Total Requests', '2.8M', 'Processed', Colors.blue),
            _buildMetricCard('Blocked', '1,247', 'Threats stopped', Colors.red),
          ]),
          const SizedBox(height: 16),
          const Text('Recent Attacks', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          _buildAttackCard('HTTP Flood', '198.51.100.0/24', '45,000 blocked', true),
          _buildAttackCard('Slowloris', '203.0.113.50', '1,200 blocked', true),
          _buildAttackCard('SYN Flood', '192.0.2.0/24', '89,000 blocked', true),
          const SizedBox(height: 16),
          const Text('Geo Blocking', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            children: [
              Chip(label: const Text('KP'), backgroundColor: Colors.red[100]),
              Chip(label: const Text('IR'), backgroundColor: Colors.red[100]),
              Chip(label: const Text('SY'), backgroundColor: Colors.red[100]),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildRansomwareTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildMetricRow([
            _buildMetricCard('Files Monitored', '12,847', 'Active', Colors.blue),
            _buildMetricCard('Threat Score', '0.0', 'No threat', Colors.green),
          ]),
          const SizedBox(height: 16),
          const Text('Canary Files', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          _buildCanaryCard('/app/data/.canary_payment_records', 'HEALTHY'),
          _buildCanaryCard('/app/config/.canary_system_config', 'HEALTHY'),
          _buildCanaryCard('/var/lib/postgresql/data/.canary_db', 'HEALTHY'),
          const SizedBox(height: 16),
          const Text('Backup Strategy', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          Wrap(
            spacing: 8,
            children: const [
              Chip(label: Text('IMMUTABLE S3')),
              Chip(label: Text('VERSIONED')),
              Chip(label: Text('CROSS REGION')),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPBACTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildMetricRow([
            _buildMetricCard('Evaluations', '1.28M', 'Total', Colors.blue),
            _buildMetricCard('Avg Latency', '12µs', 'Per eval', Colors.green),
          ]),
          const SizedBox(height: 16),
          const Text('Active Policies', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          _buildPolicyCard('NIP Payment Auth', 'ALLOW', 384921, 1247),
          _buildPolicyCard('High Value Block', 'DENY', 89472, 3891),
          _buildPolicyCard('Cross-Border', 'ALLOW', 45891, 892),
          _buildPolicyCard('After Hours', 'DENY', 284729, 2847),
          _buildPolicyCard('Sanctions Block', 'DENY', 384921, 127),
          _buildPolicyCard('Settlement Auth', 'ALLOW', 12847, 248),
        ],
      ),
    );
  }

  Widget _buildResilienceTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildMetricRow([
            _buildMetricCard('Queue', '0', 'Pending', Colors.green),
            _buildMetricCard('Synced', '384K', 'Operations', Colors.blue),
          ]),
          const SizedBox(height: 16),
          const Text('Connection Probes', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          _buildProbeCard('Lagos', '12ms', '45 Mbps', 'WIFI'),
          _buildProbeCard('Abuja', '35ms', '8.2 Mbps', '4G'),
          _buildProbeCard('Kano', '120ms', '1.5 Mbps', '3G'),
          _buildProbeCard('Maiduguri', '350ms', '0.3 Mbps', 'EDGE'),
          _buildProbeCard('Rural Benue', '800ms', '0.05 Mbps', 'EDGE'),
        ],
      ),
    );
  }

  Widget _buildMetricRow(List<Widget> children) {
    return Row(
      children: children.map((c) => Expanded(child: Padding(padding: const EdgeInsets.symmetric(horizontal: 4), child: c))).toList(),
    );
  }

  Widget _buildMetricCard(String title, String value, String subtitle, Color color) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: TextStyle(color: Colors.grey[600], fontSize: 12)),
            const SizedBox(height: 4),
            Text(value, style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: color)),
            Text(subtitle, style: TextStyle(color: Colors.grey[500], fontSize: 11)),
          ],
        ),
      ),
    );
  }

  Widget _buildComplianceCard(String name, double score, int passed, int total) {
    return Card(
      child: ListTile(
        title: Text(name),
        subtitle: LinearProgressIndicator(value: score / 100, backgroundColor: Colors.grey[200]),
        trailing: Text('$passed/$total', style: const TextStyle(fontWeight: FontWeight.bold)),
      ),
    );
  }

  Widget _buildAttackCard(String type, String source, String blocked, bool mitigated) {
    return Card(
      child: ListTile(
        leading: Icon(Icons.warning, color: mitigated ? Colors.green : Colors.red),
        title: Text(type),
        subtitle: Text(source),
        trailing: Text(blocked, style: const TextStyle(fontSize: 12)),
      ),
    );
  }

  Widget _buildCanaryCard(String path, String status) {
    return Card(
      child: ListTile(
        leading: Icon(Icons.check_circle, color: status == 'HEALTHY' ? Colors.green : Colors.red),
        title: Text(path, style: const TextStyle(fontSize: 12, fontFamily: 'monospace')),
        trailing: Chip(label: Text(status, style: const TextStyle(fontSize: 10))),
      ),
    );
  }

  Widget _buildPolicyCard(String name, String effect, int evals, int denials) {
    return Card(
      child: ListTile(
        leading: Icon(effect == 'ALLOW' ? Icons.check : Icons.block, color: effect == 'ALLOW' ? Colors.green : Colors.red),
        title: Text(name),
        subtitle: Text('$evals evaluations, $denials denials'),
        trailing: Chip(label: Text(effect), backgroundColor: effect == 'ALLOW' ? Colors.green[100] : Colors.red[100]),
      ),
    );
  }

  Widget _buildProbeCard(String region, String latency, String bandwidth, String tier) {
    final color = tier == 'EDGE' ? Colors.red : tier == '3G' ? Colors.orange : tier == '4G' ? Colors.blue : Colors.green;
    return Card(
      child: ListTile(
        title: Text(region),
        subtitle: Text('$latency latency • $bandwidth'),
        trailing: Chip(label: Text(tier), backgroundColor: color.withOpacity(0.1)),
      ),
    );
  }
}
