import { ScrollView, Text, View, TouchableOpacity, TextInput, Modal, Platform, Alert } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useState, useEffect } from "react";
import { useColors } from "@/hooks/use-colors";
import * as Haptics from "expo-haptics";
import * as DocumentPicker from "expo-document-picker";
import * as Sharing from "expo-sharing";
import {
  EstateDocument,
  Beneficiary,
  loadEstateDocuments,
  saveEstateDocument,
  deleteEstateDocument,
  loadBeneficiaries,
  saveBeneficiary,
  deleteBeneficiary,
  shareDocument,
  revokeAccess,
  notifyBeneficiaries,
  getDocumentTypeLabel,
  getDocumentTypeIcon,
  validateBeneficiaryPercentages,
  generateEstateReport,
  cleanupExpiredAccess,
} from "@/utils/estate-vault";

export default function EstateVaultScreen() {
  const colors = useColors();
  const [documents, setDocuments] = useState<EstateDocument[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [showAddDocumentModal, setShowAddDocumentModal] = useState(false);
  const [showAddBeneficiaryModal, setShowAddBeneficiaryModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<EstateDocument | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [documentForm, setDocumentForm] = useState<Partial<EstateDocument>>({
    type: "will",
    sharedWith: [],
    beneficiaries: [],
    notificationSent: false,
  });

  const [beneficiaryForm, setBeneficiaryForm] = useState<Partial<Beneficiary>>({
    documentIds: [],
    notified: false,
  });

  const [shareEmail, setShareEmail] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      await cleanupExpiredAccess();
      const loadedDocuments = await loadEstateDocuments();
      setDocuments(loadedDocuments);

      const loadedBeneficiaries = await loadBeneficiaries();
      setBeneficiaries(loadedBeneficiaries);
    } catch (error) {
      console.error("Failed to load estate vault data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handlePickDocument() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setDocumentForm({
          ...documentForm,
          fileUri: file.uri,
          name: documentForm.name || file.name,
        });
      }
    } catch (error) {
      console.error("Failed to pick document:", error);
    }
  }

  async function handleAddDocument() {
    try {
      if (Platform.OS !== "web") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      if (!documentForm.name || !documentForm.fileUri) {
        Alert.alert("Error", "Please provide document name and file");
        return;
      }

      const newDocument: EstateDocument = {
        id: Date.now().toString(),
        type: documentForm.type || "will",
        name: documentForm.name,
        description: documentForm.description || "",
        fileUri: documentForm.fileUri,
        uploadDate: Date.now(),
        lastModified: Date.now(),
        sharedWith: [],
        beneficiaries: [],
        notificationSent: false,
      };

      await saveEstateDocument(newDocument);
      await loadData();
      setShowAddDocumentModal(false);
      resetDocumentForm();
    } catch (error) {
      console.error("Failed to add document:", error);
      Alert.alert("Error", "Failed to add document");
    }
  }

  async function handleAddBeneficiary() {
    try {
      if (Platform.OS !== "web") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      if (!beneficiaryForm.name || !beneficiaryForm.email) {
        Alert.alert("Error", "Please provide beneficiary name and email");
        return;
      }

      const newBeneficiary: Beneficiary = {
        id: Date.now().toString(),
        name: beneficiaryForm.name,
        email: beneficiaryForm.email,
        phone: beneficiaryForm.phone || "",
        relationship: beneficiaryForm.relationship || "",
        percentage: beneficiaryForm.percentage || 0,
        documentIds: [],
        notified: false,
      };

      await saveBeneficiary(newBeneficiary);
      await loadData();
      setShowAddBeneficiaryModal(false);
      resetBeneficiaryForm();
    } catch (error) {
      console.error("Failed to add beneficiary:", error);
      Alert.alert("Error", "Failed to add beneficiary");
    }
  }

  async function handleShareDocument() {
    try {
      if (!selectedDocument || !shareEmail) {
        Alert.alert("Error", "Please provide email address");
        return;
      }

      if (Platform.OS !== "web") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      await shareDocument(selectedDocument.id, shareEmail, "view");
      await loadData();
      setShowShareModal(false);
      setShareEmail("");
      setSelectedDocument(null);
      Alert.alert("Success", `Document shared with ${shareEmail}`);
    } catch (error) {
      console.error("Failed to share document:", error);
      Alert.alert("Error", "Failed to share document");
    }
  }

  async function handleNotifyBeneficiaries(documentId: string) {
    try {
      if (Platform.OS !== "web") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      await notifyBeneficiaries(documentId);
      await loadData();
      Alert.alert("Success", "Beneficiaries have been notified");
    } catch (error) {
      console.error("Failed to notify beneficiaries:", error);
      Alert.alert("Error", "Failed to notify beneficiaries");
    }
  }

  async function handleDeleteDocument(documentId: string) {
    try {
      if (Platform.OS !== "web") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }

      Alert.alert("Delete Document", "Are you sure you want to delete this document?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteEstateDocument(documentId);
            await loadData();
          },
        },
      ]);
    } catch (error) {
      console.error("Failed to delete document:", error);
    }
  }

  async function handleDeleteBeneficiary(beneficiaryId: string) {
    try {
      if (Platform.OS !== "web") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }

      Alert.alert("Delete Beneficiary", "Are you sure you want to delete this beneficiary?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteBeneficiary(beneficiaryId);
            await loadData();
          },
        },
      ]);
    } catch (error) {
      console.error("Failed to delete beneficiary:", error);
    }
  }

  async function handleGenerateReport() {
    try {
      if (Platform.OS !== "web") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      const report = await generateEstateReport();
      
      // In a real app, you'd save this to a file and share it
      Alert.alert("Estate Report", report.substring(0, 500) + "...");
    } catch (error) {
      console.error("Failed to generate report:", error);
      Alert.alert("Error", "Failed to generate report");
    }
  }

  function resetDocumentForm() {
    setDocumentForm({
      type: "will",
      sharedWith: [],
      beneficiaries: [],
      notificationSent: false,
    });
  }

  function resetBeneficiaryForm() {
    setBeneficiaryForm({
      documentIds: [],
      notified: false,
    });
  }

  if (loading) {
    return (
      <ScreenContainer className="p-6 items-center justify-center">
        <Text className="text-lg text-foreground">Loading estate vault...</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-6">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="gap-6">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">Estate Planning Vault</Text>
            <Text className="text-sm text-muted">Secure storage for important documents</Text>
          </View>

          {/* Summary Cards */}
          <View className="flex-row gap-3">
            <View className="flex-1 bg-primary rounded-2xl p-4">
              <Text className="text-sm text-white opacity-80 mb-1">Documents</Text>
              <Text className="text-3xl font-bold text-white">{documents.length}</Text>
            </View>
            <View className="flex-1 bg-success rounded-2xl p-4">
              <Text className="text-sm text-white opacity-80 mb-1">Beneficiaries</Text>
              <Text className="text-3xl font-bold text-white">{beneficiaries.length}</Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={() => setShowAddDocumentModal(true)}
              className="flex-1 bg-primary rounded-xl p-4 items-center"
              style={{ opacity: 0.9 }}
            >
              <Text className="text-white font-semibold">Add Document</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowAddBeneficiaryModal(true)}
              className="flex-1 bg-success rounded-xl p-4 items-center"
              style={{ opacity: 0.9 }}
            >
              <Text className="text-white font-semibold">Add Beneficiary</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={handleGenerateReport}
            className="bg-surface rounded-xl p-4 items-center border border-border"
          >
            <Text className="text-foreground font-semibold">Generate Estate Report</Text>
          </TouchableOpacity>

          {/* Documents List */}
          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">Documents</Text>
            {documents.length === 0 ? (
              <View className="bg-surface rounded-2xl p-6 items-center border border-border">
                <Text className="text-muted text-center">No documents yet</Text>
              </View>
            ) : (
              documents.map((document) => (
                <View
                  key={document.id}
                  className="bg-surface rounded-2xl p-4 border border-border"
                >
                  <View className="flex-row items-start justify-between mb-3">
                    <View className="flex-row items-center gap-2 flex-1">
                      <Text className="text-2xl">{getDocumentTypeIcon(document.type)}</Text>
                      <View className="flex-1">
                        <Text className="text-base font-semibold text-foreground">
                          {document.name}
                        </Text>
                        <Text className="text-xs text-muted">
                          {getDocumentTypeLabel(document.type)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {document.description && (
                    <Text className="text-sm text-muted mb-3">{document.description}</Text>
                  )}

                  <View className="gap-1 mb-3">
                    <View className="flex-row justify-between">
                      <Text className="text-sm text-muted">Uploaded</Text>
                      <Text className="text-sm font-medium text-foreground">
                        {new Date(document.uploadDate).toLocaleDateString()}
                      </Text>
                    </View>
                    <View className="flex-row justify-between">
                      <Text className="text-sm text-muted">Shared With</Text>
                      <Text className="text-sm font-medium text-foreground">
                        {document.sharedWith.length} people
                      </Text>
                    </View>
                    <View className="flex-row justify-between">
                      <Text className="text-sm text-muted">Beneficiaries</Text>
                      <Text className="text-sm font-medium text-foreground">
                        {document.beneficiaries.length}
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row gap-2">
                    <TouchableOpacity
                      onPress={() => {
                        setSelectedDocument(document);
                        setShowShareModal(true);
                      }}
                      className="flex-1 bg-primary rounded-lg p-2 items-center"
                      style={{ opacity: 0.9 }}
                    >
                      <Text className="text-white text-xs font-medium">Share</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleNotifyBeneficiaries(document.id)}
                      className="flex-1 bg-success rounded-lg p-2 items-center"
                      style={{ opacity: 0.9 }}
                      disabled={document.notificationSent}
                    >
                      <Text className="text-white text-xs font-medium">
                        {document.notificationSent ? "Notified" : "Notify"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeleteDocument(document.id)}
                      className="flex-1 bg-error rounded-lg p-2 items-center"
                      style={{ opacity: 0.8 }}
                    >
                      <Text className="text-white text-xs font-medium">Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* Beneficiaries List */}
          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">Beneficiaries</Text>
            {beneficiaries.length === 0 ? (
              <View className="bg-surface rounded-2xl p-6 items-center border border-border">
                <Text className="text-muted text-center">No beneficiaries yet</Text>
              </View>
            ) : (
              beneficiaries.map((beneficiary) => (
                <View
                  key={beneficiary.id}
                  className="bg-surface rounded-2xl p-4 border border-border"
                >
                  <View className="flex-row items-start justify-between mb-2">
                    <View>
                      <Text className="text-base font-semibold text-foreground">
                        {beneficiary.name}
                      </Text>
                      <Text className="text-xs text-muted">{beneficiary.relationship}</Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-lg font-bold text-primary">
                        {beneficiary.percentage}%
                      </Text>
                      {beneficiary.notified && (
                        <Text className="text-xs text-success">✓ Notified</Text>
                      )}
                    </View>
                  </View>

                  <View className="gap-1 mb-3">
                    <Text className="text-sm text-muted">Email: {beneficiary.email}</Text>
                    {beneficiary.phone && (
                      <Text className="text-sm text-muted">Phone: {beneficiary.phone}</Text>
                    )}
                    <Text className="text-sm text-muted">
                      Documents: {beneficiary.documentIds.length}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => handleDeleteBeneficiary(beneficiary.id)}
                    className="bg-error rounded-lg p-2 items-center"
                    style={{ opacity: 0.8 }}
                  >
                    <Text className="text-white text-xs font-medium">Delete</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>

      {/* Add Document Modal */}
      <Modal visible={showAddDocumentModal} animationType="slide" transparent>
        <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <View className="bg-background rounded-t-3xl p-6" style={{ maxHeight: "80%" }}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="gap-4">
                <Text className="text-2xl font-bold text-foreground">Add Document</Text>

                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Document Type</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {(["will", "trust", "power_of_attorney", "healthcare_directive"] as const).map(
                      (type) => (
                        <TouchableOpacity
                          key={type}
                          onPress={() => setDocumentForm({ ...documentForm, type })}
                          className="px-4 py-2 rounded-full border"
                          style={{
                            backgroundColor:
                              documentForm.type === type ? colors.primary : colors.surface,
                            borderColor:
                              documentForm.type === type ? colors.primary : colors.border,
                          }}
                        >
                          <Text
                            className="text-xs font-medium"
                            style={{
                              color: documentForm.type === type ? "#FFFFFF" : colors.foreground,
                            }}
                          >
                            {getDocumentTypeLabel(type)}
                          </Text>
                        </TouchableOpacity>
                      )
                    )}
                  </View>
                </View>

                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Document Name</Text>
                  <TextInput
                    value={documentForm.name}
                    onChangeText={(text) => setDocumentForm({ ...documentForm, name: text })}
                    placeholder="My Last Will"
                    placeholderTextColor={colors.muted}
                    className="bg-surface border border-border rounded-xl p-4 text-foreground"
                  />
                </View>

                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Description</Text>
                  <TextInput
                    value={documentForm.description}
                    onChangeText={(text) =>
                      setDocumentForm({ ...documentForm, description: text })
                    }
                    placeholder="Optional description"
                    placeholderTextColor={colors.muted}
                    multiline
                    numberOfLines={3}
                    className="bg-surface border border-border rounded-xl p-4 text-foreground"
                  />
                </View>

                <TouchableOpacity
                  onPress={handlePickDocument}
                  className="bg-surface border border-border rounded-xl p-4 items-center"
                >
                  <Text className="text-foreground font-medium">
                    {documentForm.fileUri ? "✓ Document Selected" : "Pick Document"}
                  </Text>
                </TouchableOpacity>

                <View className="flex-row gap-3 mt-4">
                  <TouchableOpacity
                    onPress={() => {
                      setShowAddDocumentModal(false);
                      resetDocumentForm();
                    }}
                    className="flex-1 bg-surface rounded-xl p-4 items-center border border-border"
                  >
                    <Text className="text-foreground font-semibold">Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleAddDocument}
                    className="flex-1 bg-primary rounded-xl p-4 items-center"
                  >
                    <Text className="text-white font-semibold">Add</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Add Beneficiary Modal */}
      <Modal visible={showAddBeneficiaryModal} animationType="slide" transparent>
        <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <View className="bg-background rounded-t-3xl p-6" style={{ maxHeight: "80%" }}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="gap-4">
                <Text className="text-2xl font-bold text-foreground">Add Beneficiary</Text>

                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Name</Text>
                  <TextInput
                    value={beneficiaryForm.name}
                    onChangeText={(text) => setBeneficiaryForm({ ...beneficiaryForm, name: text })}
                    placeholder="John Doe"
                    placeholderTextColor={colors.muted}
                    className="bg-surface border border-border rounded-xl p-4 text-foreground"
                  />
                </View>

                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Email</Text>
                  <TextInput
                    value={beneficiaryForm.email}
                    onChangeText={(text) =>
                      setBeneficiaryForm({ ...beneficiaryForm, email: text })
                    }
                    placeholder="john@example.com"
                    keyboardType="email-address"
                    placeholderTextColor={colors.muted}
                    className="bg-surface border border-border rounded-xl p-4 text-foreground"
                  />
                </View>

                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Phone</Text>
                  <TextInput
                    value={beneficiaryForm.phone}
                    onChangeText={(text) =>
                      setBeneficiaryForm({ ...beneficiaryForm, phone: text })
                    }
                    placeholder="+1234567890"
                    keyboardType="phone-pad"
                    placeholderTextColor={colors.muted}
                    className="bg-surface border border-border rounded-xl p-4 text-foreground"
                  />
                </View>

                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Relationship</Text>
                  <TextInput
                    value={beneficiaryForm.relationship}
                    onChangeText={(text) =>
                      setBeneficiaryForm({ ...beneficiaryForm, relationship: text })
                    }
                    placeholder="Spouse, Child, etc."
                    placeholderTextColor={colors.muted}
                    className="bg-surface border border-border rounded-xl p-4 text-foreground"
                  />
                </View>

                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Estate Share (%)</Text>
                  <TextInput
                    value={beneficiaryForm.percentage?.toString()}
                    onChangeText={(text) =>
                      setBeneficiaryForm({ ...beneficiaryForm, percentage: parseFloat(text) || 0 })
                    }
                    placeholder="25"
                    keyboardType="numeric"
                    placeholderTextColor={colors.muted}
                    className="bg-surface border border-border rounded-xl p-4 text-foreground"
                  />
                </View>

                <View className="flex-row gap-3 mt-4">
                  <TouchableOpacity
                    onPress={() => {
                      setShowAddBeneficiaryModal(false);
                      resetBeneficiaryForm();
                    }}
                    className="flex-1 bg-surface rounded-xl p-4 items-center border border-border"
                  >
                    <Text className="text-foreground font-semibold">Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleAddBeneficiary}
                    className="flex-1 bg-success rounded-xl p-4 items-center"
                  >
                    <Text className="text-white font-semibold">Add</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Share Document Modal */}
      <Modal visible={showShareModal} animationType="slide" transparent>
        <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <View className="bg-background rounded-t-3xl p-6">
            <View className="gap-4">
              <Text className="text-2xl font-bold text-foreground">Share Document</Text>

              {selectedDocument && (
                <Text className="text-sm text-muted">
                  Sharing: {selectedDocument.name}
                </Text>
              )}

              <View className="gap-2">
                <Text className="text-sm font-medium text-foreground">Email Address</Text>
                <TextInput
                  value={shareEmail}
                  onChangeText={setShareEmail}
                  placeholder="recipient@example.com"
                  keyboardType="email-address"
                  placeholderTextColor={colors.muted}
                  className="bg-surface border border-border rounded-xl p-4 text-foreground"
                />
              </View>

              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={() => {
                    setShowShareModal(false);
                    setShareEmail("");
                    setSelectedDocument(null);
                  }}
                  className="flex-1 bg-surface rounded-xl p-4 items-center border border-border"
                >
                  <Text className="text-foreground font-semibold">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleShareDocument}
                  className="flex-1 bg-primary rounded-xl p-4 items-center"
                >
                  <Text className="text-white font-semibold">Share</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
