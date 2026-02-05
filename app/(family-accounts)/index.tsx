import { ScrollView, Text, View, Pressable, Alert, TextInput, ActivityIndicator } from "react-native";
import { useState, useEffect } from "react";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import {
  loadFamilyAccounts,
  createFamilyAccount,
  inviteMember,
  removeMember,
  changeMemberRole,
  createSharedBudget,
  getRolePermissions,
  loadPendingApprovals,
  processApprovalRequest,
  type FamilyAccount,
  type FamilyRole,
  type PendingApproval,
} from "@/utils/family-accounts";

export default function FamilyAccountsScreen() {
  const colors = useColors();
  const [accounts, setAccounts] = useState<FamilyAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<FamilyAccount | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [newAccountName, setNewAccountName] = useState("");
  const [inviteForm, setInviteForm] = useState({
    name: "",
    email: "",
    phone: "",
    role: "viewer" as FamilyRole,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const accts = await loadFamilyAccounts();
      setAccounts(accts);

      if (accts.length > 0 && !selectedAccount) {
        setSelectedAccount(accts[0]);
      }

      const approvals = await loadPendingApprovals();
      setPendingApprovals(approvals.filter((a) => a.status === "pending"));
    } catch (error) {
      console.error("Failed to load family accounts:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAccount = async () => {
    if (!newAccountName.trim()) {
      Alert.alert("Error", "Please enter an account name");
      return;
    }

    try {
      const newAccount = await createFamilyAccount(
        newAccountName,
        "Current User",
        "user@example.com"
      );

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowCreateForm(false);
      setNewAccountName("");
      await loadData();
      setSelectedAccount(newAccount);
    } catch (error: any) {
      Alert.alert("Error", "Failed to create family account");
    }
  };

  const handleInviteMember = async () => {
    if (!selectedAccount) return;

    if (!inviteForm.name || !inviteForm.email) {
      Alert.alert("Error", "Please fill in all required fields");
      return;
    }

    try {
      await inviteMember(
        selectedAccount.id,
        selectedAccount.ownerId,
        inviteForm.name,
        inviteForm.email,
        inviteForm.phone || undefined,
        inviteForm.role
      );

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowInviteForm(false);
      setInviteForm({ name: "", email: "", phone: "", role: "viewer" });
      await loadData();
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to invite member");
    }
  };

  const handleRemoveMember = (memberId: string, memberName: string) => {
    if (!selectedAccount) return;

    Alert.alert(
      "Remove Member",
      `Are you sure you want to remove ${memberName} from this family account?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await removeMember(selectedAccount.id, memberId, selectedAccount.ownerId);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              await loadData();
            } catch (error: any) {
              Alert.alert("Error", error.message || "Failed to remove member");
            }
          },
        },
      ]
    );
  };

  const handleProcessApproval = async (approvalId: string, approved: boolean) => {
    try {
      await processApprovalRequest(approvalId, approved, "current_user_id");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await loadData();
    } catch (error: any) {
      Alert.alert("Error", "Failed to process approval");
    }
  };

  if (isLoading) {
    return (
      <ScreenContainer className="p-6">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="text-base text-muted mt-4">Loading family accounts...</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-6">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="gap-6">
          {/* Header */}
          <View>
            <Text className="text-2xl font-bold text-foreground mb-2">
              Family Accounts
            </Text>
            <Text className="text-sm text-muted">
              Manage shared budgets and family members
            </Text>
          </View>

          {/* Pending Approvals */}
          {pendingApprovals.length > 0 && (
            <View
              style={{ backgroundColor: colors.warning + "20" }}
              className="rounded-2xl p-5"
            >
              <View className="flex-row items-center gap-2 mb-4">
                <Text className="text-xl">⏳</Text>
                <Text className="text-lg font-bold text-foreground">
                  Pending Approvals ({pendingApprovals.length})
                </Text>
              </View>

              {pendingApprovals.map((approval) => (
                <View
                  key={approval.id}
                  style={{ backgroundColor: colors.surface }}
                  className="rounded-xl p-4 mb-3"
                >
                  <Text className="text-sm font-semibold text-foreground mb-2">
                    {approval.requestedByName}
                  </Text>
                  <Text className="text-sm text-muted mb-3">
                    {approval.description}
                  </Text>

                  {approval.amount && (
                    <Text className="text-base font-bold text-foreground mb-3">
                      ${approval.amount.toFixed(2)}
                    </Text>
                  )}

                  <View className="flex-row gap-3">
                    <Pressable
                      onPress={() => handleProcessApproval(approval.id, false)}
                      style={({ pressed }) => [
                        {
                          backgroundColor: colors.error,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}
                      className="flex-1 rounded-xl px-4 py-3"
                    >
                      <Text
                        style={{ color: colors.background }}
                        className="text-center font-semibold"
                      >
                        Reject
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => handleProcessApproval(approval.id, true)}
                      style={({ pressed }) => [
                        {
                          backgroundColor: colors.success,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}
                      className="flex-1 rounded-xl px-4 py-3"
                    >
                      <Text
                        style={{ color: colors.background }}
                        className="text-center font-semibold"
                      >
                        Approve
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Account Selection */}
          {accounts.length > 0 && (
            <View>
              <Text className="text-base font-semibold text-foreground mb-3">
                Select Account
              </Text>

              {accounts.map((account) => (
                <Pressable
                  key={account.id}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedAccount(account);
                  }}
                  style={({ pressed }) => [
                    {
                      backgroundColor:
                        selectedAccount?.id === account.id
                          ? colors.primary + "20"
                          : colors.surface,
                      borderWidth: 2,
                      borderColor:
                        selectedAccount?.id === account.id
                          ? colors.primary
                          : "transparent",
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                  className="rounded-2xl p-4 mb-3"
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                      <Text className="text-base font-bold text-foreground">
                        {account.name}
                      </Text>
                      <Text className="text-sm text-muted mt-1">
                        {account.members.length} members · {account.sharedBudgets.length}{" "}
                        budgets
                      </Text>
                    </View>
                    {selectedAccount?.id === account.id && (
                      <Text className="text-xl">✓</Text>
                    )}
                  </View>
                </Pressable>
              ))}
            </View>
          )}

          {/* Selected Account Details */}
          {selectedAccount && (
            <>
              {/* Members List */}
              <View>
                <View className="flex-row items-center justify-between mb-4">
                  <Text className="text-lg font-bold text-foreground">Members</Text>

                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      setShowInviteForm(true);
                    }}
                    style={({ pressed }) => [
                      {
                        backgroundColor: colors.primary,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                    className="rounded-full px-4 py-2"
                  >
                    <Text
                      style={{ color: colors.background }}
                      className="font-semibold text-sm"
                    >
                      + Invite
                    </Text>
                  </Pressable>
                </View>

                {selectedAccount.members.map((member) => {
                  const permissions = getRolePermissions(member.role);

                  return (
                    <Pressable
                      key={member.id}
                      onLongPress={() =>
                        member.role !== "owner" &&
                        handleRemoveMember(member.id, member.name)
                      }
                      style={({ pressed }) => [
                        {
                          backgroundColor: colors.surface,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}
                      className="rounded-2xl p-5 mb-3"
                    >
                      <View className="flex-row items-start justify-between mb-3">
                        <View className="flex-1">
                          <Text className="text-base font-bold text-foreground mb-1">
                            {member.name}
                          </Text>
                          <Text className="text-sm text-muted">{member.email}</Text>
                        </View>

                        <View
                          style={{
                            backgroundColor:
                              member.role === "owner"
                                ? colors.primary + "20"
                                : member.role === "admin"
                                ? colors.success + "20"
                                : colors.muted + "20",
                          }}
                          className="rounded-full px-3 py-1"
                        >
                          <Text
                            style={{
                              color:
                                member.role === "owner"
                                  ? colors.primary
                                  : member.role === "admin"
                                  ? colors.success
                                  : colors.muted,
                            }}
                            className="text-xs font-bold uppercase"
                          >
                            {member.role}
                          </Text>
                        </View>
                      </View>

                      <View
                        style={{ backgroundColor: colors.background }}
                        className="rounded-xl p-3"
                      >
                        <Text className="text-xs text-muted mb-2">Permissions</Text>
                        <View className="flex-row flex-wrap gap-2">
                          {permissions.canMakeTransactions && (
                            <View
                              style={{ backgroundColor: colors.success + "20" }}
                              className="rounded-full px-2 py-1"
                            >
                              <Text
                                style={{ color: colors.success }}
                                className="text-xs"
                              >
                                Transactions
                              </Text>
                            </View>
                          )}
                          {permissions.canCreateBudgets && (
                            <View
                              style={{ backgroundColor: colors.primary + "20" }}
                              className="rounded-full px-2 py-1"
                            >
                              <Text
                                style={{ color: colors.primary }}
                                className="text-xs"
                              >
                                Budgets
                              </Text>
                            </View>
                          )}
                          {permissions.canInviteMembers && (
                            <View
                              style={{ backgroundColor: colors.warning + "20" }}
                              className="rounded-full px-2 py-1"
                            >
                              <Text
                                style={{ color: colors.warning }}
                                className="text-xs"
                              >
                                Invite
                              </Text>
                            </View>
                          )}
                          {!permissions.canMakeTransactions &&
                            !permissions.canCreateBudgets &&
                            !permissions.canInviteMembers && (
                              <Text className="text-xs text-muted">View only</Text>
                            )}
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              {/* Activity Log */}
              {selectedAccount.activityLog.length > 0 && (
                <View>
                  <Text className="text-lg font-bold text-foreground mb-4">
                    Recent Activity
                  </Text>

                  {selectedAccount.activityLog.slice(0, 5).map((log) => (
                    <View
                      key={log.id}
                      style={{ backgroundColor: colors.surface }}
                      className="rounded-xl p-4 mb-3"
                    >
                      <View className="flex-row items-start justify-between">
                        <View className="flex-1">
                          <Text className="text-sm font-semibold text-foreground">
                            {log.memberName}
                          </Text>
                          <Text className="text-sm text-muted mt-1">{log.details}</Text>
                        </View>

                        <Text className="text-xs text-muted">
                          {new Date(log.timestamp).toLocaleDateString()}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}

          {/* Invite Form */}
          {showInviteForm && (
            <View
              style={{ backgroundColor: colors.surface }}
              className="rounded-2xl p-5"
            >
              <Text className="text-lg font-bold text-foreground mb-4">
                Invite Member
              </Text>

              <View className="gap-4">
                <View>
                  <Text className="text-sm text-muted mb-2">Name *</Text>
                  <TextInput
                    value={inviteForm.name}
                    onChangeText={(text) =>
                      setInviteForm({ ...inviteForm, name: text })
                    }
                    placeholder="Enter member name"
                    placeholderTextColor={colors.muted}
                    style={{
                      backgroundColor: colors.background,
                      color: colors.foreground,
                    }}
                    className="rounded-xl px-4 py-3 text-base"
                  />
                </View>

                <View>
                  <Text className="text-sm text-muted mb-2">Email *</Text>
                  <TextInput
                    value={inviteForm.email}
                    onChangeText={(text) =>
                      setInviteForm({ ...inviteForm, email: text })
                    }
                    placeholder="Enter email address"
                    placeholderTextColor={colors.muted}
                    keyboardType="email-address"
                    style={{
                      backgroundColor: colors.background,
                      color: colors.foreground,
                    }}
                    className="rounded-xl px-4 py-3 text-base"
                  />
                </View>

                <View>
                  <Text className="text-sm text-muted mb-2">Phone (Optional)</Text>
                  <TextInput
                    value={inviteForm.phone}
                    onChangeText={(text) =>
                      setInviteForm({ ...inviteForm, phone: text })
                    }
                    placeholder="Enter phone number"
                    placeholderTextColor={colors.muted}
                    keyboardType="phone-pad"
                    style={{
                      backgroundColor: colors.background,
                      color: colors.foreground,
                    }}
                    className="rounded-xl px-4 py-3 text-base"
                  />
                </View>

                <View>
                  <Text className="text-sm text-muted mb-2">Role *</Text>
                  <View className="flex-row gap-3">
                    {(["viewer", "admin"] as FamilyRole[]).map((role) => (
                      <Pressable
                        key={role}
                        onPress={() => setInviteForm({ ...inviteForm, role })}
                        style={{
                          backgroundColor:
                            inviteForm.role === role
                              ? colors.primary
                              : colors.background,
                        }}
                        className="flex-1 rounded-xl px-4 py-3"
                      >
                        <Text
                          style={{
                            color:
                              inviteForm.role === role
                                ? colors.background
                                : colors.foreground,
                          }}
                          className="text-center font-semibold capitalize"
                        >
                          {role}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View className="flex-row gap-3">
                  <Pressable
                    onPress={() => setShowInviteForm(false)}
                    style={({ pressed }) => [
                      {
                        backgroundColor: colors.background,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                    className="flex-1 rounded-xl px-4 py-3"
                  >
                    <Text
                      style={{ color: colors.foreground }}
                      className="text-center font-semibold"
                    >
                      Cancel
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={handleInviteMember}
                    style={({ pressed }) => [
                      {
                        backgroundColor: colors.primary,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                    className="flex-1 rounded-xl px-4 py-3"
                  >
                    <Text
                      style={{ color: colors.background }}
                      className="text-center font-semibold"
                    >
                      Send Invite
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}

          {/* Create Account Form */}
          {accounts.length === 0 || showCreateForm ? (
            <View
              style={{ backgroundColor: colors.surface }}
              className="rounded-2xl p-5"
            >
              <Text className="text-lg font-bold text-foreground mb-4">
                Create Family Account
              </Text>

              <View className="gap-4">
                <View>
                  <Text className="text-sm text-muted mb-2">Account Name *</Text>
                  <TextInput
                    value={newAccountName}
                    onChangeText={setNewAccountName}
                    placeholder="e.g., Smith Family"
                    placeholderTextColor={colors.muted}
                    style={{
                      backgroundColor: colors.background,
                      color: colors.foreground,
                    }}
                    className="rounded-xl px-4 py-3 text-base"
                  />
                </View>

                <View className="flex-row gap-3">
                  {accounts.length > 0 && (
                    <Pressable
                      onPress={() => setShowCreateForm(false)}
                      style={({ pressed }) => [
                        {
                          backgroundColor: colors.background,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}
                      className="flex-1 rounded-xl px-4 py-3"
                    >
                      <Text
                        style={{ color: colors.foreground }}
                        className="text-center font-semibold"
                      >
                        Cancel
                      </Text>
                    </Pressable>
                  )}

                  <Pressable
                    onPress={handleCreateAccount}
                    style={({ pressed }) => [
                      {
                        backgroundColor: colors.primary,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                    className="flex-1 rounded-xl px-4 py-3"
                  >
                    <Text
                      style={{ color: colors.background }}
                      className="text-center font-semibold"
                    >
                      Create Account
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setShowCreateForm(true);
              }}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              className="rounded-xl px-6 py-4"
            >
              <Text
                style={{ color: colors.background }}
                className="text-center font-bold text-base"
              >
                + Create Another Family Account
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
