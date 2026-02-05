import AsyncStorage from "@react-native-async-storage/async-storage";

export interface RoundUpRule {
  id: string;
  name: string;
  enabled: boolean;
  type: "fixed" | "percentage" | "smart";
  amount?: number; // For fixed type
  percentage?: number; // For percentage type
  min_transaction?: number; // Minimum transaction amount to trigger
  max_daily?: number; // Maximum daily round-up amount
  target_goal_id?: string; // Optional savings goal to transfer to
  created_at: number;
}

export interface RoundUpTransaction {
  id: string;
  transaction_id: string;
  transaction_amount: number;
  roundup_amount: number;
  rule_id: string;
  goal_id?: string;
  timestamp: number;
  status: "pending" | "completed" | "failed";
}

export interface RoundUpStats {
  total_saved: number;
  transaction_count: number;
  average_roundup: number;
  daily_impact: number;
  monthly_projection: number;
}

const ROUNDUP_RULES_KEY = "savings_roundup_rules";
const ROUNDUP_TRANSACTIONS_KEY = "roundup_transactions";

/**
 * Calculate round-up amount for a transaction
 */
export function calculateRoundUp(amount: number, rule: RoundUpRule): number {
  if (!rule.enabled) return 0;

  // Check minimum transaction
  if (rule.min_transaction && amount < rule.min_transaction) {
    return 0;
  }

  let roundUpAmount = 0;

  switch (rule.type) {
    case "fixed":
      // Round up to nearest dollar
      const nextDollar = Math.ceil(amount);
      roundUpAmount = nextDollar - amount;
      break;

    case "percentage":
      // Round up by percentage
      roundUpAmount = amount * ((rule.percentage || 0) / 100);
      break;

    case "smart":
      // Smart round-up: analyze spending pattern and optimize
      // Round up more for small transactions, less for large ones
      if (amount < 10) {
        roundUpAmount = Math.ceil(amount) - amount;
      } else if (amount < 50) {
        roundUpAmount = (Math.ceil(amount / 5) * 5) - amount;
      } else {
        roundUpAmount = (Math.ceil(amount / 10) * 10) - amount;
      }
      break;
  }

  // Apply fixed amount if specified
  if (rule.amount) {
    roundUpAmount = rule.amount;
  }

  return Math.min(roundUpAmount, rule.max_daily || 100);
}

/**
 * Get all round-up rules
 */
export async function getRoundUpRules(): Promise<RoundUpRule[]> {
  try {
    const rulesJson = await AsyncStorage.getItem(ROUNDUP_RULES_KEY);
    if (!rulesJson) {
      // Create default rule
      const defaultRule: RoundUpRule = {
        id: `rule_${Date.now()}`,
        name: "Round Up to Dollar",
        enabled: true,
        type: "fixed",
        min_transaction: 1,
        max_daily: 50,
        created_at: Date.now(),
      };
      await AsyncStorage.setItem(ROUNDUP_RULES_KEY, JSON.stringify([defaultRule]));
      return [defaultRule];
    }
    return JSON.parse(rulesJson);
  } catch (error) {
    console.error("Error getting round-up rules:", error);
    return [];
  }
}

/**
 * Create a new round-up rule
 */
export async function createRoundUpRule(rule: Omit<RoundUpRule, "id" | "created_at">): Promise<RoundUpRule> {
  const newRule: RoundUpRule = {
    ...rule,
    id: `rule_${Date.now()}`,
    created_at: Date.now(),
  };

  const rules = await getRoundUpRules();
  rules.push(newRule);
  await AsyncStorage.setItem(ROUNDUP_RULES_KEY, JSON.stringify(rules));

  return newRule;
}

/**
 * Update a round-up rule
 */
export async function updateRoundUpRule(ruleId: string, updates: Partial<RoundUpRule>): Promise<void> {
  const rules = await getRoundUpRules();
  const updatedRules = rules.map((rule) =>
    rule.id === ruleId ? { ...rule, ...updates } : rule
  );
  await AsyncStorage.setItem(ROUNDUP_RULES_KEY, JSON.stringify(updatedRules));
}

/**
 * Delete a round-up rule
 */
