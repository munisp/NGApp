import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SMS from "expo-sms";
import * as MailComposer from "expo-mail-composer";

export type FamilyRole = "owner" | "admin" | "viewer";

export interface FamilyMember {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: FamilyRole;
  joinedAt: number;
  invitedBy: string;
  status: "active" | "pending" | "suspended";
}

export interface FamilyAccount {
  id: string;
  name: string;
  createdAt: number;
  ownerId: string;
  members: FamilyMember[];
  sharedBudgets: SharedBudget[];
  activityLog: ActivityLogEntry[];
}

export interface SharedBudget {
  id: string;
  category: string;
  limit: number;
  period: "daily" | "weekly" | "monthly";
  spent: number;
  createdBy: string;
  createdAt: number;
}

export interface ActivityLogEntry {
  id: string;
  memberId: string;
  memberName: string;
  action: string;
  details: string;
  timestamp: number;
  type: "transaction" | "budget" | "member" | "settings";
}

export interface PendingApproval {
  id: string;
  type: "transaction" | "budget_change";
  requestedBy: string;
  requestedByName: string;
  amount?: number;
  description: string;
  timestamp: number;
  status: "pending" | "approved" | "rejected";
  approvedBy?: string;
}

const STORAGE_KEY = "family_accounts";
const APPROVALS_KEY = "pending_approvals";

// Role permissions matrix
const PERMISSIONS = {
  owner: {
    canInviteMembers: true,
    canRemoveMembers: true,
    canChangeRoles: true,
    canCreateBudgets: true,
    canEditBudgets: true,
    canDeleteBudgets: true,
    canMakeTransactions: true,
    canViewTransactions: true,
    canApproveTransactions: true,
    canChangeSettings: true,
  },
  admin: {
    canInviteMembers: true,
    canRemoveMembers: false,
    canChangeRoles: false,
    canCreateBudgets: true,
    canEditBudgets: true,
    canDeleteBudgets: false,
    canMakeTransactions: true,
    canViewTransactions: true,
    canApproveTransactions: true,
    canChangeSettings: false,
  },
  viewer: {
    canInviteMembers: false,
    canRemoveMembers: false,
    canChangeRoles: false,
    canCreateBudgets: false,
    canEditBudgets: false,
    canDeleteBudgets: false,
    canMakeTransactions: false,
    canViewTransactions: true,
    canApproveTransactions: false,
    canChangeSettings: false,
  },
};

/**
 * Get permissions for a role
 */
export function getRolePermissions(role: FamilyRole) {
  return PERMISSIONS[role];
}

/**
 * Load all family accounts
 */
export async function loadFamilyAccounts(): Promise<FamilyAccount[]> {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    return json ? JSON.parse(json) : [];
  } catch (error) {
    console.error("Failed to load family accounts:", error);
    return [];
  }
}

/**
 * Save family accounts
 */
export async function saveFamilyAccounts(accounts: FamilyAccount[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
  } catch (error) {
    console.error("Failed to save family accounts:", error);
    throw error;
  }
}

/**
 * Create new family account
 */
export async function createFamilyAccount(
  name: string,
  ownerName: string,
  ownerEmail: string
): Promise<FamilyAccount> {
  const accounts = await loadFamilyAccounts();

  const ownerId = Date.now().toString();

  const newAccount: FamilyAccount = {
    id: ownerId,
    name,
    createdAt: Date.now(),
    ownerId,
    members: [
      {
        id: ownerId,
        name: ownerName,
        email: ownerEmail,
        role: "owner",
        joinedAt: Date.now(),
        invitedBy: "self",
        status: "active",
      },
    ],
    sharedBudgets: [],
    activityLog: [
      {
        id: Date.now().toString(),
        memberId: ownerId,
        memberName: ownerName,
        action: "created_account",
        details: `Created family account "${name}"`,
        timestamp: Date.now(),
        type: "settings",
      },
    ],
  };

  accounts.push(newAccount);
  await saveFamilyAccounts(accounts);

  return newAccount;
}

/**
 * Get family account by ID
 */
