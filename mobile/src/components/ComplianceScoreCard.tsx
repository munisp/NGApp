import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";

interface Props {
  score: number;
  trend: string;
  dimensions: Record<string, number>;
}

export function ComplianceScoreCard({ score, trend, dimensions }: Props) {
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";

  return (
    <View style={styles.card}>
      <View style={styles.scoreContainer}>
        <Svg width={140} height={140}>
          <Circle cx={70} cy={70} r={radius} stroke="#1f2937" strokeWidth={8} fill="none" />
          <Circle
            cx={70} cy={70} r={radius}
            stroke={color} strokeWidth={8} fill="none"
            strokeDasharray={`${progress} ${circumference}`}
            strokeLinecap="round"
            transform="rotate(-90 70 70)"
          />
        </Svg>
        <View style={styles.scoreTextContainer}>
          <Text style={[styles.scoreValue, { color }]}>{Math.round(score)}</Text>
          <Text style={styles.scoreLabel}>/ 100</Text>
        </View>
      </View>
      <View style={styles.dimensionsContainer}>
        {Object.entries(dimensions).slice(0, 4).map(([key, value]) => (
          <View key={key} style={styles.dimension}>
            <Text style={styles.dimensionLabel}>{key.replace(/_/g, " ")}</Text>
            <View style={styles.dimensionBar}>
              <View style={[styles.dimensionFill, { width: `${value}%`, backgroundColor: value >= 70 ? "#10b981" : "#f59e0b" }]} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#111827", borderRadius: 16, padding: 20, marginHorizontal: 20, marginTop: 16 },
  scoreContainer: { alignItems: "center", marginBottom: 16 },
  scoreTextContainer: { position: "absolute", top: 45, alignItems: "center" },
  scoreValue: { fontSize: 36, fontWeight: "700" },
  scoreLabel: { fontSize: 12, color: "#6b7280" },
  dimensionsContainer: { gap: 8 },
  dimension: { flexDirection: "row", alignItems: "center", gap: 8 },
  dimensionLabel: { fontSize: 11, color: "#9ca3af", width: 80, textTransform: "capitalize" },
  dimensionBar: { flex: 1, height: 4, backgroundColor: "#1f2937", borderRadius: 2 },
  dimensionFill: { height: 4, borderRadius: 2 },
});
