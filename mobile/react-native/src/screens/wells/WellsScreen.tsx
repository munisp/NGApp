/**
 * WellsScreen — Full CRUD well list for React Native.
 * Features: search, filter by status, pull-to-refresh, navigate to WellDetail.
 * Uses trpc.wells.list and trpc.wells.create.
 */
import React, { useState, useCallback } from "react";
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  TextInput, RefreshControl, ActivityIndicator, Modal, Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { trpc } from "../../api/trpc";
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, SHADOW } from "../../utils/theme";

const STATUS_FILTERS = ["ALL", "PRODUCING", "SHUT_IN", "WORKOVER", "INJECTOR", "ABANDONED"];

export default function WellsScreen() {
  const navigation = useNavigation<any>();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const { data, isLoading, refetch } = trpc.wells.list.useQuery({
    limit: 200,
    status: statusFilter === "ALL" ? undefined : statusFilter as any,
    search: search || undefined,
  });

  const utils = trpc.useUtils();
  const createWell = trpc.wells.create.useMutation({
    onSuccess: () => {
      utils.wells.list.invalidate();
      setShowAddModal(false);
    },
    onError: (err) => Alert.alert("Error", err.message),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const wells = data?.wells ?? [];

  function getStatusColor(status: string): string {
    switch (status) {
      case "PRODUCING": return COLORS.wellProducing;
      case "SHUT_IN": return COLORS.wellShutIn;
      case "WORKOVER": return COLORS.wellWorkover;
      case "INJECTOR": return COLORS.info;
      case "ABANDONED": return COLORS.textMuted;
      default: return COLORS.textSecondary;
    }
  }

  function renderWell({ item }: { item: any }) {
    return (
      <TouchableOpacity
        style={[styles.wellCard, SHADOW.sm]}
        onPress={() => navigation.navigate("WellDetail", { wellId: item.id })}
        activeOpacity={0.7}
      >
        <View style={styles.wellHeader}>
          <View style={styles.wellNameRow}>
            <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
            <Text style={styles.wellName}>{item.name}</Text>
          </View>
          <Text style={[styles.statusBadge, { color: getStatusColor(item.status) }]}>
            {item.status.replace("_", " ")}
          </Text>
        </View>
        <View style={styles.wellMeta}>
          <Text style={styles.metaText}>{item.field} · {item.type}</Text>
          {item.currentOilRate != null && (
            <Text style={styles.metaText}>{item.currentOilRate.toFixed(0)} bbl/d</Text>
          )}
        </View>
        <Icon name="chevron-right" size={18} color={COLORS.textMuted} style={styles.chevron} />
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchBar}>
        <Icon name="magnify" size={18} color={COLORS.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search wells..."
          placeholderTextColor={COLORS.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Icon name="close-circle" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Status filter chips */}
      <FlatList
        horizontal
        data={STATUS_FILTERS}
        keyExtractor={(s) => s}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        renderItem={({ item: status }) => (
          <TouchableOpacity
            style={[styles.filterChip, statusFilter === status && styles.filterChipActive]}
            onPress={() => setStatusFilter(status)}
          >
            <Text style={[styles.filterChipText, statusFilter === status && styles.filterChipTextActive]}>
              {status.replace("_", " ")}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Wells list */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={wells}
          keyExtractor={(w) => w.id}
          renderItem={renderWell}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon name="oil-lamp" size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>No wells found</Text>
            </View>
          }
        />
      )}

      {/* FAB — Add well */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowAddModal(true)}>
        <Icon name="plus" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Add Well Modal */}
      <AddWellModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={(data) => createWell.mutate(data)}
        loading={createWell.isPending}
      />
    </View>
  );
}

interface AddWellModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  loading: boolean;
}

