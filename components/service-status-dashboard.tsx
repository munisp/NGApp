import React, { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, Platform } from "react-native";

interface ServiceStatus {
  name: string;
  port: number;
  language: "go" | "python";
  status: "healthy" | "degraded" | "down" | "checking";
  latencyMs: number;
  details: Record<string, unknown>;
}

const SERVICES: Omit<ServiceStatus, "status" | "latencyMs" | "details">[] = [
  { name: "Kafka", port: 8081, language: "go" },
  { name: "Redis", port: 8082, language: "go" },
  { name: "TigerBeetle", port: 8083, language: "go" },
  { name: "APISIX", port: 8084, language: "go" },
  { name: "Temporal", port: 8085, language: "python" },
  { name: "Fluvio", port: 8086, language: "go" },
  { name: "OpenAppSec", port: 8087, language: "go" },
  { name: "Kubernetes", port: 8088, language: "go" },
  { name: "Permify", port: 8089, language: "python" },
  { name: "Lakehouse", port: 8090, language: "python" },
  { name: "Keycloak", port: 8091, language: "python" },
  { name: "Dapr", port: 8092, language: "python" },
];

const GATEWAY_BASE = Platform.OS === "web"
  ? (typeof window !== "undefined" ? window.location.origin : "")
  : "";

function getServiceUrl(port: number): string {
  const base = process.env.EXPO_PUBLIC_SERVICES_URL || GATEWAY_BASE || "http://localhost";
  return `${base}:${port}`;
}

function StatusDot({ status }: { status: ServiceStatus["status"] }) {
  const colors: Record<string, string> = {
    healthy: "#22c55e",
    degraded: "#f59e0b",
    down: "#ef4444",
    checking: "#94a3b8",
  };
  return (
    <View
      style={{
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: colors[status] || colors.checking,
      }}
    />
  );
}

function ServiceCard({ service }: { service: ServiceStatus }) {
  return (
    <View
      style={{
        backgroundColor: "#1e293b",
        borderRadius: 8,
        padding: 16,
        marginBottom: 8,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
        <StatusDot status={service.status} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: "#f8fafc", fontSize: 16, fontWeight: "600" }}>
            {service.name}
          </Text>
          <Text style={{ color: "#94a3b8", fontSize: 12 }}>
            :{service.port} · {service.language === "go" ? "Go" : "Python"}
          </Text>
        </View>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text
          style={{
            color: service.status === "healthy" ? "#22c55e" : service.status === "degraded" ? "#f59e0b" : "#ef4444",
            fontSize: 14,
            fontWeight: "500",
            textTransform: "uppercase",
          }}
        >
          {service.status}
        </Text>
        {service.latencyMs > 0 && (
          <Text style={{ color: "#64748b", fontSize: 11 }}>
            {service.latencyMs}ms
          </Text>
        )}
      </View>
    </View>
  );
}

export function ServiceStatusDashboard() {
  const [services, setServices] = useState<ServiceStatus[]>(
    SERVICES.map((s) => ({ ...s, status: "checking" as const, latencyMs: 0, details: {} }))
  );
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [checking, setChecking] = useState(false);

  const checkHealth = useCallback(async () => {
    setChecking(true);
    const results = await Promise.all(
      SERVICES.map(async (svc): Promise<ServiceStatus> => {
        const start = Date.now();
        try {
          const url = getServiceUrl(svc.port);
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);
          const resp = await fetch(`${url}/health`, { signal: controller.signal });
          clearTimeout(timeout);
          const latency = Date.now() - start;
          if (resp.ok) {
            const data = await resp.json();
            return { ...svc, status: "healthy", latencyMs: latency, details: data };
          }
          const data = await resp.json().catch(() => ({}));
          return { ...svc, status: "degraded", latencyMs: latency, details: data };
        } catch {
          return { ...svc, status: "down", latencyMs: Date.now() - start, details: {} };
        }
      })
    );
    setServices(results);
    setLastChecked(new Date());
    setChecking(false);
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  const healthyCount = services.filter((s) => s.status === "healthy").length;
  const degradedCount = services.filter((s) => s.status === "degraded").length;
  const downCount = services.filter((s) => s.status === "down").length;

  const overallStatus =
    downCount > 3 ? "critical" : downCount > 0 ? "degraded" : degradedCount > 0 ? "warning" : "operational";

  const overallColor =
    overallStatus === "operational" ? "#22c55e" : overallStatus === "warning" ? "#f59e0b" : "#ef4444";

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#0f172a", padding: 16 }}>
      <View style={{ marginBottom: 24 }}>
        <Text style={{ color: "#f8fafc", fontSize: 24, fontWeight: "700", marginBottom: 4 }}>
          Service Status
        </Text>
        <Text style={{ color: "#94a3b8", fontSize: 14 }}>
          {lastChecked ? `Last checked: ${lastChecked.toLocaleTimeString()}` : "Checking..."}
        </Text>
      </View>

      <View
        style={{
          backgroundColor: "#1e293b",
          borderRadius: 12,
          padding: 20,
          marginBottom: 24,
          borderLeftWidth: 4,
          borderLeftColor: overallColor,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View>
            <Text style={{ color: overallColor, fontSize: 18, fontWeight: "700", textTransform: "uppercase" }}>
              {overallStatus}
            </Text>
            <Text style={{ color: "#94a3b8", fontSize: 13, marginTop: 4 }}>
              {healthyCount} healthy · {degradedCount} degraded · {downCount} down
            </Text>
          </View>
          <Pressable
            onPress={checkHealth}
            style={{
              backgroundColor: "#334155",
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 6,
              opacity: checking ? 0.6 : 1,
            }}
            disabled={checking}
          >
            {checking ? (
              <ActivityIndicator size="small" color="#f8fafc" />
            ) : (
              <Text style={{ color: "#f8fafc", fontSize: 14, fontWeight: "500" }}>Refresh</Text>
            )}
          </Pressable>
        </View>
      </View>

      <Text style={{ color: "#94a3b8", fontSize: 13, fontWeight: "600", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
        Go Services
      </Text>
      {services
        .filter((s) => s.language === "go")
        .map((s) => (
          <ServiceCard key={s.name} service={s} />
        ))}

      <Text style={{ color: "#94a3b8", fontSize: 13, fontWeight: "600", marginBottom: 8, marginTop: 16, textTransform: "uppercase", letterSpacing: 1 }}>
        Python Services
      </Text>
      {services
        .filter((s) => s.language === "python")
        .map((s) => (
          <ServiceCard key={s.name} service={s} />
        ))}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}