export async function getFamilyAccount(accountId: string): Promise<FamilyAccount | null> {
  const accounts = await loadFamilyAccounts();
  return accounts.find((a) => a.id === accountId) || null;
}

/**
 * Invite member to family account
 */
export async function inviteMember(
  accountId: string,
  invitedBy: string,
  memberName: string,
  memberEmail: string,
  memberPhone: string | undefined,
  role: FamilyRole
): Promise<void> {
  const accounts = await loadFamilyAccounts();
  const account = accounts.find((a) => a.id === accountId);

  if (!account) {
    throw new Error("Family account not found");
  }

  // Check if member already exists
  if (account.members.some((m) => m.email === memberEmail)) {
    throw new Error("Member already exists in this family account");
  }

  const newMember: FamilyMember = {
    id: Date.now().toString(),
    name: memberName,
    email: memberEmail,
    phone: memberPhone,
    role,
    joinedAt: Date.now(),
    invitedBy,
    status: "pending",
  };

  account.members.push(newMember);

  // Add activity log
  const inviter = account.members.find((m) => m.id === invitedBy);
  account.activityLog.push({
    id: Date.now().toString(),
    memberId: invitedBy,
    memberName: inviter?.name || "Unknown",
    action: "invited_member",
    details: `Invited ${memberName} as ${role}`,
    timestamp: Date.now(),
    type: "member",
  });

  await saveFamilyAccounts(accounts);

  // Send invitation
  await sendInvitation(account.name, memberName, memberEmail, memberPhone);
}

/**
 * Send invitation via SMS or email
 */
async function sendInvitation(
  accountName: string,
  memberName: string,
  email: string,
  phone?: string
): Promise<void> {
  const message = `Hi ${memberName}! You've been invited to join the "${accountName}" family account. Download the app to accept the invitation.`;

  try {
    // Try SMS first if phone is available
    if (phone) {
      const isAvailable = await SMS.isAvailableAsync();
      if (isAvailable) {
        await SMS.sendSMSAsync([phone], message);
        return;
      }
    }

    // Fall back to email
    const canSendEmail = await MailComposer.isAvailableAsync();
    if (canSendEmail) {
      await MailComposer.composeAsync({
        recipients: [email],
        subject: `Invitation to join ${accountName} family account`,
        body: message,
      });
    }
  } catch (error) {
    console.error("Failed to send invitation:", error);
    // Don't throw - invitation was created, just notification failed
  }
}

/**
 * Remove member from family account
 */
export async function removeMember(
  accountId: string,
  memberId: string,
  removedBy: string
): Promise<void> {
  const accounts = await loadFamilyAccounts();
  const account = accounts.find((a) => a.id === accountId);

  if (!account) {
    throw new Error("Family account not found");
  }

  const memberIndex = account.members.findIndex((m) => m.id === memberId);
  if (memberIndex === -1) {
    throw new Error("Member not found");
  }

  const member = account.members[memberIndex];

  // Cannot remove owner
  if (member.role === "owner") {
    throw new Error("Cannot remove account owner");
  }

  account.members.splice(memberIndex, 1);

  // Add activity log
  const remover = account.members.find((m) => m.id === removedBy);
  account.activityLog.push({
    id: Date.now().toString(),
    memberId: removedBy,
    memberName: remover?.name || "Unknown",
    action: "removed_member",
    details: `Removed ${member.name} from family account`,
    timestamp: Date.now(),
    type: "member",
  });

  await saveFamilyAccounts(accounts);
}

/**
 * Change member role
 */
export async function changeMemberRole(
  accountId: string,
  memberId: string,
  newRole: FamilyRole,
  changedBy: string
): Promise<void> {
  const accounts = await loadFamilyAccounts();
  const account = accounts.find((a) => a.id === accountId);

  if (!account) {
    throw new Error("Family account not found");
  }

  const member = account.members.find((m) => m.id === memberId);
  if (!member) {
    throw new Error("Member not found");
  }

  // Cannot change owner role
  if (member.role === "owner") {
    throw new Error("Cannot change owner role");
  }

  const oldRole = member.role;
  member.role = newRole;

  // Add activity log
  const changer = account.members.find((m) => m.id === changedBy);
  account.activityLog.push({
    id: Date.now().toString(),
    memberId: changedBy,
    memberName: changer?.name || "Unknown",
    action: "changed_role",
    details: `Changed ${member.name}'s role from ${oldRole} to ${newRole}`,
    timestamp: Date.now(),
    type: "member",
  });

  await saveFamilyAccounts(accounts);
}

