import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";

export interface InsurancePolicy {
  id: string;
  type: "health" | "auto" | "life" | "home" | "travel" | "disability" | "pet";
  provider: string;
  policyNumber: string;
  coverageAmount: number;
  premium: number;
  premiumFrequency: "monthly" | "quarterly" | "semi-annual" | "annual";
  startDate: number;
  renewalDate: number;
  status: "active" | "expiring_soon" | "expired" | "cancelled";
  beneficiaries?: string[];
  documents?: string[];
  notes?: string;
}

export interface InsuranceClaim {
  id: string;
  policyId: string;
  claimNumber: string;
  claimDate: number;
  claimAmount: number;
  status: "pending" | "approved" | "denied" | "paid";
  description: string;
  documents?: string[];
}

const POLICIES_KEY = "insurance_policies";
const CLAIMS_KEY = "insurance_claims";
const REMINDERS_KEY = "insurance_reminders";

/**
 * Save insurance policies
 */
export async function savePolicies(policies: InsurancePolicy[]): Promise<void> {
  try {
    await AsyncStorage.setItem(POLICIES_KEY, JSON.stringify(policies));
  } catch (error) {
    console.error("Failed to save insurance policies:", error);
    throw error;
  }
}

/**
 * Load insurance policies
 */
export async function loadPolicies(): Promise<InsurancePolicy[]> {
  try {
    const data = await AsyncStorage.getItem(POLICIES_KEY);
    return data ? JSON.parse(data) : getMockPolicies();
  } catch (error) {
    console.error("Failed to load insurance policies:", error);
    return getMockPolicies();
  }
}

/**
 * Get mock insurance policies for demonstration
 */
function getMockPolicies(): InsurancePolicy[] {
  const now = Date.now();
  const oneMonth = 30 * 24 * 60 * 60 * 1000;
  const oneYear = 365 * 24 * 60 * 60 * 1000;

  return [
    {
      id: "1",
      type: "health",
      provider: "HealthCare Plus",
      policyNumber: "HCP-2024-001",
      coverageAmount: 500000,
      premium: 350,
      premiumFrequency: "monthly",
      startDate: now - 6 * oneMonth,
      renewalDate: now + 6 * oneMonth,
      status: "active",
      beneficiaries: ["Spouse", "Children"],
    },
    {
      id: "2",
      type: "auto",
      provider: "AutoSafe Insurance",
      policyNumber: "AS-2024-789",
      coverageAmount: 50000,
      premium: 150,
      premiumFrequency: "monthly",
      startDate: now - 3 * oneMonth,
      renewalDate: now + oneMonth,
      status: "expiring_soon",
    },
    {
      id: "3",
      type: "life",
      provider: "LifeSecure",
      policyNumber: "LS-2024-456",
      coverageAmount: 1000000,
      premium: 2000,
      premiumFrequency: "annual",
      startDate: now - oneYear,
      renewalDate: now + 2 * oneMonth,
      status: "active",
      beneficiaries: ["Spouse", "Children", "Parents"],
    },
  ];
}

/**
 * Add or update insurance policy
 */
export async function savePolicy(policy: InsurancePolicy): Promise<void> {
  try {
    const policies = await loadPolicies();
    const index = policies.findIndex((p) => p.id === policy.id);

    if (index >= 0) {
      policies[index] = policy;
    } else {
      policies.push(policy);
    }

    await savePolicies(policies);
    await scheduleRenewalReminder(policy);
  } catch (error) {
    console.error("Failed to save insurance policy:", error);
    throw error;
  }
}

/**
 * Delete insurance policy
 */
export async function deletePolicy(policyId: string): Promise<void> {
  try {
    const policies = await loadPolicies();
    const filtered = policies.filter((p) => p.id !== policyId);
    await savePolicies(filtered);
    await cancelRenewalReminder(policyId);
  } catch (error) {
    console.error("Failed to delete insurance policy:", error);
    throw error;
  }
}

