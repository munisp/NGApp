import AsyncStorage from "@react-native-async-storage/async-storage";

export interface FinancialHealthMetrics {
  savings_rate: number; // percentage
  debt_to_income_ratio: number; // percentage
  emergency_fund_months: number;
  budget_adherence: number; // percentage
  credit_utilization: number; // percentage
}

export interface FinancialHealthScore {
  overall_score: number; // 0-100
  grade: "Excellent" | "Good" | "Fair" | "Needs Improvement" | "Critical";
  metrics: FinancialHealthMetrics;
  breakdown: {
    savings_score: number;
    debt_score: number;
    emergency_fund_score: number;
    budget_score: number;
    credit_score: number;
  };
  insights: string[];
  recommendations: string[];
  calculated_at: number;
}

export interface FinancialData {
  monthly_income: number;
  monthly_expenses: number;
  total_savings: number;
  total_debt: number;
  monthly_debt_payments: number;
  budgeted_amount: number;
  actual_spending: number;
  credit_limit: number;
  credit_used: number;
}

const HEALTH_SCORE_STORAGE_KEY = "financial_health_score";
const HEALTH_HISTORY_STORAGE_KEY = "financial_health_history";

/**
 * Calculate savings rate score (0-20 points)
 */
function calculateSavingsScore(savingsRate: number): number {
  if (savingsRate >= 20) return 20;
  if (savingsRate >= 15) return 18;
  if (savingsRate >= 10) return 15;
  if (savingsRate >= 5) return 10;
  if (savingsRate >= 1) return 5;
  return 0;
}

/**
 * Calculate debt-to-income score (0-25 points)
 */
function calculateDebtScore(debtToIncome: number): number {
  if (debtToIncome === 0) return 25;
  if (debtToIncome <= 10) return 23;
  if (debtToIncome <= 20) return 20;
  if (debtToIncome <= 30) return 15;
  if (debtToIncome <= 40) return 10;
  if (debtToIncome <= 50) return 5;
  return 0;
}

/**
 * Calculate emergency fund score (0-25 points)
 */
function calculateEmergencyFundScore(months: number): number {
  if (months >= 6) return 25;
  if (months >= 4) return 20;
  if (months >= 3) return 15;
  if (months >= 2) return 10;
  if (months >= 1) return 5;
  return 0;
}

/**
 * Calculate budget adherence score (0-15 points)
 */
function calculateBudgetScore(adherence: number): number {
  if (adherence >= 95) return 15;
  if (adherence >= 90) return 13;
  if (adherence >= 80) return 10;
  if (adherence >= 70) return 7;
  if (adherence >= 60) return 4;
  return 0;
}

/**
 * Calculate credit utilization score (0-15 points)
 */
function calculateCreditScore(utilization: number): number {
  if (utilization === 0) return 15;
  if (utilization <= 10) return 14;
  if (utilization <= 20) return 12;
  if (utilization <= 30) return 10;
  if (utilization <= 50) return 7;
  if (utilization <= 70) return 4;
  return 0;
}

/**
 * Get grade from overall score
 */
function getGrade(score: number): "Excellent" | "Good" | "Fair" | "Needs Improvement" | "Critical" {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Fair";
  if (score >= 30) return "Needs Improvement";
  return "Critical";
}

/**
 * Generate insights based on metrics
 */
function generateInsights(metrics: FinancialHealthMetrics, breakdown: any): string[] {
  const insights: string[] = [];
  
  // Savings insights
  if (metrics.savings_rate >= 20) {
    insights.push("💰 Excellent savings rate! You're building wealth effectively.");
  } else if (metrics.savings_rate >= 10) {
    insights.push("👍 Good savings habit. Consider increasing to 20% for faster wealth building.");
  } else if (metrics.savings_rate >= 5) {
    insights.push("⚠️ Your savings rate is below recommended levels. Aim for at least 10%.");
  } else {
    insights.push("🚨 Critical: You're saving very little. Start with 5% and increase gradually.");
  }
  
  // Debt insights
  if (metrics.debt_to_income_ratio === 0) {
    insights.push("🎉 Debt-free! You have excellent financial flexibility.");
  } else if (metrics.debt_to_income_ratio <= 20) {
    insights.push("✅ Your debt level is manageable and under control.");
  } else if (metrics.debt_to_income_ratio <= 40) {
    insights.push("⚠️ Debt is consuming a significant portion of your income. Focus on paying it down.");
  } else {
    insights.push("🚨 High debt burden. Prioritize debt reduction to improve financial health.");
  }
  
  // Emergency fund insights
  if (metrics.emergency_fund_months >= 6) {
    insights.push("🛡️ Strong emergency fund! You're well-protected against unexpected expenses.");
  } else if (metrics.emergency_fund_months >= 3) {
    insights.push("👍 Good emergency fund. Aim for 6 months for optimal security.");
  } else if (metrics.emergency_fund_months >= 1) {
    insights.push("⚠️ Emergency fund needs growth. Target 3-6 months of expenses.");
  } else {
    insights.push("🚨 No emergency fund. Start building one immediately to avoid financial emergencies.");
  }
  
  // Budget insights
  if (metrics.budget_adherence >= 90) {
    insights.push("📊 Excellent budget discipline! You're in full control of your spending.");
  } else if (metrics.budget_adherence >= 70) {
    insights.push("👍 Good budget adherence. Minor adjustments can make it even better.");
  } else {
    insights.push("⚠️ Budget adherence needs improvement. Review and adjust your spending categories.");
  }
  
  // Credit insights
  if (metrics.credit_utilization <= 30) {
    insights.push("💳 Healthy credit utilization. This positively impacts your credit score.");
  } else if (metrics.credit_utilization <= 50) {
    insights.push("⚠️ Credit utilization is moderate. Try to keep it below 30%.");
  } else {
    insights.push("🚨 High credit utilization. Pay down balances to improve credit health.");
  }
  
  return insights;
}