export async function deleteRoundUpRule(ruleId: string): Promise<void> {
  const rules = await getRoundUpRules();
  const updatedRules = rules.filter((rule) => rule.id !== ruleId);
  await AsyncStorage.setItem(ROUNDUP_RULES_KEY, JSON.stringify(updatedRules));
}

/**
 * Process a transaction and create round-up
 */
export async function processRoundUp(
  transactionId: string,
  transactionAmount: number
): Promise<RoundUpTransaction | null> {
  const rules = await getRoundUpRules();
  const activeRule = rules.find((rule) => rule.enabled);

  if (!activeRule) return null;

  const roundUpAmount = calculateRoundUp(transactionAmount, activeRule);

  if (roundUpAmount === 0) return null;

  // Check daily limit
  const today = new Date().toDateString();
  const transactions = await getRoundUpTransactions();
  const todayTransactions = transactions.filter(
    (t) => new Date(t.timestamp).toDateString() === today && t.status === "completed"
  );
  const todayTotal = todayTransactions.reduce((sum, t) => sum + t.roundup_amount, 0);

  if (activeRule.max_daily && todayTotal + roundUpAmount > activeRule.max_daily) {
    return null; // Exceeded daily limit
  }

  const roundUpTx: RoundUpTransaction = {
    id: `roundup_${Date.now()}`,
    transaction_id: transactionId,
    transaction_amount: transactionAmount,
    roundup_amount: roundUpAmount,
    rule_id: activeRule.id,
    goal_id: activeRule.target_goal_id,
    timestamp: Date.now(),
    status: "completed",
  };

  transactions.push(roundUpTx);
  await AsyncStorage.setItem(ROUNDUP_TRANSACTIONS_KEY, JSON.stringify(transactions));

  return roundUpTx;
}

/**
 * Get all round-up transactions
 */
export async function getRoundUpTransactions(): Promise<RoundUpTransaction[]> {
  try {
    const txJson = await AsyncStorage.getItem(ROUNDUP_TRANSACTIONS_KEY);
    if (!txJson) return [];
    return JSON.parse(txJson);
  } catch (error) {
    console.error("Error getting round-up transactions:", error);
    return [];
  }
}

/**
 * Get round-up statistics
 */
export async function getRoundUpStats(): Promise<RoundUpStats> {
  const transactions = await getRoundUpTransactions();
  const completedTx = transactions.filter((t) => t.status === "completed");

  if (completedTx.length === 0) {
    return {
      total_saved: 0,
      transaction_count: 0,
      average_roundup: 0,
      daily_impact: 0,
      monthly_projection: 0,
    };
  }

  const total_saved = completedTx.reduce((sum, t) => sum + t.roundup_amount, 0);
  const transaction_count = completedTx.length;
  const average_roundup = total_saved / transaction_count;

  // Calculate daily impact (last 7 days)
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentTx = completedTx.filter((t) => t.timestamp >= sevenDaysAgo);
  const recentTotal = recentTx.reduce((sum, t) => sum + t.roundup_amount, 0);
  const daily_impact = recentTotal / 7;

  // Monthly projection
  const monthly_projection = daily_impact * 30;

  return {
    total_saved,
    transaction_count,
    average_roundup,
    daily_impact,
    monthly_projection,
  };
}

/**
 * Analyze cash flow impact
 */
export async function analyzeCashFlowImpact(): Promise<{
  safe: boolean;
  impact_percentage: number;
  recommendation: string;
}> {
  const stats = await getRoundUpStats();
  
  // Mock income for analysis (in production, fetch from user's actual income)
  const monthlyIncome = 5000;
  const impact_percentage = (stats.monthly_projection / monthlyIncome) * 100;

  let safe = true;
  let recommendation = "Your round-up savings are well within a healthy range.";

  if (impact_percentage > 5) {
    safe = false;
    recommendation = "Round-up savings are impacting your cash flow. Consider reducing your round-up amount.";
  } else if (impact_percentage < 1) {
    recommendation = "You have room to increase your round-up amount for faster savings growth.";
  }

  return {
    safe,
    impact_percentage,
    recommendation,
  };
}