/**
 * Get policy by ID
 */
export async function getPolicyById(policyId: string): Promise<InsurancePolicy | null> {
  try {
    const policies = await loadPolicies();
    return policies.find((p) => p.id === policyId) || null;
  } catch (error) {
    console.error("Failed to get insurance policy:", error);
    return null;
  }
}

/**
 * Get policies by type
 */
export async function getPoliciesByType(type: InsurancePolicy["type"]): Promise<InsurancePolicy[]> {
  try {
    const policies = await loadPolicies();
    return policies.filter((p) => p.type === type);
  } catch (error) {
    console.error("Failed to get policies by type:", error);
    return [];
  }
}

/**
 * Update policy status based on renewal date
 */
export function updatePolicyStatus(policy: InsurancePolicy): InsurancePolicy {
  const now = Date.now();
  const daysUntilRenewal = (policy.renewalDate - now) / (24 * 60 * 60 * 1000);

  if (daysUntilRenewal < 0) {
    policy.status = "expired";
  } else if (daysUntilRenewal <= 30) {
    policy.status = "expiring_soon";
  } else if (policy.status !== "cancelled") {
    policy.status = "active";
  }

  return policy;
}

/**
 * Calculate annual premium
 */
export function calculateAnnualPremium(policy: InsurancePolicy): number {
  const multipliers = {
    monthly: 12,
    quarterly: 4,
    "semi-annual": 2,
    annual: 1,
  };

  return policy.premium * multipliers[policy.premiumFrequency];
}

/**
 * Calculate total coverage
 */
export async function calculateTotalCoverage(): Promise<number> {
  try {
    const policies = await loadPolicies();
    return policies
      .filter((p) => p.status === "active" || p.status === "expiring_soon")
      .reduce((sum, p) => sum + p.coverageAmount, 0);
  } catch (error) {
    console.error("Failed to calculate total coverage:", error);
    return 0;
  }
}

/**
 * Calculate total annual premiums
 */
export async function calculateTotalAnnualPremiums(): Promise<number> {
  try {
    const policies = await loadPolicies();
    return policies
      .filter((p) => p.status === "active" || p.status === "expiring_soon")
      .reduce((sum, p) => sum + calculateAnnualPremium(p), 0);
  } catch (error) {
    console.error("Failed to calculate total premiums:", error);
    return 0;
  }
}

/**
 * Schedule renewal reminder notification
 */
async function scheduleRenewalReminder(policy: InsurancePolicy): Promise<void> {
  try {
    const daysBeforeRenewal = 30; // Remind 30 days before renewal
    const reminderDate = new Date(policy.renewalDate - daysBeforeRenewal * 24 * 60 * 60 * 1000);

    if (reminderDate.getTime() > Date.now()) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Insurance Renewal Reminder",
          body: `Your ${policy.type} insurance with ${policy.provider} renews in ${daysBeforeRenewal} days`,
          data: { policyId: policy.id },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: reminderDate,
        },
      });

      // Store reminder ID
      const reminders = await loadReminders();
      reminders[policy.id] = reminderDate.getTime();
      await saveReminders(reminders);
    }
  } catch (error) {
    console.error("Failed to schedule renewal reminder:", error);
  }
}

/**
 * Cancel renewal reminder
 */
async function cancelRenewalReminder(policyId: string): Promise<void> {
  try {
    const reminders = await loadReminders();
    delete reminders[policyId];
    await saveReminders(reminders);
  } catch (error) {
    console.error("Failed to cancel renewal reminder:", error);
  }
}

/**
 * Load reminders
 */
async function loadReminders(): Promise<Record<string, number>> {
  try {
    const data = await AsyncStorage.getItem(REMINDERS_KEY);
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error("Failed to load reminders:", error);
    return {};
  }
}

/**
 * Save reminders
 */
