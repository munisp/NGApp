import { View, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useColors } from '@/hooks/use-colors';

export interface RiskScoreDisplayProps {
  score: number; // 0-100
  explanation?: string;
  patterns?: string[];
  size?: 'small' | 'medium' | 'large';
}

export function RiskScoreDisplay({
  score,
  explanation,
  patterns = [],
  size = 'medium',
}: RiskScoreDisplayProps) {
  const colors = useColors();

  // Determine risk level and color
  const getRiskLevel = () => {
    if (score < 30) return { level: 'Low', color: '#22C55E', icon: 'check-circle' as const };
    if (score < 70) return { level: 'Medium', color: '#F59E0B', icon: 'warning' as const };
    return { level: 'High', color: '#EF4444', icon: 'error' as const };
  };

  const risk = getRiskLevel();

  const sizeStyles = {
    small: { container: 'p-2', score: 'text-lg', label: 'text-xs', icon: 20 },
    medium: { container: 'p-4', score: 'text-3xl', label: 'text-sm', icon: 28 },
    large: { container: 'p-6', score: 'text-5xl', label: 'text-base', icon: 36 },
  };

  const styles = sizeStyles[size];

  return (
    <View className={`bg-surface rounded-2xl border border-border ${styles.container}`}>
      {/* Risk Score Header */}
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-muted font-medium">Fraud Risk Score</Text>
        <MaterialIcons name={risk.icon} size={styles.icon} color={risk.color} />
      </View>

      {/* Score Display */}
      <View className="flex-row items-baseline mb-2">
        <Text
          className={`font-bold ${styles.score}`}
          style={{ color: risk.color }}
        >
          {score}
        </Text>
        <Text className="text-muted ml-1">/100</Text>
      </View>

      {/* Risk Level */}
      <View
        className="self-start px-3 py-1 rounded-full mb-3"
        style={{ backgroundColor: `${risk.color}20` }}
      >
        <Text className={`font-semibold ${styles.label}`} style={{ color: risk.color }}>
          {risk.level} Risk
        </Text>
      </View>

      {/* Explanation */}
      {explanation && (
        <View className="mb-3">
          <Text className="text-foreground text-sm leading-relaxed">
            {explanation}
          </Text>
        </View>
      )}

      {/* Suspicious Patterns */}
      {patterns.length > 0 && (
        <View className="mt-2 pt-3 border-t border-border">
          <Text className="text-muted text-xs font-medium mb-2">
            Detected Patterns:
          </Text>
          {patterns.map((pattern, index) => (
            <View key={index} className="flex-row items-start mb-1">
              <Text className="text-muted text-xs mr-1">•</Text>
              <Text className="text-muted text-xs flex-1">{pattern}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Risk Score Breakdown */}
      <View className="mt-3 pt-3 border-t border-border">
        <View className="flex-row justify-between items-center">
          <Text className="text-muted text-xs">Transaction Amount</Text>
          <View className="flex-row items-center">
            <View className="w-16 h-1 bg-border rounded-full mr-2">
              <View
                className="h-1 rounded-full"
                style={{
                  width: `${Math.min(100, (score / 100) * 100)}%`,
                  backgroundColor: risk.color,
                }}
              />
            </View>
            <Text className="text-muted text-xs">{Math.round(score * 0.3)}</Text>
          </View>
        </View>

        <View className="flex-row justify-between items-center mt-2">
          <Text className="text-muted text-xs">Account Behavior</Text>
          <View className="flex-row items-center">
            <View className="w-16 h-1 bg-border rounded-full mr-2">
              <View
                className="h-1 rounded-full"
                style={{
                  width: `${Math.min(100, (score / 100) * 80)}%`,
                  backgroundColor: risk.color,
                }}
              />
            </View>
            <Text className="text-muted text-xs">{Math.round(score * 0.25)}</Text>
          </View>
        </View>

        <View className="flex-row justify-between items-center mt-2">
          <Text className="text-muted text-xs">Transaction Pattern</Text>
          <View className="flex-row items-center">
            <View className="w-16 h-1 bg-border rounded-full mr-2">
              <View
                className="h-1 rounded-full"
                style={{
                  width: `${Math.min(100, (score / 100) * 90)}%`,
                  backgroundColor: risk.color,
                }}
              />
            </View>
            <Text className="text-muted text-xs">{Math.round(score * 0.25)}</Text>
          </View>
        </View>

        <View className="flex-row justify-between items-center mt-2">
          <Text className="text-muted text-xs">Historical Data</Text>
          <View className="flex-row items-center">
            <View className="w-16 h-1 bg-border rounded-full mr-2">
              <View
                className="h-1 rounded-full"
                style={{
                  width: `${Math.min(100, (score / 100) * 70)}%`,
                  backgroundColor: risk.color,
                }}
              />
            </View>
            <Text className="text-muted text-xs">{Math.round(score * 0.2)}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
