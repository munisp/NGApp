import AsyncStorage from "@react-native-async-storage/async-storage";

export interface CreditScore {
  score: number;
  date: number;
  provider: "Experian" | "Equifax" | "TransUnion" | "VantageScore";
}

export interface CreditFactor {
  name: string;
  impact: "high" | "medium" | "low";
  status: "excellent" | "good" | "fair" | "poor";
  description: string;
  percentage: number;
  tips: string[];
}

export interface CreditAlert {
  id: string;
  type: "score_increase" | "score_decrease" | "new_account" | "hard_inquiry" | "delinquency";
  title: string;
  description: string;
  date: number;
  severity: "info" | "warning" | "critical";
}

const CREDIT_SCORE_KEY = "credit_score_history";
const CREDIT_ALERTS_KEY = "credit_alerts";

/**
 * Get current credit score
 */
export async function getCurrentCreditScore(): Promise<CreditScore> {
  const history = await getCreditScoreHistory();
  
  if (history.length === 0) {
    // Return mock initial score
    return {
      score: 720,
      date: Date.now(),
      provider: "VantageScore",
    };
  }
  
  return history[0];
}

/**
 * Get credit score history
 */
export async function getCreditScoreHistory(): Promise<CreditScore[]> {
  try {
    const data = await AsyncStorage.getItem(CREDIT_SCORE_KEY);
    return data ? JSON.parse(data) : generateMockHistory();
  } catch (error) {
    console.error("Failed to load credit score history:", error);
    return generateMockHistory();
  }
}

/**
 * Generate mock credit score history
 */
function generateMockHistory(): CreditScore[] {
  const now = Date.now();
  const oneMonth = 30 * 24 * 60 * 60 * 1000;
  
  return [
    { score: 720, date: now, provider: "VantageScore" },
    { score: 715, date: now - oneMonth, provider: "VantageScore" },
    { score: 710, date: now - 2 * oneMonth, provider: "VantageScore" },
    { score: 705, date: now - 3 * oneMonth, provider: "VantageScore" },
    { score: 700, date: now - 4 * oneMonth, provider: "VantageScore" },
    { score: 695, date: now - 5 * oneMonth, provider: "VantageScore" },
    { score: 690, date: now - 6 * oneMonth, provider: "VantageScore" },
  ];
}

/**
 * Add new credit score
 */
export async function addCreditScore(score: CreditScore): Promise<void> {
  try {
    const history = await getCreditScoreHistory();
    history.unshift(score);
    
    // Keep only last 12 months
    const filtered = history.slice(0, 12);
    
    await AsyncStorage.setItem(CREDIT_SCORE_KEY, JSON.stringify(filtered));
    
    // Check for significant changes and create alerts
    if (history.length > 1) {
      const previous = history[1];
      const change = score.score - previous.score;
      
      if (Math.abs(change) >= 10) {
        await createCreditAlert({
          type: change > 0 ? "score_increase" : "score_decrease",
          title: change > 0 ? "Credit Score Increased!" : "Credit Score Decreased",
          description: `Your credit score ${change > 0 ? "increased" : "decreased"} by ${Math.abs(change)} points`,
          severity: change > 0 ? "info" : "warning",
        });
      }
    }
  } catch (error) {
    console.error("Failed to add credit score:", error);
    throw error;
  }
}

/**
 * Analyze credit factors
 */
