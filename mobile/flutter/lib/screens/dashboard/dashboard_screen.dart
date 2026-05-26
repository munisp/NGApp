import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../services/api_service.dart';
import '../../services/auth_service.dart';
import '../../utils/theme.dart';

final dashboardKpisProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  final api = ref.read(apiServiceProvider);
  return api.query<Map<String, dynamic>>('overview.kpis');
});

final recentAlarmsProvider = FutureProvider<List<dynamic>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final result = await api.query<Map<String, dynamic>>('alarms.list', input: {'limit': 5, 'state': 'ACTIVE'});
  return result['alarms'] as List<dynamic>? ?? [];
});

final wellsSummaryProvider = FutureProvider<List<dynamic>>((ref) async {
  final api = ref.read(apiServiceProvider);
  final result = await api.query<Map<String, dynamic>>('wells.list', input: {'limit': 200});
  return result['wells'] as List<dynamic>? ?? [];
});

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final kpisAsync = ref.watch(dashboardKpisProvider);
    final alarmsAsync = ref.watch(recentAlarmsProvider);
    final wellsAsync = ref.watch(wellsSummaryProvider);
    final authState = ref.watch(authStateProvider);
    final user = authState.value?.user;

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Good ${_timeOfDay()}', style: Theme.of(context).textTheme.labelMedium),
            Text(user?['name'] as String? ?? 'Field Engineer',
                style: Theme.of(context).textTheme.titleLarge),
          ],
        ),
        actions: [
          alarmsAsync.when(
            data: (alarms) {
              final critical = alarms.where((a) => a['severity'] == 'CRITICAL').length;
              if (critical == 0) return const SizedBox.shrink();
              return Stack(
                children: [
                  IconButton(
                    icon: const Icon(Icons.notifications),
                    onPressed: () => context.go('/alarms'),
                  ),
                  Positioned(
                    right: 8, top: 8,
                    child: Container(
                      padding: const EdgeInsets.all(2),
                      decoration: const BoxDecoration(color: OGRMMTheme.error, shape: BoxShape.circle),
                      constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                      child: Text('$critical', style: const TextStyle(color: Colors.white, fontSize: 10), textAlign: TextAlign.center),
                    ),
                  ),
                ],
              );
            },
            loading: () => const SizedBox.shrink(),
            error: (_, __) => const SizedBox.shrink(),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(dashboardKpisProvider);
          ref.invalidate(recentAlarmsProvider);
          ref.invalidate(wellsSummaryProvider);
        },
        color: OGRMMTheme.primary,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Well status KPIs
              Text('Well Status', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              wellsAsync.when(
                data: (wells) => _WellStatusGrid(wells: wells),
                loading: () => const _KPIGridSkeleton(),
                error: (e, _) => Text('Error: $e', style: const TextStyle(color: OGRMMTheme.error)),
              ),
              const SizedBox(height: 16),

              // Production KPIs
              Text("Today's Production", style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              kpisAsync.when(
                data: (kpis) => _ProductionGrid(kpis: kpis),
                loading: () => const _KPIGridSkeleton(),
                error: (e, _) => Text('Error: $e', style: const TextStyle(color: OGRMMTheme.error)),
              ),
              const SizedBox(height: 16),

              // Active alarms
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('Active Alarms', style: Theme.of(context).textTheme.titleMedium),
                  TextButton(onPressed: () => context.go('/alarms'), child: const Text('See all')),
                ],
              ),
              alarmsAsync.when(
                data: (alarms) => alarms.isEmpty
                    ? const _EmptyAlarms()
                    : Column(children: alarms.take(5).map((a) => _AlarmRow(alarm: a)).toList()),
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => Text('Error: $e', style: const TextStyle(color: OGRMMTheme.error)),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _timeOfDay() {
    final h = DateTime.now().hour;
    if (h < 12) return 'morning';
    if (h < 17) return 'afternoon';
    return 'evening';
  }
}

class _WellStatusGrid extends StatelessWidget {
  final List<dynamic> wells;
  const _WellStatusGrid({required this.wells});

  @override
  Widget build(BuildContext context) {
    final producing = wells.where((w) => w['status'] == 'PRODUCING').length;
    final shutIn = wells.where((w) => w['status'] == 'SHUT_IN').length;
    final workover = wells.where((w) => w['status'] == 'WORKOVER').length;
    return GridView.count(
      crossAxisCount: 2, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(),
      crossAxisSpacing: 8, mainAxisSpacing: 8, childAspectRatio: 1.8,
      children: [
        _KPICard(title: 'Producing', value: '$producing', icon: Icons.oil_barrel, color: OGRMMTheme.wellProducing),
        _KPICard(title: 'Shut-In', value: '$shutIn', icon: Icons.pause_circle_outline, color: OGRMMTheme.wellShutIn),
        _KPICard(title: 'Workover', value: '$workover', icon: Icons.build_outlined, color: OGRMMTheme.wellWorkover),
        _KPICard(title: 'Total Wells', value: '${wells.length}', icon: Icons.location_on_outlined, color: OGRMMTheme.info),
      ],
    );
  }
}

class _ProductionGrid extends StatelessWidget {
  final Map<String, dynamic> kpis;
  const _ProductionGrid({required this.kpis});

  @override
  Widget build(BuildContext context) {
    return GridView.count(
      crossAxisCount: 2, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(),
      crossAxisSpacing: 8, mainAxisSpacing: 8, childAspectRatio: 1.8,
      children: [
        _KPICard(title: 'Oil Rate', value: '${(kpis['totalOilRate'] as num?)?.toStringAsFixed(0) ?? "—"} bbl/d', icon: Icons.water_drop, color: OGRMMTheme.primary),
        _KPICard(title: 'Gas Rate', value: '${(kpis['totalGasRate'] as num?)?.toStringAsFixed(0) ?? "—"} mscf/d', icon: Icons.gas_meter_outlined, color: OGRMMTheme.info),
        _KPICard(title: 'Water Cut', value: '${(kpis['avgWaterCut'] as num?)?.toStringAsFixed(1) ?? "—"}%', icon: Icons.water_outlined, color: OGRMMTheme.textSecondary),
        _KPICard(title: 'Uptime', value: '${(kpis['facilityUptime'] as num?)?.toStringAsFixed(1) ?? "—"}%', icon: Icons.access_time, color: OGRMMTheme.success),
      ],
    );
  }
}

class _KPICard extends StatelessWidget {
  final String title, value;
  final IconData icon;
  final Color color;
  const _KPICard({required this.title, required this.value, required this.icon, required this.color});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            Container(
              width: 36, height: 36,
              decoration: BoxDecoration(color: color.withOpacity(0.15), borderRadius: BorderRadius.circular(8)),
              child: Icon(icon, color: color, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(value, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                  Text(title, style: Theme.of(context).textTheme.labelSmall),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _KPIGridSkeleton extends StatelessWidget {
  const _KPIGridSkeleton();
  @override
  Widget build(BuildContext context) {
    return const Center(child: Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator()));
  }
}

class _AlarmRow extends StatelessWidget {
  final dynamic alarm;
  const _AlarmRow({required this.alarm});

  Color _severityColor(String s) {
    switch (s) {
      case 'CRITICAL': return OGRMMTheme.alarmCritical;
      case 'HIGH': return OGRMMTheme.alarmHigh;
      case 'MEDIUM': return OGRMMTheme.alarmMedium;
      default: return OGRMMTheme.alarmLow;
    }
  }

  @override
  Widget build(BuildContext context) {
    final color = _severityColor(alarm['severity'] as String? ?? 'LOW');
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: color, width: 1.5),
      ),
      child: ListTile(
        leading: CircleAvatar(backgroundColor: color.withOpacity(0.2), child: Icon(Icons.warning_amber, color: color, size: 18)),
        title: Text(alarm['message'] as String? ?? '—', maxLines: 1, overflow: TextOverflow.ellipsis),
        subtitle: Text('${alarm['wellName'] ?? "—"} · ${alarm['severity'] ?? "—"}'),
        trailing: const Icon(Icons.chevron_right, color: OGRMMTheme.textMuted),
      ),
    );
  }
}

class _EmptyAlarms extends StatelessWidget {
  const _EmptyAlarms();
  @override
  Widget build(BuildContext context) {
    return const Card(
      child: Padding(
        padding: EdgeInsets.all(32),
        child: Column(
          children: [
            Icon(Icons.check_circle_outline, size: 40, color: OGRMMTheme.success),
            SizedBox(height: 8),
            Text('No active alarms', style: TextStyle(color: OGRMMTheme.textSecondary)),
          ],
        ),
      ),
    );
  }
}