function AddWellModal({ visible, onClose, onSubmit, loading }: AddWellModalProps) {
  const [name, setName] = useState("");
  const [field, setField] = useState("");
  const [type, setType] = useState("PRODUCER");

  function handleSubmit() {
    if (!name.trim()) { Alert.alert("Validation", "Well name is required"); return; }
    onSubmit({ name: name.trim(), field: field.trim() || "Unknown", type, status: "SHUT_IN" });
    setName(""); setField(""); setType("PRODUCER");
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.sheet}>
          <View style={modalStyles.handle} />
          <Text style={modalStyles.title}>Add New Well</Text>

          <Text style={modalStyles.label}>Well Name *</Text>
          <TextInput style={modalStyles.input} value={name} onChangeText={setName} placeholder="e.g. W-042" placeholderTextColor={COLORS.textMuted} />

          <Text style={modalStyles.label}>Field</Text>
          <TextInput style={modalStyles.input} value={field} onChangeText={setField} placeholder="e.g. North Block" placeholderTextColor={COLORS.textMuted} />

          <Text style={modalStyles.label}>Type</Text>
          <View style={modalStyles.typeRow}>
            {["PRODUCER", "INJECTOR", "DISPOSAL"].map((t) => (
              <TouchableOpacity
                key={t}
                style={[modalStyles.typeChip, type === t && modalStyles.typeChipActive]}
                onPress={() => setType(t)}
              >
                <Text style={[modalStyles.typeChipText, type === t && modalStyles.typeChipTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={modalStyles.actions}>
            <TouchableOpacity style={modalStyles.cancelBtn} onPress={onClose}>
              <Text style={modalStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={modalStyles.submitBtn} onPress={handleSubmit} disabled={loading}>
              {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={modalStyles.submitText}>Create Well</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  searchBar: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surface, margin: SPACING.md, borderRadius: BORDER_RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, gap: SPACING.sm },
  searchInput: { flex: 1, color: COLORS.text, fontSize: FONT_SIZE.md },
  filterRow: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm, gap: SPACING.sm },
  filterChip: { paddingHorizontal: SPACING.md, paddingVertical: 6, borderRadius: BORDER_RADIUS.full, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterChipText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  filterChipTextActive: { color: "#fff", fontWeight: "600" },
  listContent: { padding: SPACING.md, gap: SPACING.sm, paddingBottom: 100 },
  wellCard: { backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.lg, padding: SPACING.md },
  wellHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  wellNameRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  wellName: { fontSize: FONT_SIZE.md, fontWeight: "600", color: COLORS.text },
  statusBadge: { fontSize: FONT_SIZE.xs, fontWeight: "600" },
  wellMeta: { flexDirection: "row", justifyContent: "space-between" },
  metaText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  chevron: { position: "absolute", right: SPACING.md, top: "50%" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyContainer: { alignItems: "center", paddingTop: 80, gap: SPACING.md },
  emptyText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.md },
  fab: { position: "absolute", bottom: SPACING.xl, right: SPACING.xl, width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.primary, justifyContent: "center", alignItems: "center", ...SHADOW.md },
});

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: COLORS.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: SPACING.lg, paddingBottom: 40 },
  handle: { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: "center", marginBottom: SPACING.lg },
  title: { fontSize: FONT_SIZE.xl, fontWeight: "700", color: COLORS.text, marginBottom: SPACING.lg },
  label: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginBottom: 4, marginTop: SPACING.sm },
  input: { backgroundColor: COLORS.background, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, color: COLORS.text, fontSize: FONT_SIZE.md, borderWidth: 1, borderColor: COLORS.border },
  typeRow: { flexDirection: "row", gap: SPACING.sm, marginTop: 4 },
  typeChip: { flex: 1, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.md, backgroundColor: COLORS.background, alignItems: "center", borderWidth: 1, borderColor: COLORS.border },
  typeChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeChipText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  typeChipTextActive: { color: "#fff", fontWeight: "600" },
  actions: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.lg },
  cancelBtn: { flex: 1, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, backgroundColor: COLORS.background, alignItems: "center" },
  cancelText: { color: COLORS.textSecondary, fontWeight: "600" },
  submitBtn: { flex: 1, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, backgroundColor: COLORS.primary, alignItems: "center" },
  submitText: { color: "#fff", fontWeight: "700" },
});
