import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/connectivity_service.dart';
import '../services/offline_service.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final connectivity = context.watch<ConnectivityService>();
    final offline = context.read<OfflineService>();

    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        children: [
          // Connection status
          Container(
            margin: const EdgeInsets.all(16),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: connectivity.isOnline ? Colors.green.shade50 : Colors.red.shade50,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: connectivity.isOnline ? Colors.green.shade200 : Colors.red.shade200),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(connectivity.isOnline ? Icons.wifi : Icons.wifi_off,
                        color: connectivity.isOnline ? Colors.green : Colors.red),
                    const SizedBox(width: 8),
                    Text('Connection: ${connectivity.qualityLabel}',
                        style: const TextStyle(fontWeight: FontWeight.bold)),
                  ],
                ),
                const SizedBox(height: 4),
                Text('Bandwidth: ${connectivity.bandwidthKbps.toStringAsFixed(0)} kbps'),
                Text('Recommended batch size: ${connectivity.recommendedBatchSize}'),
                Text('Queued operations: ${offline.pendingCount}'),
              ],
            ),
          ),

          const _SectionHeader('Account'),
          const ListTile(leading: Icon(Icons.person), title: Text('Profile'), trailing: Icon(Icons.chevron_right)),
          const ListTile(leading: Icon(Icons.security), title: Text('Security & PIN'), trailing: Icon(Icons.chevron_right)),
          const ListTile(leading: Icon(Icons.fingerprint), title: Text('Biometric Login'), trailing: Icon(Icons.chevron_right)),

          const _SectionHeader('Preferences'),
          const ListTile(leading: Icon(Icons.language), title: Text('Language'), trailing: Text('English')),
          const ListTile(leading: Icon(Icons.dark_mode), title: Text('Theme'), trailing: Text('System')),
          const ListTile(leading: Icon(Icons.notifications), title: Text('Notifications'), trailing: Icon(Icons.chevron_right)),

          const _SectionHeader('Data & Sync'),
          ListTile(
            leading: const Icon(Icons.sync),
            title: const Text('Sync Now'),
            subtitle: Text('${offline.pendingCount} pending operations'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () {},
          ),
          const ListTile(leading: Icon(Icons.storage), title: Text('Clear Cache'), trailing: Icon(Icons.chevron_right)),
          const ListTile(leading: Icon(Icons.download), title: Text('Download for Offline'), trailing: Icon(Icons.chevron_right)),

          const _SectionHeader('About'),
          const ListTile(leading: Icon(Icons.info), title: Text('Version'), trailing: Text('1.0.0')),
          const ListTile(leading: Icon(Icons.description), title: Text('Terms & Conditions')),
          const ListTile(leading: Icon(Icons.privacy_tip), title: Text('Privacy Policy')),

          const SizedBox(height: 24),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: OutlinedButton.icon(
              onPressed: () {},
              icon: const Icon(Icons.logout, color: Colors.red),
              label: const Text('Sign Out', style: TextStyle(color: Colors.red)),
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 14),
                side: const BorderSide(color: Colors.red),
              ),
            ),
          ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;
  const _SectionHeader(this.title);
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 24, 16, 8),
      child: Text(title, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.grey.shade600)),
    );
  }
}
