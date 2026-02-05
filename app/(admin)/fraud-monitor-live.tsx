import { View, Text, ScrollView, Pressable, RefreshControl } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useState, useEffect, useRef } from "react";
import { useColors } from "@/hooks/use-colors";

interface FraudEvent {
  event_type: string;
  timestamp: string;
  data: {
    transaction_id?: string;
    user_id?: string;
    amount?: number;
    risk_score?: number;
    is_fraud?: boolean;
    fraud_type?: string;
    recommended_action?: string;
    details?: any;
    
    // Statistics
    total_transactions_today?: number;
    fraud_detected_today?: number;
    fraud_rate?: number;
    avg_risk_score?: number;
    high_risk_transactions?: number;
    blocked_transactions?: number;
    under_review?: number;
    false_positives_today?: number;
    true_positives_today?: number;
    precision?: number;
    active_alerts?: number;
    
    // Alert
    alert_type?: string;
    severity?: string;
    message?: string;
  };
}

interface Statistics {
  total_transactions_today: number;
  fraud_detected_today: number;
  fraud_rate: number;
  avg_risk_score: number;
  high_risk_transactions: number;
  blocked_transactions: number;
  under_review: number;
  false_positives_today: number;
  true_positives_today: number;
  precision: number;
  active_alerts: number;
}