export async function analyzeCreditFactors(score: number): Promise<CreditFactor[]> {
  const factors: CreditFactor[] = [
    {
      name: "Payment History",
      impact: "high",
      status: score >= 700 ? "excellent" : score >= 650 ? "good" : score >= 600 ? "fair" : "poor",
      description: "Your record of on-time payments",
      percentage: 35,
      tips: [
        "Pay all bills on time, every time",
        "Set up automatic payments to never miss a due date",
        "If you miss a payment, get current as soon as possible",
        "Contact creditors if you're having trouble making payments",
      ],
    },
    {
      name: "Credit Utilization",
      impact: "high",
      status: score >= 700 ? "good" : score >= 650 ? "fair" : "poor",
      description: "Percentage of available credit you're using",
      percentage: 30,
      tips: [
        "Keep credit card balances below 30% of your credit limit",
        "Pay down existing debt to improve utilization",
        "Request credit limit increases (but don't spend more)",
        "Make multiple payments per month to keep balances low",
      ],
    },
    {
      name: "Credit Age",
      impact: "medium",
      status: score >= 700 ? "good" : score >= 650 ? "fair" : "poor",
      description: "Average age of your credit accounts",
      percentage: 15,
      tips: [
        "Keep old credit accounts open, even if you don't use them",
        "Avoid opening too many new accounts at once",
        "Become an authorized user on an older account",
        "Be patient - credit age improves over time",
      ],
    },
    {
      name: "Credit Mix",
      impact: "low",
      status: score >= 700 ? "good" : "fair",
      description: "Variety of credit types you have",
      percentage: 10,
      tips: [
        "Have a mix of credit cards, installment loans, and mortgages",
        "Don't open accounts just to improve mix",
        "Focus on payment history and utilization first",
        "Credit mix has a small impact on your score",
      ],
    },
    {
      name: "New Credit",
      impact: "low",
      status: score >= 700 ? "good" : score >= 650 ? "fair" : "poor",
      description: "Recent credit inquiries and new accounts",
      percentage: 10,
      tips: [
        "Limit credit applications to when you really need credit",
        "Rate shop for loans within a 14-day window",
        "Avoid opening multiple new accounts in a short time",
        "Hard inquiries stay on your report for 2 years",
      ],
    },
  ];
  
  return factors;
}

/**
 * Get personalized credit improvement tips
 */
export async function getPersonalizedTips(score: number): Promise<string[]> {
  const tips: string[] = [];
  
  if (score < 580) {
    // Poor credit
    tips.push(
      "Focus on making all payments on time - this is the #1 factor affecting your score",
      "Pay down credit card balances to below 30% of your credit limits",
      "Check your credit report for errors and dispute any inaccuracies",
      "Consider a secured credit card to rebuild credit history",
      "Avoid applying for new credit until your score improves"
    );
  } else if (score < 670) {
    // Fair credit
    tips.push(
      "Continue making on-time payments to build positive payment history",
      "Reduce credit card balances to improve your utilization ratio",
      "Keep old credit accounts open to maintain credit age",
      "Avoid closing unused credit cards unless they have annual fees",
      "Consider becoming an authorized user on a well-managed account"
    );
  } else if (score < 740) {
    // Good credit
    tips.push(
      "Maintain your excellent payment history",
      "Try to keep credit utilization below 10% for optimal scores",
      "Review your credit report annually for accuracy",
      "Consider requesting credit limit increases to improve utilization",
      "Be strategic about new credit applications"
    );
  } else if (score < 800) {
    // Very good credit
    tips.push(
      "You're doing great! Keep up your current credit habits",
      "Aim for 0% credit utilization by paying in full each month",
      "Monitor your credit regularly for any suspicious activity",
      "Take advantage of premium credit card rewards",
      "Help others by adding them as authorized users"
    );
  } else {
    // Excellent credit
    tips.push(
      "Congratulations on your excellent credit score!",
      "Continue your responsible credit management",
      "You qualify for the best interest rates and terms",
      "Consider sharing your credit success strategies with others",
      "Monitor your credit to maintain this excellent standing"
    );
  }
  
  return tips;
}

/**
 * Get credit score range description
 */
export function getCreditScoreRange(score: number): {
  range: string;
  color: string;
  description: string;
} {
  if (score >= 800) {
    return {
      range: "Exceptional",
      color: "#22C55E",
      description: "You have excellent credit and qualify for the best rates",
    };
  } else if (score >= 740) {
    return {
      range: "Very Good",
      color: "#4ADE80",
      description: "You have very good credit and qualify for favorable rates",
    };
  } else if (score >= 670) {
    return {
      range: "Good",
      color: "#FBBF24",
      description: "You have good credit and qualify for most credit products",
    };
  } else if (score >= 580) {
    return {
      range: "Fair",
      color: "#F59E0B",
      description: "You may qualify for credit but with higher interest rates",
    };
  } else {
    return {
      range: "Poor",
      color: "#EF4444",
      description: "You may have difficulty qualifying for credit",
    };
  }
}

