import AsyncStorage from "@react-native-async-storage/async-storage";

export interface RetirementAccount {
  id: string;
  type: "401k" | "ira_traditional" | "ira_roth" | "pension" | "other";
  name: string;
  balance: number;
  contributionAmount: number;
  contributionFrequency: "monthly" | "biweekly" | "annual";
  employerMatch: number; // percentage
  employerMatchLimit: number; // dollar amount
  returnRate: number; // expected annual return percentage
  date: number;
}

export interface RetirementGoal {
  currentAge: number;
  retirementAge: number;
  currentIncome: number;
  desiredIncomeReplacement: number; // percentage of current income
  inflationRate: number;
  lifeExpectancy: number;
}

export interface RetirementProjection {
  totalSavings: number;
  monthlyIncome: number;
  yearsOfRetirement: number;
  shortfall: number;
  recommendedMonthlyContribution: number;
  projectedBalance: { age: number; balance: number }[];
}

export interface WithdrawalStrategy {
  strategy: "4_percent_rule" | "fixed_dollar" | "rmd" | "bucket";
  monthlyAmount: number;
  taxImplications: string;
  sustainability: "excellent" | "good" | "fair" | "poor";
  yearsUntilDepletion: number;
}

const STORAGE_KEY = "retirement_accounts";
const GOAL_STORAGE_KEY = "retirement_goal";

export async function loadRetirementAccounts(): Promise<RetirementAccount[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("Failed to load retirement accounts:", error);
    return [];
  }
}

export async function saveRetirementAccount(account: RetirementAccount): Promise<void> {
  try {
    const accounts = await loadRetirementAccounts();
    const index = accounts.findIndex((a) => a.id === account.id);
    if (index >= 0) {
      accounts[index] = account;
    } else {
      accounts.push(account);
    }
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
  } catch (error) {
    console.error("Failed to save retirement account:", error);
    throw error;
  }
}

export async function deleteRetirementAccount(accountId: string): Promise<void> {
  try {
    const accounts = await loadRetirementAccounts();
    const filtered = accounts.filter((a) => a.id !== accountId);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error("Failed to delete retirement account:", error);
    throw error;
  }
}

