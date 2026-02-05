import { ScrollView, Text, View, Pressable, TextInput, Alert, Modal } from "react-native";
import { useState, useEffect } from "react";
import { CameraView, useCameraPermissions } from "expo-camera";
import QRCode from "react-native-qrcode-svg";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import {
  generateQRCodeData,
  createPaymentRequest,
  processQRPayment,
  getQRTransactionsByAccount,
  getQRPaymentSummary,
  getActivePaymentRequests,
  cancelPaymentRequest,
  validateQRCodeData,
  formatQRTransaction,
  type QRPaymentRequest,
  type QRPaymentTransaction,
} from "@/utils/qr-payments-enhanced";

export default function QRPaymentsEnhancedScreen() {
  const colors = useColors();
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<"home" | "generate" | "scan">("home");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [qrCodeData, setQRCodeData] = useState("");
  const [transactions, setTransactions] = useState<QRPaymentTransaction[]>([]);
  const [activeRequests, setActiveRequests] = useState<QRPaymentRequest[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [scanned, setScanned] = useState(false);

  const userAccount = "ACC123456"; // In production, get from auth context
  const userName = "John Doe"; // In production, get from auth context

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [txns, requests, summaryData] = await Promise.all([
      getQRTransactionsByAccount(userAccount),
      getActivePaymentRequests(userAccount),
      getQRPaymentSummary(userAccount),
    ]);
    
    setTransactions(txns);
    setActiveRequests(requests);
    setSummary(summaryData);
  };

  const handleGenerateQR = async () => {
    const amountValue = parseFloat(amount);
    if (isNaN(amountValue) || amountValue <= 0) {
      Alert.alert("Error", "Please enter a valid amount");
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const qrData = generateQRCodeData(
        userName,
        userAccount,
        amountValue,
        "USD",
        description || undefined
      );
      
      await createPaymentRequest(
        userName,
        userAccount,
        amountValue,
        "USD",
        description || undefined
      );
      
      setQRCodeData(qrData);
      await loadData();
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to generate QR code");
    }
  };

  const handleScan = async (data: string) => {
    if (scanned) return;
    
    setScanned(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Validate QR code
    const validation = validateQRCodeData(data);
    if (!validation.valid) {
      Alert.alert("Invalid QR Code", validation.error || "This QR code is not valid");
      setTimeout(() => setScanned(false), 2000);
      return;
    }
    
    // Process payment
    try {
      const result = await processQRPayment(data, userName, userAccount);
      
      if (result.success && result.transaction) {
        Alert.alert(
          "Payment Successful",
          `Paid $${result.transaction.amount.toFixed(2)} to ${result.transaction.recipient_name}`,
          [
            {
              text: "OK",
              onPress: () => {
                setMode("home");
                setScanned(false);
                loadData();
              },
            },
          ]
        );
      } else {
        Alert.alert("Payment Failed", result.error || "Unable to process payment");
        setTimeout(() => setScanned(false), 2000);
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to process payment");
      setTimeout(() => setScanned(false), 2000);
    }
  };

  const handleCancelRequest = async (requestId: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const success = await cancelPaymentRequest(requestId);
      
      if (success) {
        Alert.alert("Success", "Payment request cancelled");
        await loadData();
      } else {
        Alert.alert("Error", "Failed to cancel request");
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to cancel request");
    }
  };

  if (mode === "generate") {
    return (
      <ScreenContainer className="p-6">
        <ScrollView showsVerticalScrollIndicator={false}>
          <View className="gap-6">
            <View className="flex-row items-center justify-between">
              <Text className="text-2xl font-bold text-foreground">Generate QR Code</Text>
              <Pressable
                onPress={() => {
                  setMode("home");
                  setAmount("");
                  setDescription("");
                  setQRCodeData("");
                }}
              >
                <Text className="text-base text-muted">Cancel</Text>
              </Pressable>
            </View>

            {!qrCodeData ? (
              <View className="gap-4">
                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Amount</Text>
                  <TextInput
                    value={amount}
                    onChangeText={setAmount}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    autoFocus
                    style={{
                      backgroundColor: colors.surface,
                      color: colors.foreground,
                      borderColor: colors.border,
                    }}
                    className="border rounded-xl px-4 py-3 text-base"
                    placeholderTextColor={colors.muted}
                  />
                </View>

                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">
                    Description (Optional)
                  </Text>
                  <TextInput
                    value={description}
                    onChangeText={setDescription}
                    placeholder="What's this for?"
                    style={{
                      backgroundColor: colors.surface,
                      color: colors.foreground,
                      borderColor: colors.border,
                    }}
                    className="border rounded-xl px-4 py-3 text-base"
                    placeholderTextColor={colors.muted}
                  />
                </View>

                <Pressable
                  onPress={handleGenerateQR}
                  style={({ pressed }) => [
                    {
                      backgroundColor: colors.primary,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                  className="rounded-xl py-4 mt-4"
                >
                  <Text
                    style={{ color: colors.background }}
                    className="text-center font-semibold text-base"
                  >
                    Generate QR Code
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View className="gap-6 items-center">
                <View
                  style={{ backgroundColor: colors.surface }}
                  className="p-8 rounded-3xl border border-border"
                >
                  <QRCode value={qrCodeData} size={250} />
                </View>

                <View className="gap-2 items-center">
                  <Text className="text-xl font-bold text-foreground">${amount}</Text>
                  {description && (
                    <Text className="text-sm text-muted text-center">{description}</Text>
                  )}
                  <Text className="text-xs text-muted text-center">
                    Show this QR code to receive payment
                  </Text>
                  <Text className="text-xs text-muted text-center">
                    Expires in 30 minutes
                  </Text>
                </View>

                <Pressable
                  onPress={() => {
                    setMode("home");
                    setAmount("");
                    setDescription("");
                    setQRCodeData("");
                  }}
                  style={({ pressed }) => [
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                  className="rounded-xl py-3 px-6 border"
                >
                  <Text className="text-center font-semibold text-foreground">Done</Text>
                </Pressable>
              </View>
            )}
          </View>
        </ScrollView>
      </ScreenContainer>
    );
  }

  if (mode === "scan") {
    if (!permission) {
      return (
        <ScreenContainer className="p-6 justify-center">
          <Text className="text-center text-muted">Requesting camera permission...</Text>
        </ScreenContainer>
      );
    }

    if (!permission.granted) {
      return (
        <ScreenContainer className="p-6 justify-center">
          <View className="gap-4">
            <Text className="text-center text-foreground text-lg font-semibold">
              Camera Permission Required
            </Text>
            <Text className="text-center text-muted">
              We need camera access to scan QR codes for payments
            </Text>
            <Pressable
              onPress={requestPermission}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
              className="rounded-xl py-4"
            >
              <Text
                style={{ color: colors.background }}
                className="text-center font-semibold"
              >
                Grant Permission
              </Text>
            </Pressable>
            <Pressable onPress={() => setMode("home")}>
              <Text className="text-center text-muted">Cancel</Text>
            </Pressable>
          </View>
        </ScreenContainer>
      );
    }

    return (
      <View className="flex-1">
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: ["qr"],
          }}
          onBarcodeScanned={({ data }) => handleScan(data)}
        >
          <View className="flex-1 justify-between p-6">
            <View className="flex-row justify-between items-center">
              <Text
                style={{ color: colors.background }}
                className="text-xl font-bold"
              >
                Scan QR Code
              </Text>
              <Pressable
                onPress={() => {
                  setMode("home");
                  setScanned(false);
                }}
                style={({ pressed }) => [
                  {
                    backgroundColor: colors.background + "CC",
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
                className="px-4 py-2 rounded-full"
              >
                <Text className="font-semibold text-foreground">Cancel</Text>
              </Pressable>
            </View>

            <View className="items-center">
              <View
                style={{
                  width: 250,
                  height: 250,
                  borderWidth: 2,
                  borderColor: colors.primary,
                  borderRadius: 20,
                }}
              />
              <Text
                style={{ color: colors.background }}
                className="text-center mt-4 text-base"
              >
                Position QR code within the frame
              </Text>
            </View>

            <View />
          </View>
        </CameraView>
      </View>
    );
  }

  return (
    <ScreenContainer className="p-6">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="gap-6">
          <View className="gap-2">
            <Text className="text-2xl font-bold text-foreground">QR Payments</Text>
            <Text className="text-sm text-muted">
              Instant contactless payments
            </Text>
          </View>

          {/* Summary */}
          {summary && (
            <View className="flex-row gap-3">
              <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
                <Text className="text-sm text-muted mb-1">Total Sent</Text>
                <Text className="text-xl font-bold text-foreground">
                  ${summary.total_sent.toFixed(2)}
                </Text>
              </View>
              <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
                <Text className="text-sm text-muted mb-1">Total Received</Text>
                <Text className="text-xl font-bold text-foreground">
                  ${summary.total_received.toFixed(2)}
                </Text>
              </View>
            </View>
          )}

          {/* Action Buttons */}
          <View className="flex-row gap-3">
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setMode("generate");
              }}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
              className="flex-1 rounded-2xl py-6 items-center"
            >
              <Text className="text-4xl mb-2">📱</Text>
              <Text
                style={{ color: colors.background }}
                className="font-semibold text-base"
              >
                Generate QR
              </Text>
              <Text
                style={{ color: colors.background }}
                className="text-xs opacity-80"
              >
                Receive money
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setMode("scan");
              }}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              className="flex-1 rounded-2xl py-6 items-center border"
            >
              <Text className="text-4xl mb-2">📷</Text>
              <Text className="font-semibold text-base text-foreground">Scan QR</Text>
              <Text className="text-xs text-muted">Send money</Text>
            </Pressable>
          </View>

          {/* Active Requests */}
          {activeRequests.length > 0 && (
            <View className="gap-3">
              <Text className="text-lg font-semibold text-foreground">
                Active Requests
              </Text>
              {activeRequests.map((request) => (
                <View
                  key={request.id}
                  style={{ backgroundColor: colors.surface }}
                  className="rounded-2xl p-4 border border-border"
                >
                  <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-1">
                      <Text className="text-base font-semibold text-foreground">
                        ${request.amount.toFixed(2)}
                      </Text>
                      {request.description && (
                        <Text className="text-sm text-muted">{request.description}</Text>
                      )}
                    </View>
                    <Pressable
                      onPress={() => handleCancelRequest(request.id)}
                      style={({ pressed }) => [
                        {
                          backgroundColor: colors.error + "20",
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}
                      className="px-3 py-1 rounded-full"
                    >
                      <Text style={{ color: colors.error }} className="text-xs font-semibold">
                        Cancel
                      </Text>
                    </Pressable>
                  </View>
                  <Text className="text-xs text-muted">
                    Expires {new Date(request.expires_at).toLocaleTimeString()}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Recent Transactions */}
          {transactions.length > 0 && (
            <View className="gap-3">
              <Text className="text-lg font-semibold text-foreground">
                Recent Transactions
              </Text>
              {transactions.slice(0, 10).map((transaction) => {
                const formatted = formatQRTransaction(transaction, userAccount);
                return (
                  <View
                    key={transaction.id}
                    style={{ backgroundColor: colors.surface }}
                    className="rounded-xl p-4 border border-border"
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1">
                        <Text className="text-base font-semibold text-foreground">
                          {formatted.counterparty}
                        </Text>
                        <Text className="text-sm text-muted">{formatted.description}</Text>
                        <Text className="text-xs text-muted">
                          {new Date(transaction.timestamp).toLocaleString()}
                        </Text>
                      </View>
                      <Text
                        style={{
                          color: formatted.type === "received" ? colors.success : colors.error,
                        }}
                        className="text-lg font-bold"
                      >
                        {formatted.type === "received" ? "+" : "-"}
                        {formatted.amount}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {transactions.length === 0 && activeRequests.length === 0 && (
            <View className="items-center py-12">
              <Text className="text-6xl mb-4">📱</Text>
              <Text className="text-lg font-semibold text-foreground mb-2">
                No QR Payments Yet
              </Text>
              <Text className="text-sm text-muted text-center">
                Generate a QR code to receive payments or scan to send
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
