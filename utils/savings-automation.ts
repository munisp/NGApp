import AsyncStorage from "@react-native-async-storage/async-storage";

export type RuleType = "round_up" | "percentage" | "fixed_amount" | "custom";
export type TriggerType = "transaction" | "deposit" | "paycheck" | "weekly" | "monthly";

export interface SavingsRule {
  id: string;
  name: string;
  type: RuleType;
  enabled: boolean;
  created_at: number;
  
  // Rule configuration
  trigger: TriggerType;
  
  // Round-up specific
  round_up_multiplier?: number; // 1x, 2x, 5x, etc.
  
  // Percentage specific
  percentage?: number; // 5%, 10%, etc.
  
  // Fixed amount specific
  fixed_amount?: number;
  
  // Custom rule specific
  condition?: string; // e.g., "amount > 100"
  action?: string; // e.g., "save 10"
  
  // Target account
  target_goal_id?: string;
  target_account_id?: string;
  
  // Limits
  max_per_transaction?: number;
  max_per_day?: number;
  max_per_month?: number;
  
  // Statistics
  total_saved?: number;
  execution_count?: number;
  last_executed?: number;
}

export interface RuleExecution {
  rule_id: string;
  transaction_id?: string;
  amount_saved: number;
  timestamp: number;
  success: boolean;
  error?: string;
}

const RULES_STORAGE_KEY = "savings_automation_rules";
const EXECUTIONS_STORAGE_KEY = "savings_automation_executions";

/**
 * Get all savings rules
 */
export async function getSavingsRules(): Promise<SavingsRule[]> {
  try {
    const rulesJson = await AsyncStorage.getItem(RULES_STORAGE_KEY);
    if (!rulesJson) return [];
    return JSON.parse(rulesJson);
  } catch (error) {
    console.error("Failed to get savings rules:", error);
    return [];
  }
}

/**
 * Save savings rules
 */
export async function saveSavingsRules(rules: SavingsRule[]): Promise<void> {
  try {
    await AsyncStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(rules));
  } catch (error) {
    console.error("Failed to save savings rules:", error);
    throw error;
  }
}

/**
 * Create a new savings rule
 */
export async function createSavingsRule(rule: Omit<SavingsRule, "id" | "created_at" | "total_saved" | "execution_count">): Promise<SavingsRule> {
  const rules = await getSavingsRules();
  
  const newRule: SavingsRule = {
    ...rule,
    id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    created_at: Date.now(),
    total_saved: 0,
    execution_count: 0,
  };
  
  rules.push(newRule);
  await saveSavingsRules(rules);
  
  return newRule;
}

/**
 * Update an existing savings rule
 */
export async function updateSavingsRule(ruleId: string, updates: Partial<SavingsRule>): Promise<SavingsRule | null> {
  const rules = await getSavingsRules();
  const index = rules.findIndex((r) => r.id === ruleId);
  
  if (index === -1) return null;
  
  rules[index] = { ...rules[index], ...updates };
  await saveSavingsRules(rules);
  
  return rules[index];
}

/**
 * Delete a savings rule
 */
export async function deleteSavingsRule(ruleId: string): Promise<boolean> {
  const rules = await getSavingsRules();
  const filtered = rules.filter((r) => r.id !== ruleId);
  
  if (filtered.length === rules.length) return false;
  
  await saveSavingsRules(filtered);
  return true;
}

/**
 * Toggle rule enabled status
 */
export async function toggleSavingsRule(ruleId: string): Promise<boolean> {
  const rules = await getSavingsRules();
  const rule = rules.find((r) => r.id === ruleId);
  
  if (!rule) return false;
  
  rule.enabled = !rule.enabled;
  await saveSavingsRules(rules);
  
  return rule.enabled;
}

/**
 * Calculate round-up amount
 */
function calculateRoundUp(amount: number, multiplier: number = 1): number {
  const roundedUp = Math.ceil(amount);
  const difference = roundedUp - amount;
  return difference * multiplier;
}

/**
 * Calculate percentage amount
 */
function calculatePercentage(amount: number, percentage: number): number {
  return (amount * percentage) / 100;
}