export async function loadRetirementGoal(): Promise<RetirementGoal | null> {
  try {
    const data = await AsyncStorage.getItem(GOAL_STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error("Failed to load retirement goal:", error);
    return null;
  }
}

export async function saveRetirementGoal(goal: RetirementGoal): Promise<void> {
  try {
    await AsyncStorage.setItem(GOAL_STORAGE_KEY, JSON.stringify(goal));
  } catch (error) {
    console.error("Failed to save retirement goal:", error);
    throw error;
  }
}

export function calculateTotalBalance(accounts: RetirementAccount[]): number {
  return accounts.reduce((sum, account) => sum + account.balance, 0);
}

export function calculateAnnualContribution(account: RetirementAccount): number {
  const { contributionAmount, contributionFrequency, employerMatch, employerMatchLimit } = account;

  let annualContribution = 0;
  switch (contributionFrequency) {
    case "monthly":
      annualContribution = contributionAmount * 12;
      break;
    case "biweekly":
      annualContribution = contributionAmount * 26;
      break;
    case "annual":
      annualContribution = contributionAmount;
      break;
  }

  // Add employer match
  const matchAmount = Math.min(annualContribution * (employerMatch / 100), employerMatchLimit);
  return annualContribution + matchAmount;
}

export function calculateTotalAnnualContribution(accounts: RetirementAccount[]): number {
  return accounts.reduce((sum, account) => sum + calculateAnnualContribution(account), 0);
}

export function projectRetirement(
  accounts: RetirementAccount[],
  goal: RetirementGoal
): RetirementProjection {
  const currentBalance = calculateTotalBalance(accounts);
  const annualContribution = calculateTotalAnnualContribution(accounts);
  const yearsUntilRetirement = goal.retirementAge - goal.currentAge;
  const yearsOfRetirement = goal.lifeExpectancy - goal.retirementAge;

  // Calculate average return rate
  const avgReturnRate =
    accounts.reduce((sum, acc) => sum + acc.returnRate * acc.balance, 0) / currentBalance || 7;

  // Project balance at retirement using compound interest formula
  const projectedBalance: { age: number; balance: number }[] = [];
  let balance = currentBalance;

  for (let year = 0; year <= yearsUntilRetirement; year++) {
    const age = goal.currentAge + year;
    projectedBalance.push({ age, balance });

    // Add contributions and growth
    balance = balance * (1 + avgReturnRate / 100) + annualContribution;
  }

  const totalSavings = balance;

  // Calculate required income in retirement (adjusted for inflation)
  const inflationMultiplier = Math.pow(1 + goal.inflationRate / 100, yearsUntilRetirement);
  const futureIncome = goal.currentIncome * inflationMultiplier;
  const desiredAnnualIncome = futureIncome * (goal.desiredIncomeReplacement / 100);
  const monthlyIncome = desiredAnnualIncome / 12;

  // Calculate shortfall using 4% rule
  const sustainableAnnualWithdrawal = totalSavings * 0.04;
  const shortfall = Math.max(0, desiredAnnualIncome - sustainableAnnualWithdrawal);

  // Calculate recommended monthly contribution to close shortfall
  let recommendedMonthlyContribution = annualContribution / 12;
  if (shortfall > 0) {
    // Calculate additional savings needed
    const additionalSavingsNeeded = shortfall / 0.04;
    // Use future value of annuity formula to calculate required monthly contribution
    const monthlyRate = avgReturnRate / 100 / 12;
    const months = yearsUntilRetirement * 12;
    const additionalMonthly =
      (additionalSavingsNeeded * monthlyRate) / (Math.pow(1 + monthlyRate, months) - 1);
    recommendedMonthlyContribution += additionalMonthly;
  }

  return {
    totalSavings,
    monthlyIncome,
    yearsOfRetirement,
    shortfall,
    recommendedMonthlyContribution,
    projectedBalance,
  };
}

export function calculateWithdrawalStrategy(
  totalSavings: number,
  goal: RetirementGoal
): WithdrawalStrategy {
  const yearsOfRetirement = goal.lifeExpectancy - goal.retirementAge;

  // 4% rule
  const fourPercentAnnual = totalSavings * 0.04;
  const fourPercentMonthly = fourPercentAnnual / 12;

  // Determine sustainability
  const sustainableYears = totalSavings / fourPercentAnnual;
  let sustainability: "excellent" | "good" | "fair" | "poor";
  if (sustainableYears >= yearsOfRetirement + 10) {
    sustainability = "excellent";
  } else if (sustainableYears >= yearsOfRetirement) {
    sustainability = "good";
  } else if (sustainableYears >= yearsOfRetirement * 0.75) {
    sustainability = "fair";
  } else {
    sustainability = "poor";
  }

  return {
    strategy: "4_percent_rule",
    monthlyAmount: fourPercentMonthly,
    taxImplications:
      "Traditional 401(k)/IRA withdrawals are taxed as ordinary income. Roth withdrawals are tax-free.",
    sustainability,
    yearsUntilDepletion: sustainableYears,
  };
}

export function getAccountTypeLabel(type: RetirementAccount["type"]): string {
  switch (type) {
    case "401k":
      return "401(k)";
    case "ira_traditional":
      return "Traditional IRA";
    case "ira_roth":
      return "Roth IRA";
    case "pension":
      return "Pension";
    case "other":
      return "Other";
  }
}

export function getAccountTypeIcon(type: RetirementAccount["type"]): string {
  switch (type) {
    case "401k":
      return "💼";
    case "ira_traditional":
      return "🏦";
    case "ira_roth":
      return "💰";
    case "pension":
      return "🎯";
    case "other":
      return "📊";
  }
}

export function calculateRMD(balance: number, age: number): number {
  // Required Minimum Distribution calculation based on IRS Uniform Lifetime Table
  const distributionPeriods: Record<number, number> = {
    72: 27.4,
    73: 26.5,
    74: 25.5,
    75: 24.6,
    76: 23.7,
    77: 22.9,
    78: 22.0,
    79: 21.1,
    80: 20.2,
    81: 19.4,
    82: 18.5,
    83: 17.7,
    84: 16.8,
    85: 16.0,
  };

  const period = distributionPeriods[age] || 16.0;
  return balance / period;
}