async function saveReminders(reminders: Record<string, number>): Promise<void> {
  try {
    await AsyncStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders));
  } catch (error) {
    console.error("Failed to save reminders:", error);
  }
}

/**
 * Save insurance claims
 */
export async function saveClaims(claims: InsuranceClaim[]): Promise<void> {
  try {
    await AsyncStorage.setItem(CLAIMS_KEY, JSON.stringify(claims));
  } catch (error) {
    console.error("Failed to save insurance claims:", error);
    throw error;
  }
}

/**
 * Load insurance claims
 */
export async function loadClaims(): Promise<InsuranceClaim[]> {
  try {
    const data = await AsyncStorage.getItem(CLAIMS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("Failed to load insurance claims:", error);
    return [];
  }
}

/**
 * Add or update insurance claim
 */
export async function saveClaim(claim: InsuranceClaim): Promise<void> {
  try {
    const claims = await loadClaims();
    const index = claims.findIndex((c) => c.id === claim.id);

    if (index >= 0) {
      claims[index] = claim;
    } else {
      claims.push(claim);
    }

    await saveClaims(claims);
  } catch (error) {
    console.error("Failed to save insurance claim:", error);
    throw error;
  }
}

/**
 * Get claims by policy ID
 */
export async function getClaimsByPolicyId(policyId: string): Promise<InsuranceClaim[]> {
  try {
    const claims = await loadClaims();
    return claims.filter((c) => c.policyId === policyId);
  } catch (error) {
    console.error("Failed to get claims by policy ID:", error);
    return [];
  }
}

/**
 * Get policy type icon
 */
export function getPolicyTypeIcon(type: InsurancePolicy["type"]): string {
  const icons: Record<InsurancePolicy["type"], string> = {
    health: "🏥",
    auto: "🚗",
    life: "❤️",
    home: "🏠",
    travel: "✈️",
    disability: "♿",
    pet: "🐾",
  };

  return icons[type] || "📄";
}

/**
 * Get policy type label
 */
export function getPolicyTypeLabel(type: InsurancePolicy["type"]): string {
  const labels: Record<InsurancePolicy["type"], string> = {
    health: "Health Insurance",
    auto: "Auto Insurance",
    life: "Life Insurance",
    home: "Home Insurance",
    travel: "Travel Insurance",
    disability: "Disability Insurance",
    pet: "Pet Insurance",
  };

  return labels[type] || "Insurance";
}

/**
 * Get status color
 */
export function getStatusColor(status: InsurancePolicy["status"], colors: any): string {
  const statusColors: Record<InsurancePolicy["status"], string> = {
    active: colors.success,
    expiring_soon: colors.warning,
    expired: colors.error,
    cancelled: colors.muted,
  };

  return statusColors[status] || colors.muted;
}

/**
 * Get claim status color
 */
export function getClaimStatusColor(status: InsuranceClaim["status"], colors: any): string {
  const statusColors: Record<InsuranceClaim["status"], string> = {
    pending: colors.warning,
    approved: colors.success,
    denied: colors.error,
    paid: colors.success,
  };

  return statusColors[status] || colors.muted;
}

/**
 * Compare coverage across providers
 */
export interface CoverageComparison {
  provider: string;
  coverageAmount: number;
  premium: number;
  annualPremium: number;
  costPerThousand: number;
}

export async function compareCoverage(type: InsurancePolicy["type"]): Promise<CoverageComparison[]> {
  try {
    const policies = await getPoliciesByType(type);

    return policies.map((policy) => {
      const annualPremium = calculateAnnualPremium(policy);
      const costPerThousand = (annualPremium / policy.coverageAmount) * 1000;

      return {
        provider: policy.provider,
        coverageAmount: policy.coverageAmount,
        premium: policy.premium,
        annualPremium,
        costPerThousand,
      };
    }).sort((a, b) => a.costPerThousand - b.costPerThousand);
  } catch (error) {
    console.error("Failed to compare coverage:", error);
    return [];
  }
}
