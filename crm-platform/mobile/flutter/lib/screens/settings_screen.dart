import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/tenant_provider.dart';
import '../providers/sync_provider.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final tenant = context.watch<TenantProvider>().currentTenant;
    final sync = context.watch<SyncProvider>();

    return Scaffold(
      appBar: AppBar(title: const Text('Settings', style: TextStyle(fontWeight: FontWeight.bold))),
      body: ListView(
        children: [
          // Profile
          Container(
            padding: const EdgeInsets.all(16),
            color: Theme.of(context).colorScheme.primaryContainer.withOpacity(0.3),
            child: Row(
              children: [
                const CircleAvatar(radius: 30, child: Text('AO', style: TextStyle(fontSize: 20))),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Adebayo Okonkwo', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                      Text(tenant.name, style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.onSurfaceVariant)),
                      const Text('Tenant Admin', style: TextStyle(fontSize: 12, color: Colors.blue)),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Sync Status
          ListTile(
            leading: Icon(
              sync.isOnline ? Icons.cloud_done : Icons.cloud_off,
              color: sync.isOnline ? Colors.green : Colors.red,
            ),
            title: Text(sync.isOnline ? 'Online — Synced' : 'Offline — ${sync.pendingChanges} pending'),
            subtitle: Text('Bandwidth: ${sync.bandwidth.name}'),
            trailing: IconButton(icon: const Icon(Icons.sync), onPressed: () => sync.syncNow()),
          ),
          const Divider(),

          // Tenant Switch
          const Padding(
            padding: EdgeInsets.only(left: 16, top: 8, bottom: 4),
            child: Text('TENANT', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.grey)),
          ),
          ...context.read<TenantProvider>().tenants.map((t) => RadioListTile<String>(
            value: t.id,
            groupValue: tenant.id,
            title: Text(t.name),
            subtitle: Text('${t.tier} • ${t.products.values.where((v) => v).length} products'),
            onChanged: (v) => context.read<TenantProvider>().switchTenant(v!),
          )),
          const Divider(),

          // Settings
          const Padding(
            padding: EdgeInsets.only(left: 16, top: 8, bottom: 4),
            child: Text('PREFERENCES', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.grey)),
          ),
          SwitchListTile(
            title: const Text('Push Notifications'),
            subtitle: const Text('Receive campaign and security alerts'),
            value: true,
            onChanged: (_) {},
          ),
          SwitchListTile(
            title: const Text('Offline Mode'),
            subtitle: const Text('Cache data for offline access'),
            value: true,
            onChanged: (_) {},
          ),
          SwitchListTile(
            title: const Text('Low Bandwidth Mode'),
            subtitle: const Text('Reduce data usage for slow connections'),
            value: false,
            onChanged: (_) {},
          ),
          ListTile(
            leading: const Icon(Icons.language),
            title: const Text('Language'),
            trailing: const Text('English'),
            onTap: () {},
          ),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.info_outline),
            title: const Text('About CRM Platform'),
            subtitle: const Text('Version 1.0.0'),
          ),
          ListTile(
            leading: const Icon(Icons.logout, color: Colors.red),
            title: const Text('Sign Out', style: TextStyle(color: Colors.red)),
            onTap: () {},
          ),
        ],
      ),
    );
  }
}