/**
 * Generate personalized recommendations
 */
function generateRecommendations(metrics: FinancialHealthMetrics, breakdown: any): string[] {
  const recommendations: string[] = [];
  
  // Prioritize recommendations by impact
  const scores = [
    { metric: "debt", score: breakdown.debt_score, max: 25 },
    { metric: "emergency_fund", score: breakdown.emergency_fund_score, max: 25 },
    { metric: "savings", score: breakdown.savings_score, max: 20 },
    { metric: "budget", score: breakdown.budget_score, max: 15 },
    { metric: "credit", score: breakdown.credit_score, max: 15 },
  ];
  
  // Sort by improvement potential (lowest percentage first)
  scores.sort((a, b) => (a.score / a.max) - (b.score / b.max));
  
  // Top 3 recommendations
  for (let i = 0; i < Math.min(3, scores.length); i++) {
    const item = scores[i];
    
    if (item.metric === "debt" && item.score < 20) {
      recommendations.push(
        "1️⃣ Reduce debt: Use the avalanche method (highest interest first) or snowball method (smallest balance first) to pay down debt faster."
      );
    } else if (item.metric === "emergency_fund" && item.score < 20) {
      recommendations.push(
        "1️⃣ Build emergency fund: Set up automatic transfers to save $50-100/month until you reach 3-6 months of expenses."
      );
    } else if (item.metric === "savings" && item.score < 15) {
      recommendations.push(
        "2️⃣ Increase savings: Try the 50/30/20 rule (50% needs, 30% wants, 20% savings) to boost your savings rate."
      );
    } else if (item.metric === "budget" && item.score < 10) {
      recommendations.push(
        "2️⃣ Improve budgeting: Use the envelope method or zero-based budgeting to track every dollar and reduce overspending."
      );
    } else if (item.metric === "credit" && item.score < 10) {
      recommendations.push(
        "3️⃣ Lower credit utilization: Pay down credit card balances or request a credit limit increase to improve your ratio."
      );
    }
  }
  
  // Add general recommendations
  if (recommendations.length < 3) {
    recommendations.push(
      "💡 Automate your finances: Set up automatic bill payments and savings transfers to ensure consistency."
    );
  }
  
  if (recommendations.length < 3) {
    recommendations.push(
      "📚 Financial education: Take our free courses on budgeting, investing, and debt management to improve your knowledge."
    );
  }
  
  return recommendations.slice(0, 3);
}

/**
 * Calculate financial health score
 */
