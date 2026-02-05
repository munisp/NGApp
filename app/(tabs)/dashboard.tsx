import { ScrollView, Text, View, RefreshControl, Pressable, ActivityIndicator } from "react-native";
import { useEffect, useState, useCallback } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useDashboardMetrics } from "@/hooks/use-dashboard-metrics";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

/**
 * Pilot Dashboard Screen
 * 
 * Real-time monitoring dashboard for the Tier 1 Starter Loan pilot program.
 * Displays:
 * - Application metrics (total, pending, approved, rejected, approval rate)
 * - Disbursement metrics (total disbursed, count, average loan amount)
 * - Repayment metrics (total repaid, on-time rate, outstanding balance)
 * - Default metrics (count, rate, total amount, recovery rate)
 * - Tier graduation metrics (users per tier, graduation count)
 * - Financial metrics (revenue, interest earned, profit margin)
 * 
 * Features:
 * - WebSocket real-time updates (30-second refresh)
 * - Pull-to-refresh
 * - Metric cards with icons and color coding
 * - Time series charts (coming soon)
 */

interface DashboardMetrics {
  // Application Metrics
  total_applications: number;
  pending_applications: number;
  approved_applications: number;
  rejected_applications: number;
  approval_rate: number;
  avg_processing_time_hours: number;
  
  // Disbursement Metrics
  total_disbursed: number;
  disbursement_count: number;
  avg_loan_amount: number;
  pending_disbursements: number;
  
  // Repayment Metrics
  total_repaid: number;
  repayment_count: number;
  on_time_repayment_rate: number;
  outstanding_balance: number;
  
  // Default Metrics
  default_count: number;
  default_rate: number;
  total_default_amount: number;
  recovery_rate: number;
  
  // Tier Graduation Metrics
  tier1_users: number;
  tier2_users: number;
  tier3_users: number;
  tier4_users: number;
  tier5_users: number;
  graduation_count: number;
  avg_credit_score_improvement: number;
  
  // User Engagement Metrics
  active_users: number;
  new_users_today: number;
  avg_loans_per_user: number;
  
  // Financial Metrics
  total_revenue: number;
  total_interest_earned: number;
  net_profit_margin: number;
  
  // Timestamp
  as_of: string;
}

function MetricCard({ 
  title, 
  value, 
  subtitle, 
  icon, 
  trend 
}: { 
  title: string; 
  value: string; 
  subtitle?: string; 
  icon?: string;
  trend?: "up" | "down" | "neutral";
}) {
  const colors = useColors();
  
  const trendColor = trend === "up" ? colors.success : trend === "down" ? colors.error : colors.muted;
  
  return (
    <View className="bg-surface rounded-2xl p-4 border border-border">
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-sm text-muted">{title}</Text>
        {icon && <IconSymbol name={icon as any} size={20} color={colors.primary} />}
      </View>
      <Text className="text-2xl font-bold text-foreground mb-1">{value}</Text>
      {subtitle && (
        <Text className="text-xs" style={{ color: trendColor }}>
          {subtitle}
        </Text>
      )}
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <Text className="text-lg font-semibold text-foreground mb-3 mt-6">
      {title}
    </Text>
  );
}