/**
 * Check if rule limits are exceeded
 */
async function checkRuleLimits(rule: SavingsRule, proposedAmount: number): Promise<{ allowed: boolean; maxAmount: number }> {
  const now = Date.now();
  const executions = await getRuleExecutions(rule.id);
  
  // Check per-transaction limit
  if (rule.max_per_transaction && proposedAmount > rule.max_per_transaction) {
    return { allowed: false, maxAmount: rule.max_per_transaction };
  }
  
  // Check daily limit
  if (rule.max_per_day) {
    const todayStart = new Date().setHours(0, 0, 0, 0);
    const todayExecutions = executions.filter((e) => e.timestamp >= todayStart && e.success);
    const todayTotal = todayExecutions.reduce((sum, e) => sum + e.amount_saved, 0);
    
    if (todayTotal + proposedAmount > rule.max_per_day) {
      return { allowed: false, maxAmount: rule.max_per_day - todayTotal };
    }
  }
  
  // Check monthly limit
  if (rule.max_per_month) {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    
    const monthExecutions = executions.filter((e) => e.timestamp >= monthStart.getTime() && e.success);
    const monthTotal = monthExecutions.reduce((sum, e) => sum + e.amount_saved, 0);
    
    if (monthTotal + proposedAmount > rule.max_per_month) {
      return { allowed: false, maxAmount: rule.max_per_month - monthTotal };
    }
  }
  
  return { allowed: true, maxAmount: proposedAmount };
}

/**
 * Execute a savings rule for a transaction
 */
export async function executeSavingsRule(
  rule: SavingsRule,
  transaction: {
    id: string;
    amount: number;
    type: "debit" | "credit";
  }
): Promise<{ success: boolean; amount_saved: number; error?: string }> {
  if (!rule.enabled) {
    return { success: false, amount_saved: 0, error: "Rule is disabled" };
  }
  
  let amountToSave = 0;
  
  try {
    // Calculate amount based on rule type
    switch (rule.type) {
      case "round_up":
        if (transaction.type === "debit") {
          amountToSave = calculateRoundUp(Math.abs(transaction.amount), rule.round_up_multiplier || 1);
        }
        break;
      
      case "percentage":
        if (transaction.type === "credit" && rule.percentage) {
          amountToSave = calculatePercentage(transaction.amount, rule.percentage);
        }
        break;
      
      case "fixed_amount":
        if (rule.fixed_amount) {
          amountToSave = rule.fixed_amount;
        }
        break;
      
      case "custom":
        // Evaluate custom condition
        if (rule.condition && rule.action) {
          // Simple condition evaluation (in production, use a proper expression evaluator)
          const amount = Math.abs(transaction.amount);
          if (eval(rule.condition.replace("amount", amount.toString()))) {
            amountToSave = parseFloat(rule.action.replace("save", "").trim());
          }
        }
        break;
    }
    
    if (amountToSave <= 0) {
      return { success: false, amount_saved: 0, error: "No amount to save" };
    }
    
    // Check limits
    const { allowed, maxAmount } = await checkRuleLimits(rule, amountToSave);
    if (!allowed) {
      if (maxAmount > 0) {
        amountToSave = maxAmount;
      } else {
        return { success: false, amount_saved: 0, error: "Rule limit exceeded" };
      }
    }
    
    // Record execution
    await recordRuleExecution({
      rule_id: rule.id,
      transaction_id: transaction.id,
      amount_saved: amountToSave,
      timestamp: Date.now(),
      success: true,
    });
    
    // Update rule statistics
    await updateSavingsRule(rule.id, {
      total_saved: (rule.total_saved || 0) + amountToSave,
      execution_count: (rule.execution_count || 0) + 1,
      last_executed: Date.now(),
    });
    
    return { success: true, amount_saved: amountToSave };
  } catch (error: any) {
    console.error("Failed to execute savings rule:", error);
    
    await recordRuleExecution({
      rule_id: rule.id,
      transaction_id: transaction.id,
      amount_saved: 0,
      timestamp: Date.now(),
      success: false,
      error: error.message,
    });
    
    return { success: false, amount_saved: 0, error: error.message };
  }
}