export async function calculateFinancialHealthScore(
  data: FinancialData
): Promise<FinancialHealthScore> {
  // Calculate metrics
  const savingsRate = data.monthly_income > 0
    ? ((data.monthly_income - data.monthly_expenses) / data.monthly_income) * 100
    : 0;
  
  const debtToIncomeRatio = data.monthly_income > 0
    ? (data.monthly_debt_payments / data.monthly_income) * 100
    : 0;
  
  const emergencyFundMonths = data.monthly_expenses > 0
    ? data.total_savings / data.monthly_expenses
    : 0;
  
  const budgetAdherence = data.budgeted_amount > 0
    ? Math.min(100, (1 - Math.abs(data.actual_spending - data.budgeted_amount) / data.budgeted_amount) * 100)
    : 100;
  
  const creditUtilization = data.credit_limit > 0
    ? (data.credit_used / data.credit_limit) * 100
    : 0;
  
  const metrics: FinancialHealthMetrics = {
    savings_rate: Math.max(0, Math.min(100, savingsRate)),
    debt_to_income_ratio: Math.max(0, Math.min(100, debtToIncomeRatio)),
    emergency_fund_months: Math.max(0, emergencyFundMonths),
    budget_adherence: Math.max(0, Math.min(100, budgetAdherence)),
    credit_utilization: Math.max(0, Math.min(100, creditUtilization)),
  };
  
  // Calculate component scores
  const breakdown = {
    savings_score: calculateSavingsScore(metrics.savings_rate),
    debt_score: calculateDebtScore(metrics.debt_to_income_ratio),
    emergency_fund_score: calculateEmergencyFundScore(metrics.emergency_fund_months),
    budget_score: calculateBudgetScore(metrics.budget_adherence),
    credit_score: calculateCreditScore(metrics.credit_utilization),
  };
  
  // Calculate overall score
  const overallScore = Object.values(breakdown).reduce((sum, score) => sum + score, 0);
  
  const score: FinancialHealthScore = {
    overall_score: Math.round(overallScore),
    grade: getGrade(overallScore),
    metrics,
    breakdown,
    insights: generateInsights(metrics, breakdown),
    recommendations: generateRecommendations(metrics, breakdown),
    calculated_at: Date.now(),
  };
  
  // Save score
  await AsyncStorage.setItem(HEALTH_SCORE_STORAGE_KEY, JSON.stringify(score));
  
  // Save to history
  await saveToHistory(score);
  
  return score;
}

/**
 * Get current financial health score
 */
export async function getCurrentHealthScore(): Promise<FinancialHealthScore | null> {
  try {
    const scoreJson = await AsyncStorage.getItem(HEALTH_SCORE_STORAGE_KEY);
    if (!scoreJson) return null;
    return JSON.parse(scoreJson);
  } catch (error) {
    console.error("Failed to get health score:", error);
    return null;
  }
}

/**
 * Save score to history
 */
async function saveToHistory(score: FinancialHealthScore): Promise<void> {
  try {
    const historyJson = await AsyncStorage.getItem(HEALTH_HISTORY_STORAGE_KEY);
    const history: FinancialHealthScore[] = historyJson ? JSON.parse(historyJson) : [];
    
    // Keep last 12 scores (monthly tracking)
    history.push(score);
    if (history.length > 12) {
      history.shift();
    }
    
    await AsyncStorage.setItem(HEALTH_HISTORY_STORAGE_KEY, JSON.stringify(history));
  } catch (error) {
    console.error("Failed to save to history:", error);
  }
}

/**
 * Get health score history
 */
export async function getHealthScoreHistory(): Promise<FinancialHealthScore[]> {
  try {
    const historyJson = await AsyncStorage.getItem(HEALTH_HISTORY_STORAGE_KEY);
    if (!historyJson) return [];
    return JSON.parse(historyJson);
  } catch (error) {
    console.error("Failed to get health score history:", error);
    return [];
  }
}

/**
 * Get score trend (improving, stable, declining)
 */
export async function getScoreTrend(): Promise<{
  trend: "improving" | "stable" | "declining";
  change: number;
  period: string;
}> {
  const history = await getHealthScoreHistory();
  
  if (history.length < 2) {
    return { trend: "stable", change: 0, period: "insufficient data" };
  }
  
  const current = history[history.length - 1];
  const previous = history[history.length - 2];
  
  const change = current.overall_score - previous.overall_score;
  
  let trend: "improving" | "stable" | "declining";
  if (change > 2) {
    trend = "improving";
  } else if (change < -2) {
    trend = "declining";
  } else {
    trend = "stable";
  }
  
  const daysDiff = Math.floor((current.calculated_at - previous.calculated_at) / (24 * 60 * 60 * 1000));
  const period = daysDiff < 7 ? "this week" : daysDiff < 30 ? "this month" : "recently";
  
  return { trend, change, period };
}

/**
 * Get improvement suggestions based on weakest areas
 */
