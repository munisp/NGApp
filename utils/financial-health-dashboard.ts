import AsyncStorage from "@react-native-async-storage/async-storage";
import { getCurrentCreditScore } from "./credit-score";
import { calculateNetWorth } from "./net-worth";
// Budget data will be fetched from AsyncStorage directly
// Savings goals will be fetched from AsyncStorage directly

export interface FinancialHealthMetrics {
  overallScore: number;
  creditScore: {
    score: number;
    rating: string;
    trend: "up" | "down" | "stable";
  };
  netWorth: {
    value: number;
    change: number;
    changePercent: number;
  };
  budgetAdherence: {
    score: number;
    categoriesOnTrack: number;
    totalCategories: number;
  };
  savingsProgress: {
    score: number;
    goalsOnTrack: number;
    totalGoals: number;
  };
  debtToIncome: {
    ratio: number;
    rating: string;
  };
}

export interface HealthRecommendation {
  id: string;
  category: "credit" | "budget" | "savings" | "debt" | "investment";
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  action: string;
  potentialImpact: string;
}

const STORAGE_KEY = "@financial_health_history";

export async function calculateFinancialHealth(): Promise<FinancialHealthMetrics> {
  // Get all component metrics
  const [creditData, netWorthData] = await Promise.all([
    getCurrentCreditScore(),
    calculateNetWorth(),
  ]);

  // Get budgets from AsyncStorage
  const budgetsData = await AsyncStorage.getItem("@budgets");
  const budgets: Array<{ category: string; limit: number }> = budgetsData ? JSON.parse(budgetsData) : [];

  // Get savings goals from AsyncStorage
  const goalsData = await AsyncStorage.getItem("@savings_goals");
  const goals: Array<{ currentAmount: number; targetAmount: number }> = goalsData ? JSON.parse(goalsData) : [];

  // Calculate credit score component (0-100)
  const creditScore = creditData.score;
  const creditRating = creditScore >= 800 ? "Excellent" : creditScore >= 740 ? "Very Good" : creditScore >= 670 ? "Good" : creditScore >= 580 ? "Fair" : "Poor";
  const creditComponent = (creditScore / 850) * 100;

  // Calculate net worth component (0-100)
  const netWorthValue = netWorthData; // calculateNetWorth returns number
  const netWorthChange = 0; // Simplified for now
  const netWorthChangePercent = 0; // Simplified for now
  // Normalize net worth to 0-100 scale (assuming $100k is excellent)
  const netWorthComponent = Math.min((Math.max(netWorthValue, 0) / 100000) * 100, 100);

  // Calculate budget adherence component (0-100)
  let budgetComponent = 0;
  let categoriesOnTrack = 0;
  const totalCategories = budgets.length;

  if (totalCategories > 0) {
    // Get spending data from AsyncStorage
    const spendingData = await AsyncStorage.getItem("@spending_by_category");
    const spending: Array<{ category: string; amount: number }> = spendingData ? JSON.parse(spendingData) : [];
    budgets.forEach((budget: any) => {
      const spent = spending.find((s: any) => s.category === budget.category)?.amount || 0;
      const adherence = budget.limit > 0 ? Math.max(0, 100 - (spent / budget.limit) * 100) : 100;
      budgetComponent += adherence;
      if (adherence >= 80) categoriesOnTrack++;
    });
    budgetComponent /= totalCategories;
  } else {
    budgetComponent = 50; // Neutral score if no budgets set
  }

  // Calculate savings progress component (0-100)
  let savingsComponent = 0;
  let goalsOnTrack = 0;
  const totalGoals = goals.length;

  if (totalGoals > 0) {
    goals.forEach((goal: any) => {
      const progress = (goal.currentAmount / goal.targetAmount) * 100;
      savingsComponent += Math.min(progress, 100);
      if (progress >= 75) goalsOnTrack++;
    });
    savingsComponent /= totalGoals;
  } else {
    savingsComponent = 50; // Neutral score if no goals set
  }

  // Calculate debt-to-income ratio component (0-100)
  // Assuming monthly income of $5000 for demo
  const monthlyIncome = 5000;
  const monthlyDebt = 500; // From debt data
  const debtToIncomeRatio = (monthlyDebt / monthlyIncome) * 100;
  const debtComponent = Math.max(0, 100 - debtToIncomeRatio * 2); // Lower is better
  const debtRating =
    debtToIncomeRatio < 20
      ? "Excellent"
      : debtToIncomeRatio < 36
      ? "Good"
      : debtToIncomeRatio < 50
      ? "Fair"
      : "Needs Improvement";

  // Calculate overall health score (weighted average)
  const overallScore =
    creditComponent * 0.25 +
    netWorthComponent * 0.2 +
    budgetComponent * 0.2 +
    savingsComponent * 0.2 +
    debtComponent * 0.15;

  // Determine credit trend (simplified)
  const creditTrend: "up" | "down" | "stable" = "stable";

  return {
    overallScore: Math.round(overallScore),
    creditScore: {
      score: creditScore,
      rating: creditRating,
      trend: creditTrend,
    },
    netWorth: {
      value: netWorthValue,
      change: netWorthChange,
      changePercent: netWorthChangePercent,
    },
    budgetAdherence: {
      score: Math.round(budgetComponent),
      categoriesOnTrack,
      totalCategories,
    },
    savingsProgress: {
      score: Math.round(savingsComponent),
      goalsOnTrack,
      totalGoals,
    },
    debtToIncome: {
      ratio: Math.round(debtToIncomeRatio * 10) / 10,
      rating: debtRating,
    },
  };
}