export default function DashboardScreen() {
  const colors = useColors();
  const { metrics, loading, error, refreshMetrics } = useDashboardMetrics();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshMetrics();
    setRefreshing(false);
  }, [refreshMetrics]);

  // Format currency
  const formatCurrency = (amount: number) => {
    return `₦${(amount / 1000000).toFixed(2)}M`;
  };

  // Format percentage
  const formatPercentage = (rate: number) => {
    return `${(rate * 100).toFixed(1)}%`;
  };

  // Format number with commas
  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  if (loading && !metrics) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="text-muted mt-4">Loading dashboard metrics...</Text>
      </ScreenContainer>
    );
  }

  if (error) {
    return (
      <ScreenContainer className="items-center justify-center p-6">
        <Text className="text-error text-center mb-4">{error}</Text>
        <Pressable
          onPress={refreshMetrics}
          style={({ pressed }) => [
            { opacity: pressed ? 0.7 : 1 }
          ]}
          className="bg-primary px-6 py-3 rounded-full"
        >
          <Text className="text-background font-semibold">Retry</Text>
        </Pressable>
      </ScreenContainer>
    );
  }

  if (!metrics) {
    return (
      <ScreenContainer className="items-center justify-center">
        <Text className="text-muted">No metrics available</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Header */}
        <View className="mb-4">
          <Text className="text-3xl font-bold text-foreground">Pilot Dashboard</Text>
          <Text className="text-sm text-muted mt-1">
            Last updated: {new Date(metrics.as_of).toLocaleTimeString()}
          </Text>
        </View>

        {/* Application Metrics */}
        <SectionHeader title="Applications" />
        <View className="gap-3">
          <View className="flex-row gap-3">
            <View className="flex-1">
              <MetricCard
                title="Total Applications"
                value={formatNumber(metrics.total_applications)}
                icon="paperplane.fill"
              />
            </View>
            <View className="flex-1">
              <MetricCard
                title="Approval Rate"
                value={formatPercentage(metrics.approval_rate)}
                subtitle={`${formatNumber(metrics.approved_applications)} approved`}
                trend="up"
              />
            </View>
          </View>
          
          <View className="flex-row gap-3">
            <View className="flex-1">
              <MetricCard
                title="Pending"
                value={formatNumber(metrics.pending_applications)}
                subtitle={`Avg ${metrics.avg_processing_time_hours.toFixed(1)}h processing`}
              />
            </View>
            <View className="flex-1">
              <MetricCard
                title="Rejected"
                value={formatNumber(metrics.rejected_applications)}
                subtitle={formatPercentage(metrics.rejected_applications / metrics.total_applications)}
                trend="neutral"
              />
            </View>
          </View>
        </View>

        {/* Disbursement Metrics */}
        <SectionHeader title="Disbursements" />
        <View className="gap-3">
          <MetricCard
            title="Total Disbursed"
            value={formatCurrency(metrics.total_disbursed)}
            subtitle={`${formatNumber(metrics.disbursement_count)} loans`}
            icon="house.fill"
          />
          
          <View className="flex-row gap-3">
            <View className="flex-1">
              <MetricCard
                title="Avg Loan Amount"
                value={formatCurrency(metrics.avg_loan_amount)}
              />
            </View>
            <View className="flex-1">
              <MetricCard
                title="Pending"
                value={formatNumber(metrics.pending_disbursements)}
              />
            </View>
          </View>
        </View>

        {/* Repayment Metrics */}
        <SectionHeader title="Repayments" />
        <View className="gap-3">
          <View className="flex-row gap-3">
            <View className="flex-1">
              <MetricCard
                title="Total Repaid"
                value={formatCurrency(metrics.total_repaid)}
                subtitle={`${formatNumber(metrics.repayment_count)} payments`}
              />
            </View>
            <View className="flex-1">
              <MetricCard
                title="On-Time Rate"
                value={formatPercentage(metrics.on_time_repayment_rate)}
                trend="up"
              />
            </View>
          </View>
          
          <MetricCard
            title="Outstanding Balance"
            value={formatCurrency(metrics.outstanding_balance)}
          />
        </View>

        {/* Default Metrics */}
        <SectionHeader title="Defaults" />
        <View className="gap-3">
          <View className="flex-row gap-3">
            <View className="flex-1">
              <MetricCard
                title="Default Count"
                value={formatNumber(metrics.default_count)}
                subtitle={formatPercentage(metrics.default_rate)}
                trend="down"
              />
            </View>
            <View className="flex-1">
              <MetricCard
                title="Default Amount"
                value={formatCurrency(metrics.total_default_amount)}
              />
            </View>
          </View>
          
          <MetricCard
            title="Recovery Rate"
            value={formatPercentage(metrics.recovery_rate)}
            subtitle="Through collections"
            trend="up"
          />
        </View>

        {/* Tier Graduation Metrics */}
        <SectionHeader title="Tier Distribution" />
        <View className="gap-3">
          <View className="flex-row gap-3">
            <View className="flex-1">
              <MetricCard
                title="Tier 1 (Starter)"
                value={formatNumber(metrics.tier1_users)}
              />
            </View>
            <View className="flex-1">
              <MetricCard
                title="Tier 2 (Builder)"
                value={formatNumber(metrics.tier2_users)}
              />
            </View>
          </View>
          
          <View className="flex-row gap-3">
            <View className="flex-1">
              <MetricCard
                title="Tier 3 (Achiever)"
                value={formatNumber(metrics.tier3_users)}
              />
            </View>
            <View className="flex-1">
              <MetricCard
                title="Tier 4+ (Elite)"
                value={formatNumber(metrics.tier4_users + metrics.tier5_users)}
              />
            </View>
          </View>
          
          <MetricCard
            title="Total Graduations"
            value={formatNumber(metrics.graduation_count)}
            subtitle={`Avg +${metrics.avg_credit_score_improvement.toFixed(0)} credit score`}
            trend="up"
          />
        </View>

        {/* Financial Metrics */}
        <SectionHeader title="Financial Performance" />
        <View className="gap-3">
          <MetricCard
            title="Total Revenue"
            value={formatCurrency(metrics.total_revenue)}
            subtitle={`Interest: ${formatCurrency(metrics.total_interest_earned)}`}
          />
          
          <MetricCard
            title="Net Profit Margin"
            value={formatPercentage(metrics.net_profit_margin)}
            trend={metrics.net_profit_margin > 0.15 ? "up" : "neutral"}
          />
        </View>

        {/* User Engagement */}
        <SectionHeader title="User Engagement" />
        <View className="gap-3">
          <View className="flex-row gap-3">
            <View className="flex-1">
              <MetricCard
                title="Active Users"
                value={formatNumber(metrics.active_users)}
              />
            </View>
            <View className="flex-1">
              <MetricCard
                title="New Today"
                value={formatNumber(metrics.new_users_today)}
              />
            </View>
          </View>
          
          <MetricCard
            title="Avg Loans Per User"
            value={metrics.avg_loans_per_user.toFixed(2)}
          />
        </View>

        {/* Bottom spacing */}
        <View className="h-8" />
      </ScrollView>
    </ScreenContainer>
  );
}
