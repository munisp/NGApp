import React, { useEffect, useRef } from 'react';
import { View, Animated, ViewStyle, Platform } from 'react-native';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width = '100%', height = 20, borderRadius = 4, style }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: Platform.OS !== 'web' }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width: width as number,
          height,
          borderRadius,
          backgroundColor: '#E1E9EE',
          opacity,
        },
        style,
      ]}
    />
  );
}

export function SkeletonCard({ style }: { style?: ViewStyle }) {
  return (
    <View style={[{ padding: 16, borderRadius: 12, backgroundColor: '#fff', marginBottom: 12 }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <Skeleton width={40} height={40} borderRadius={20} />
        <View style={{ marginLeft: 12, flex: 1 }}>
          <Skeleton width="60%" height={14} style={{ marginBottom: 6 }} />
          <Skeleton width="40%" height={10} />
        </View>
      </View>
      <Skeleton width="100%" height={12} style={{ marginBottom: 8 }} />
      <Skeleton width="80%" height={12} />
    </View>
  );
}

export function SkeletonList({ count = 3, style }: { count?: number; style?: ViewStyle }) {
  return (
    <View style={style}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </View>
  );
}

export function SkeletonDashboard() {
  return (
    <View style={{ padding: 16 }}>
      <Skeleton width="50%" height={24} style={{ marginBottom: 8 }} />
      <Skeleton width="30%" height={14} style={{ marginBottom: 24 }} />

      <View style={{ flexDirection: 'row', marginBottom: 24, gap: 12 }}>
        {[1, 2, 3].map((i) => (
          <View key={i} style={{ flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#fff' }}>
            <Skeleton width="60%" height={12} style={{ marginBottom: 8 }} />
            <Skeleton width="80%" height={20} />
          </View>
        ))}
      </View>

      <SkeletonList count={4} />
    </View>
  );
}

export function SkeletonProfile() {
  return (
    <View style={{ padding: 16, alignItems: 'center' }}>
      <Skeleton width={80} height={80} borderRadius={40} style={{ marginBottom: 16 }} />
      <Skeleton width={150} height={18} style={{ marginBottom: 8 }} />
      <Skeleton width={200} height={14} style={{ marginBottom: 24 }} />
      <SkeletonList count={3} />
    </View>
  );
}

export function SkeletonTransaction() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' }}>
      <Skeleton width={44} height={44} borderRadius={22} />
      <View style={{ marginLeft: 12, flex: 1 }}>
        <Skeleton width="50%" height={14} style={{ marginBottom: 6 }} />
        <Skeleton width="30%" height={10} />
      </View>
      <Skeleton width={60} height={16} />
    </View>
  );
}