export async function generateRecommendations(
  metrics: FinancialHealthMetrics
): Promise<HealthRecommendation[]> {
  const recommendations: HealthRecommendation[] = [];

  // Credit score recommendations
  if (metrics.creditScore.score < 700) {
    recommendations.push({
      id: "credit_improve",
      category: "credit",
      priority: "high",
      title: "Improve Credit Score",
      description: `Your credit score of ${metrics.creditScore.score} is ${metrics.creditScore.rating}. Focus on improving it to unlock better rates.`,
      action: "Pay bills on time, reduce credit utilization below 30%, and check for errors on your credit report.",
      potentialImpact: "Could save $5,000+ annually on interest rates",
    });
  }

  // Budget recommendations
  if (metrics.budgetAdherence.score < 70) {
    recommendations.push({
      id: "budget_improve",
      category: "budget",
      priority: "high",
      title: "Improve Budget Adherence",
      description: `Only ${metrics.budgetAdherence.categoriesOnTrack} of ${metrics.budgetAdherence.totalCategories} budget categories are on track.`,
      action: "Review spending in over-budget categories and set up spending alerts to stay on track.",
      potentialImpact: "Could save $500+ monthly by staying within budgets",
    });
  }

  // Savings recommendations
  if (metrics.savingsProgress.score < 50) {
    recommendations.push({
      id: "savings_boost",
      category: "savings",
      priority: "medium",
      title: "Boost Savings Progress",
      description: `Your savings goals are ${Math.round(metrics.savingsProgress.score)}% complete on average.`,
      action: "Set up automatic transfers to savings goals and consider round-up savings rules.",
      potentialImpact: "Reach financial goals 6-12 months faster",
    });
  }

  // Debt recommendations
  if (metrics.debtToIncome.ratio > 36) {
    recommendations.push({
      id: "debt_reduce",
      category: "debt",
      priority: "high",
      title: "Reduce Debt-to-Income Ratio",
      description: `Your debt-to-income ratio of ${metrics.debtToIncome.ratio}% is ${metrics.debtToIncome.rating}.`,
      action: "Focus on paying down high-interest debt first using the avalanche method.",
      potentialImpact: "Could save $2,000+ annually on interest payments",
    });
  }

  // Net worth recommendations
  if (metrics.netWorth.value < 10000) {
    recommendations.push({
      id: "networth_grow",
      category: "investment",
      priority: "medium",
      title: "Grow Your Net Worth",
      description: "Building wealth takes time. Start with small, consistent investments.",
      action: "Invest 10-15% of income in diversified portfolio and maximize employer 401(k) match.",
      potentialImpact: "Could grow wealth by $50,000+ over 10 years",
    });
  }

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return recommendations;
}

export async function getHealthHistory(): Promise<{ date: Date; score: number }[]> {
  const data = await AsyncStorage.getItem(STORAGE_KEY);
  if (!data) return [];
  return JSON.parse(data).map((item: any) => ({
    ...item,
    date: new Date(item.date),
  }));
}

export async function saveHealthSnapshot(score: number): Promise<void> {
  const history = await getHealthHistory();
  history.push({ date: new Date(), score });

  // Keep last 12 months of data
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const filtered = history.filter((item) => item.date >= oneYearAgo);

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

export function getHealthRating(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 60) return "Fair";
  if (score >= 40) return "Needs Improvement";
  return "Critical";
}

export function getHealthColor(score: number): string {
  if (score >= 75) return "success";
  if (score >= 50) return "warning";
  return "error";
}