export async function getImprovementPlan(): Promise<{
  priority: "high" | "medium" | "low";
  area: string;
  current_score: number;
  target_score: number;
  actions: string[];
}[]> {
  const score = await getCurrentHealthScore();
  if (!score) return [];
  
  const plan: any[] = [];
  
  // Analyze each area
  if (score.breakdown.debt_score < 15) {
    plan.push({
      priority: "high",
      area: "Debt Management",
      current_score: score.breakdown.debt_score,
      target_score: 20,
      actions: [
        "List all debts with interest rates",
        "Choose avalanche or snowball method",
        "Set up automatic extra payments",
        "Consider debt consolidation if rates are high",
      ],
    });
  }
  
  if (score.breakdown.emergency_fund_score < 15) {
    plan.push({
      priority: "high",
      area: "Emergency Fund",
      current_score: score.breakdown.emergency_fund_score,
      target_score: 20,
      actions: [
        "Calculate 3-6 months of expenses",
        "Open a high-yield savings account",
        "Set up automatic monthly transfers",
        "Start with $1000 as initial goal",
      ],
    });
  }
  
  if (score.breakdown.savings_score < 10) {
    plan.push({
      priority: "medium",
      area: "Savings Rate",
      current_score: score.breakdown.savings_score,
      target_score: 15,
      actions: [
        "Track all expenses for one month",
        "Identify areas to cut spending",
        "Automate savings transfers",
        "Increase savings by 1% each month",
      ],
    });
  }
  
  if (score.breakdown.budget_score < 10) {
    plan.push({
      priority: "medium",
      area: "Budget Adherence",
      current_score: score.breakdown.budget_score,
      target_score: 13,
      actions: [
        "Review budget categories",
        "Use cash envelopes for problem areas",
        "Check spending weekly",
        "Adjust budget to be more realistic",
      ],
    });
  }
  
  if (score.breakdown.credit_score < 10) {
    plan.push({
      priority: "low",
      area: "Credit Utilization",
      current_score: score.breakdown.credit_score,
      target_score: 12,
      actions: [
        "Pay down highest balance cards first",
        "Request credit limit increases",
        "Set up payment reminders",
        "Avoid new credit card charges",
      ],
    });
  }
  
  return plan.sort((a, b) => {
    const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

/**
 * Simulate score improvement
 */
export function simulateScoreImprovement(
  currentData: FinancialData,
  changes: Partial<FinancialData>
): { new_score: number; improvement: number; new_grade: string } {
  const newData = { ...currentData, ...changes };
  
  // Calculate new metrics (simplified)
  const newSavingsRate = newData.monthly_income > 0
    ? ((newData.monthly_income - newData.monthly_expenses) / newData.monthly_income) * 100
    : 0;
  
  const newDebtToIncome = newData.monthly_income > 0
    ? (newData.monthly_debt_payments / newData.monthly_income) * 100
    : 0;
  
  const newEmergencyFundMonths = newData.monthly_expenses > 0
    ? newData.total_savings / newData.monthly_expenses
    : 0;
  
  const newBudgetAdherence = newData.budgeted_amount > 0
    ? Math.min(100, (1 - Math.abs(newData.actual_spending - newData.budgeted_amount) / newData.budgeted_amount) * 100)
    : 100;
  
  const newCreditUtilization = newData.credit_limit > 0
    ? (newData.credit_used / newData.credit_limit) * 100
    : 0;
  
  // Calculate new scores
  const newBreakdown = {
    savings_score: calculateSavingsScore(newSavingsRate),
    debt_score: calculateDebtScore(newDebtToIncome),
    emergency_fund_score: calculateEmergencyFundScore(newEmergencyFundMonths),
    budget_score: calculateBudgetScore(newBudgetAdherence),
    credit_score: calculateCreditScore(newCreditUtilization),
  };
  
  const newScore = Object.values(newBreakdown).reduce((sum, score) => sum + score, 0);
  
  // Calculate current score
  const currentSavingsRate = currentData.monthly_income > 0
    ? ((currentData.monthly_income - currentData.monthly_expenses) / currentData.monthly_income) * 100
    : 0;
  
  const currentDebtToIncome = currentData.monthly_income > 0
    ? (currentData.monthly_debt_payments / currentData.monthly_income) * 100
    : 0;
  
  const currentEmergencyFundMonths = currentData.monthly_expenses > 0
    ? currentData.total_savings / currentData.monthly_expenses
    : 0;
  
  const currentBudgetAdherence = currentData.budgeted_amount > 0
    ? Math.min(100, (1 - Math.abs(currentData.actual_spending - currentData.budgeted_amount) / currentData.budgeted_amount) * 100)
    : 100;
  
  const currentCreditUtilization = currentData.credit_limit > 0
    ? (currentData.credit_used / currentData.credit_limit) * 100
    : 0;
  
  const currentBreakdown = {
    savings_score: calculateSavingsScore(currentSavingsRate),
    debt_score: calculateDebtScore(currentDebtToIncome),
    emergency_fund_score: calculateEmergencyFundScore(currentEmergencyFundMonths),
    budget_score: calculateBudgetScore(currentBudgetAdherence),
    credit_score: calculateCreditScore(currentCreditUtilization),
  };
  
  const currentScore = Object.values(currentBreakdown).reduce((sum, score) => sum + score, 0);
  
  return {
    new_score: Math.round(newScore),
    improvement: Math.round(newScore - currentScore),
    new_grade: getGrade(newScore),
  };
}