/**
 * Execute all applicable rules for a transaction
 */
export async function executeAllRulesForTransaction(transaction: {
  id: string;
  amount: number;
  type: "debit" | "credit";
}): Promise<{ total_saved: number; executions: Array<{ rule_id: string; amount: number }> }> {
  const rules = await getSavingsRules();
  const enabledRules = rules.filter((r) => r.enabled && r.trigger === "transaction");
  
  let totalSaved = 0;
  const executions: Array<{ rule_id: string; amount: number }> = [];
  
  for (const rule of enabledRules) {
    const result = await executeSavingsRule(rule, transaction);
    if (result.success) {
      totalSaved += result.amount_saved;
      executions.push({
        rule_id: rule.id,
        amount: result.amount_saved,
      });
    }
  }
  
  return { total_saved: totalSaved, executions };
}

/**
 * Get rule execution history
 */
export async function getRuleExecutions(ruleId?: string): Promise<RuleExecution[]> {
  try {
    const executionsJson = await AsyncStorage.getItem(EXECUTIONS_STORAGE_KEY);
    if (!executionsJson) return [];
    
    const executions: RuleExecution[] = JSON.parse(executionsJson);
    
    if (ruleId) {
      return executions.filter((e) => e.rule_id === ruleId);
    }
    
    return executions;
  } catch (error) {
    console.error("Failed to get rule executions:", error);
    return [];
  }
}

/**
 * Record a rule execution
 */
async function recordRuleExecution(execution: RuleExecution): Promise<void> {
  try {
    const executions = await getRuleExecutions();
    executions.push(execution);
    
    // Keep only last 1000 executions
    const trimmed = executions.slice(-1000);
    
    await AsyncStorage.setItem(EXECUTIONS_STORAGE_KEY, JSON.stringify(trimmed));
  } catch (error) {
    console.error("Failed to record rule execution:", error);
  }
}

/**
 * Get rule statistics
 */
export async function getRuleStatistics(ruleId: string, days: number = 30): Promise<{
  total_saved: number;
  execution_count: number;
  average_per_execution: number;
  success_rate: number;
  daily_average: number;
}> {
  const executions = await getRuleExecutions(ruleId);
  const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;
  const recentExecutions = executions.filter((e) => e.timestamp >= cutoffTime);
  
  const totalSaved = recentExecutions
    .filter((e) => e.success)
    .reduce((sum, e) => sum + e.amount_saved, 0);
  
  const executionCount = recentExecutions.length;
  const successCount = recentExecutions.filter((e) => e.success).length;
  
  return {
    total_saved: totalSaved,
    execution_count: executionCount,
    average_per_execution: executionCount > 0 ? totalSaved / successCount : 0,
    success_rate: executionCount > 0 ? (successCount / executionCount) * 100 : 0,
    daily_average: totalSaved / days,
  };
}

/**
 * Create preset rules
 */
export async function createPresetRules(): Promise<SavingsRule[]> {
  const presets: Array<Omit<SavingsRule, "id" | "created_at" | "total_saved" | "execution_count">> = [
    {
      name: "Round Up Every Purchase",
      type: "round_up",
      enabled: false,
      trigger: "transaction",
      round_up_multiplier: 1,
      max_per_transaction: 1,
      max_per_day: 10,
      max_per_month: 100,
    },
    {
      name: "Save 10% of Deposits",
      type: "percentage",
      enabled: false,
      trigger: "deposit",
      percentage: 10,
      max_per_transaction: 50,
      max_per_month: 500,
    },
    {
      name: "Weekly Auto-Save",
      type: "fixed_amount",
      enabled: false,
      trigger: "weekly",
      fixed_amount: 25,
    },
    {
      name: "Monthly Savings Goal",
      type: "fixed_amount",
      enabled: false,
      trigger: "monthly",
      fixed_amount: 100,
    },
  ];
  
  const created: SavingsRule[] = [];
  for (const preset of presets) {
    const rule = await createSavingsRule(preset);
    created.push(rule);
  }
  
  return created;
}