/**
 * Create credit alert
 */
async function createCreditAlert(alert: Omit<CreditAlert, "id" | "date">): Promise<void> {
  try {
    const alerts = await getCreditAlerts();
    
    const newAlert: CreditAlert = {
      id: Date.now().toString(),
      date: Date.now(),
      ...alert,
    };
    
    alerts.unshift(newAlert);
    
    // Keep only last 50 alerts
    const filtered = alerts.slice(0, 50);
    
    await AsyncStorage.setItem(CREDIT_ALERTS_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error("Failed to create credit alert:", error);
  }
}

/**
 * Get credit alerts
 */
export async function getCreditAlerts(): Promise<CreditAlert[]> {
  try {
    const data = await AsyncStorage.getItem(CREDIT_ALERTS_KEY);
    return data ? JSON.parse(data) : getMockAlerts();
  } catch (error) {
    console.error("Failed to load credit alerts:", error);
    return getMockAlerts();
  }
}

/**
 * Get mock credit alerts
 */
function getMockAlerts(): CreditAlert[] {
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  
  return [
    {
      id: "1",
      type: "score_increase",
      title: "Credit Score Increased!",
      description: "Your credit score increased by 5 points",
      date: now - 2 * oneDay,
      severity: "info",
    },
    {
      id: "2",
      type: "hard_inquiry",
      title: "New Hard Inquiry",
      description: "A hard inquiry was added to your credit report",
      date: now - 15 * oneDay,
      severity: "warning",
    },
    {
      id: "3",
      type: "new_account",
      title: "New Account Opened",
      description: "A new credit account was opened in your name",
      date: now - 30 * oneDay,
      severity: "info",
    },
  ];
}

/**
 * Mark alert as read
 */
export async function markAlertAsRead(alertId: string): Promise<void> {
  try {
    const alerts = await getCreditAlerts();
    const filtered = alerts.filter((a) => a.id !== alertId);
    await AsyncStorage.setItem(CREDIT_ALERTS_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error("Failed to mark alert as read:", error);
  }
}

/**
 * Calculate credit score trend
 */
export async function calculateCreditScoreTrend(): Promise<{
  trend: "improving" | "stable" | "declining";
  change: number;
  changePercent: number;
}> {
  const history = await getCreditScoreHistory();
  
  if (history.length < 2) {
    return { trend: "stable", change: 0, changePercent: 0 };
  }
  
  const current = history[0].score;
  const previous = history[1].score;
  const change = current - previous;
  const changePercent = (change / previous) * 100;
  
  let trend: "improving" | "stable" | "declining";
  if (change > 5) {
    trend = "improving";
  } else if (change < -5) {
    trend = "declining";
  } else {
    trend = "stable";
  }
  
  return { trend, change, changePercent };
}

/**
 * Estimate credit score impact of actions
 */
export function estimateCreditScoreImpact(action: string): {
  action: string;
  estimatedImpact: number;
  timeframe: string;
  description: string;
} {
  const impacts: Record<
    string,
    { estimatedImpact: number; timeframe: string; description: string }
  > = {
    pay_down_debt: {
      estimatedImpact: 30,
      timeframe: "1-2 months",
      description: "Paying down credit card debt can significantly improve your credit utilization ratio",
    },
    on_time_payments: {
      estimatedImpact: 50,
      timeframe: "6-12 months",
      description: "Consistent on-time payments build positive payment history over time",
    },
    dispute_errors: {
      estimatedImpact: 20,
      timeframe: "30-60 days",
      description: "Removing errors from your credit report can provide an immediate boost",
    },
    increase_credit_limit: {
      estimatedImpact: 15,
      timeframe: "Immediate",
      description: "Increasing credit limits improves your utilization ratio without changing balances",
    },
    become_authorized_user: {
      estimatedImpact: 25,
      timeframe: "1-2 months",
      description: "Being added to a well-managed account can boost your credit age and payment history",
    },
  };
  
  return {
    action,
    ...impacts[action] || {
      estimatedImpact: 0,
      timeframe: "Unknown",
      description: "Impact varies based on individual circumstances",
    },
  };
}