/**
 * Create shared budget
 */
export async function createSharedBudget(
  accountId: string,
  category: string,
  limit: number,
  period: "daily" | "weekly" | "monthly",
  createdBy: string
): Promise<void> {
  const accounts = await loadFamilyAccounts();
  const account = accounts.find((a) => a.id === accountId);

  if (!account) {
    throw new Error("Family account not found");
  }

  const newBudget: SharedBudget = {
    id: Date.now().toString(),
    category,
    limit,
    period,
    spent: 0,
    createdBy,
    createdAt: Date.now(),
  };

  account.sharedBudgets.push(newBudget);

  // Add activity log
  const creator = account.members.find((m) => m.id === createdBy);
  account.activityLog.push({
    id: Date.now().toString(),
    memberId: createdBy,
    memberName: creator?.name || "Unknown",
    action: "created_budget",
    details: `Created ${period} budget for ${category}: $${limit}`,
    timestamp: Date.now(),
    type: "budget",
  });

  await saveFamilyAccounts(accounts);
}

/**
 * Update shared budget spending
 */
export async function updateBudgetSpending(
  accountId: string,
  budgetId: string,
  amount: number,
  memberId: string
): Promise<void> {
  const accounts = await loadFamilyAccounts();
  const account = accounts.find((a) => a.id === accountId);

  if (!account) {
    throw new Error("Family account not found");
  }

  const budget = account.sharedBudgets.find((b) => b.id === budgetId);
  if (!budget) {
    throw new Error("Budget not found");
  }

  budget.spent += amount;

  // Add activity log
  const member = account.members.find((m) => m.id === memberId);
  account.activityLog.push({
    id: Date.now().toString(),
    memberId,
    memberName: member?.name || "Unknown",
    action: "updated_budget",
    details: `Spent $${amount} on ${budget.category} (${budget.spent}/${budget.limit})`,
    timestamp: Date.now(),
    type: "budget",
  });

  await saveFamilyAccounts(accounts);
}

/**
 * Load pending approvals
 */
export async function loadPendingApprovals(): Promise<PendingApproval[]> {
  try {
    const json = await AsyncStorage.getItem(APPROVALS_KEY);
    return json ? JSON.parse(json) : [];
  } catch (error) {
    console.error("Failed to load pending approvals:", error);
    return [];
  }
}

/**
 * Create approval request
 */
export async function createApprovalRequest(
  type: "transaction" | "budget_change",
  requestedBy: string,
  requestedByName: string,
  description: string,
  amount?: number
): Promise<void> {
  const approvals = await loadPendingApprovals();

  const newApproval: PendingApproval = {
    id: Date.now().toString(),
    type,
    requestedBy,
    requestedByName,
    amount,
    description,
    timestamp: Date.now(),
    status: "pending",
  };

  approvals.push(newApproval);

  try {
    await AsyncStorage.setItem(APPROVALS_KEY, JSON.stringify(approvals));
  } catch (error) {
    console.error("Failed to save approval request:", error);
    throw error;
  }
}

/**
 * Approve or reject request
 */
export async function processApprovalRequest(
  approvalId: string,
  approved: boolean,
  approvedBy: string
): Promise<void> {
  const approvals = await loadPendingApprovals();
  const approval = approvals.find((a) => a.id === approvalId);

  if (!approval) {
    throw new Error("Approval request not found");
  }

  approval.status = approved ? "approved" : "rejected";
  approval.approvedBy = approvedBy;

  try {
    await AsyncStorage.setItem(APPROVALS_KEY, JSON.stringify(approvals));
  } catch (error) {
    console.error("Failed to update approval request:", error);
    throw error;
  }
}