export default function FraudMonitorLiveScreen() {
  const colors = useColors();
  const [isConnected, setIsConnected] = useState(false);
  const [events, setEvents] = useState<FraudEvent[]>([]);
  const [statistics, setStatistics] = useState<Statistics>({
    total_transactions_today: 0,
    fraud_detected_today: 0,
    fraud_rate: 0,
    avg_risk_score: 0,
    high_risk_transactions: 0,
    blocked_transactions: 0,
    under_review: 0,
    false_positives_today: 0,
    true_positives_today: 0,
    precision: 0,
    active_alerts: 0,
  });
  const [refreshing, setRefreshing] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    connectWebSocket();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const connectWebSocket = () => {
    try {
      // Replace with your fraud detection service WebSocket URL
      const wsUrl = "ws://localhost:8004/ws/fraud-monitor";
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("WebSocket connected");
        setIsConnected(true);
        
        // Send heartbeat every 30 seconds
        const heartbeat = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send("ping");
          }
        }, 30000);
        
        ws.onclose = () => {
          clearInterval(heartbeat);
        };
      };

      ws.onmessage = (event) => {
        try {
          const fraudEvent: FraudEvent = JSON.parse(event.data);
          handleFraudEvent(fraudEvent);
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setIsConnected(false);
      };

      ws.onclose = () => {
        console.log("WebSocket disconnected");
        setIsConnected(false);
        
        // Reconnect after 5 seconds
        setTimeout(() => {
          connectWebSocket();
        }, 5000);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error("Error connecting to WebSocket:", error);
      setIsConnected(false);
    }
  };

  const handleFraudEvent = (event: FraudEvent) => {
    if (event.event_type === "fraud_detection") {
      // Add to events list (keep last 50)
      setEvents((prev) => [event, ...prev].slice(0, 50));
    } else if (event.event_type === "statistics_update") {
      // Update statistics
      setStatistics(event.data as Statistics);
    } else if (event.event_type === "fraud_alert") {
      // Show alert notification
      console.log("Fraud alert:", event.data.message);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    // Reconnect WebSocket
    if (wsRef.current) {
      wsRef.current.close();
    }
    connectWebSocket();
    setTimeout(() => setRefreshing(false), 1000);
  };

  const getRiskColor = (score: number) => {
    if (score >= 0.8) return "#EF4444";
    if (score >= 0.5) return "#F59E0B";
    return "#22C55E";
  };

  const getActionColor = (action: string) => {
    if (action === "block") return "#EF4444";
    if (action === "challenge") return "#F59E0B";
    if (action === "review") return "#3B82F6";
    return "#22C55E";
  };

  return (
    <ScreenContainer className="p-4">
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View className="mb-6">
          <Text className="text-2xl font-bold text-foreground mb-2">
            Live Fraud Monitor
          </Text>
          <View className="flex-row items-center">
            <View
              className="w-2 h-2 rounded-full mr-2"
              style={{ backgroundColor: isConnected ? "#22C55E" : "#EF4444" }}
            />
            <Text className="text-sm text-muted">
              {isConnected ? "Connected" : "Disconnected"}
            </Text>
          </View>
        </View>

        {/* Statistics Cards */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-foreground mb-3">
            Today's Statistics
          </Text>
          
          <View className="flex-row flex-wrap gap-3">
            <View className="flex-1 min-w-[45%] bg-surface rounded-lg p-4 border border-border">
              <Text className="text-sm text-muted mb-1">Total Transactions</Text>
              <Text className="text-2xl font-bold text-foreground">
                {statistics.total_transactions_today.toLocaleString()}
              </Text>
            </View>
            
            <View className="flex-1 min-w-[45%] bg-surface rounded-lg p-4 border border-border">
              <Text className="text-sm text-muted mb-1">Fraud Detected</Text>
              <Text className="text-2xl font-bold" style={{ color: "#EF4444" }}>
                {statistics.fraud_detected_today}
              </Text>
            </View>
            
            <View className="flex-1 min-w-[45%] bg-surface rounded-lg p-4 border border-border">
              <Text className="text-sm text-muted mb-1">Fraud Rate</Text>
              <Text className="text-2xl font-bold text-foreground">
                {statistics.fraud_rate.toFixed(2)}%
              </Text>
            </View>
            
            <View className="flex-1 min-w-[45%] bg-surface rounded-lg p-4 border border-border">
              <Text className="text-sm text-muted mb-1">Precision</Text>
              <Text className="text-2xl font-bold" style={{ color: "#22C55E" }}>
                {statistics.precision.toFixed(1)}%
              </Text>
            </View>
            
            <View className="flex-1 min-w-[45%] bg-surface rounded-lg p-4 border border-border">
              <Text className="text-sm text-muted mb-1">Under Review</Text>
              <Text className="text-2xl font-bold" style={{ color: "#F59E0B" }}>
                {statistics.under_review}
              </Text>
            </View>
            
            <View className="flex-1 min-w-[45%] bg-surface rounded-lg p-4 border border-border">
              <Text className="text-sm text-muted mb-1">Active Alerts</Text>
              <Text className="text-2xl font-bold" style={{ color: "#EF4444" }}>
                {statistics.active_alerts}
              </Text>
            </View>
          </View>
        </View>

        {/* Live Events */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-foreground mb-3">
            Live Fraud Events
          </Text>
          
          {events.length === 0 ? (
            <View className="bg-surface rounded-lg p-6 border border-border">
              <Text className="text-center text-muted">
                {isConnected
                  ? "Waiting for fraud events..."
                  : "Connecting to fraud detection service..."}
              </Text>
            </View>
          ) : (
            events.map((event, index) => {
              if (event.event_type !== "fraud_detection") return null;
              
              const data = event.data;
              const riskColor = getRiskColor(data.risk_score || 0);
              const actionColor = getActionColor(data.recommended_action || "allow");
              
              return (
                <View
                  key={`${data.transaction_id}-${index}`}
                  className="bg-surface rounded-lg p-4 mb-3 border border-border"
                >
                  <View className="flex-row justify-between items-start mb-2">
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-foreground">
                        {data.transaction_id}
                      </Text>
                      <Text className="text-xs text-muted">
                        {new Date(event.timestamp).toLocaleTimeString()}
                      </Text>
                    </View>
                    
                    <View
                      className="px-3 py-1 rounded-full"
                      style={{ backgroundColor: riskColor + "20" }}
                    >
                      <Text
                        className="text-xs font-semibold"
                        style={{ color: riskColor }}
                      >
                        {data.is_fraud ? "FRAUD" : "CLEAN"}
                      </Text>
                    </View>
                  </View>
                  
                  <View className="flex-row justify-between mb-2">
                    <Text className="text-sm text-muted">Amount:</Text>
                    <Text className="text-sm font-semibold text-foreground">
                      ${data.amount?.toFixed(2)}
                    </Text>
                  </View>
                  
                  <View className="flex-row justify-between mb-2">
                    <Text className="text-sm text-muted">Risk Score:</Text>
                    <Text
                      className="text-sm font-semibold"
                      style={{ color: riskColor }}
                    >
                      {((data.risk_score || 0) * 100).toFixed(1)}%
                    </Text>
                  </View>
                  
                  <View className="flex-row justify-between mb-2">
                    <Text className="text-sm text-muted">Type:</Text>
                    <Text className="text-sm text-foreground">
                      {data.fraud_type || "N/A"}
                    </Text>
                  </View>
                  
                  <View className="flex-row justify-between">
                    <Text className="text-sm text-muted">Action:</Text>
                    <Text
                      className="text-sm font-semibold uppercase"
                      style={{ color: actionColor }}
                    >
                      {data.recommended_action}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
