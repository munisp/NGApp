import AsyncStorage from "@react-native-async-storage/async-storage";

export interface Debt {
  id: string;
  name: string;
  type: "credit_card" | "student_loan" | "car_loan" | "personal_loan" | "mortgage" | "other";
  balance: number;
  interestRate: number;
  minimumPayment: number;
  dueDate: number;
}

export interface PayoffStrategy {
  strategy: "snowball" | "avalanche" | "custom";
  monthlyPayment: number;
  debts: Debt[];
}

export interface PayoffPlan {
  strategy: "snowball" | "avalanche";
  totalMonths: number;
  totalInterestPaid: number;
  totalAmountPaid: number;
  monthlyBreakdown: MonthlyPayment[];
  debtPayoffOrder: string[];
}

export interface MonthlyPayment {
  month: number;
  date: number;
  payments: Array<{
    debtId: string;
    debtName: string;
    payment: number;
    principalPaid: number;
    interestPaid: number;
    remainingBalance: number;
  }>;
  totalPayment: number;
  totalInterestPaid: number;
  totalRemainingBalance: number;
}

const DEBTS_KEY = "debts";
const PAYOFF_STRATEGY_KEY = "payoff_strategy";

/**
 * Save debts
 */
export async function saveDebts(debts: Debt[]): Promise<void> {
  try {
    await AsyncStorage.setItem(DEBTS_KEY, JSON.stringify(debts));
  } catch (error) {
    console.error("Failed to save debts:", error);
    throw error;
  }
}

/**
 * Load debts
 */
export async function loadDebts(): Promise<Debt[]> {
  try {
    const data = await AsyncStorage.getItem(DEBTS_KEY);
    return data ? JSON.parse(data) : getMockDebts();
  } catch (error) {
    console.error("Failed to load debts:", error);
    return getMockDebts();
  }
}

/**
 * Get mock debts for demonstration
 */
function getMockDebts(): Debt[] {
  return [
    {
      id: "1",
      name: "Credit Card 1",
      type: "credit_card",
      balance: 5000,
      interestRate: 18.99,
      minimumPayment: 150,
      dueDate: Date.now() + 15 * 24 * 60 * 60 * 1000,
    },
    {
      id: "2",
      name: "Credit Card 2",
      type: "credit_card",
      balance: 3000,
      interestRate: 22.99,
      minimumPayment: 90,
      dueDate: Date.now() + 20 * 24 * 60 * 60 * 1000,
    },
    {
      id: "3",
      name: "Student Loan",
      type: "student_loan",
      balance: 25000,
      interestRate: 6.5,
      minimumPayment: 300,
      dueDate: Date.now() + 10 * 24 * 60 * 60 * 1000,
    },
    {
      id: "4",
      name: "Car Loan",
      type: "car_loan",
      balance: 15000,
      interestRate: 4.5,
      minimumPayment: 350,
      dueDate: Date.now() + 25 * 24 * 60 * 60 * 1000,
    },
  ];
}

/**
 * Calculate debt payoff plan using snowball method (smallest balance first)
 */
export function calculateSnowballPlan(debts: Debt[], monthlyPayment: number): PayoffPlan {
  // Sort debts by balance (smallest first)
  const sortedDebts = [...debts].sort((a, b) => a.balance - b.balance);
  return calculatePayoffPlan(sortedDebts, monthlyPayment, "snowball");
}

/**
 * Calculate debt payoff plan using avalanche method (highest interest rate first)
 */
export function calculateAvalanchePlan(debts: Debt[], monthlyPayment: number): PayoffPlan {
  // Sort debts by interest rate (highest first)
  const sortedDebts = [...debts].sort((a, b) => b.interestRate - a.interestRate);
  return calculatePayoffPlan(sortedDebts, monthlyPayment, "avalanche");
}

/**
 * Calculate debt payoff plan
 */
function calculatePayoffPlan(
  sortedDebts: Debt[],
  monthlyPayment: number,
  strategy: "snowball" | "avalanche"
): PayoffPlan {
  // Create working copy of debts with remaining balances
  const workingDebts = sortedDebts.map((debt) => ({
    ...debt,
    remainingBalance: debt.balance,
    isPaidOff: false,
  }));

  const monthlyBreakdown: MonthlyPayment[] = [];
  let month = 0;
  let totalInterestPaid = 0;
  const debtPayoffOrder: string[] = [];

  // Calculate total minimum payments
  const totalMinimumPayment = workingDebts.reduce((sum, debt) => sum + debt.minimumPayment, 0);

  if (monthlyPayment < totalMinimumPayment) {
    // Not enough to cover minimum payments
    throw new Error(
      `Monthly payment ($${monthlyPayment}) is less than total minimum payments ($${totalMinimumPayment.toFixed(2)})`
    );
  }

  // Calculate payoff month by month
  while (workingDebts.some((debt) => !debt.isPaidOff)) {
    month++;
    const monthDate = Date.now() + month * 30 * 24 * 60 * 60 * 1000;

    let remainingPayment = monthlyPayment;
    const monthPayments: MonthlyPayment["payments"] = [];
    let monthTotalInterest = 0;

    // First, pay minimum on all debts
    for (const debt of workingDebts) {
      if (debt.isPaidOff) {
        monthPayments.push({
          debtId: debt.id,
          debtName: debt.name,
          payment: 0,
          principalPaid: 0,
          interestPaid: 0,
          remainingBalance: 0,
        });
        continue;
      }

      const monthlyInterestRate = debt.interestRate / 100 / 12;
      const interestCharge = debt.remainingBalance * monthlyInterestRate;
      const minimumPayment = Math.min(debt.minimumPayment, debt.remainingBalance + interestCharge);
      const principalPaid = Math.max(0, minimumPayment - interestCharge);

      debt.remainingBalance -= principalPaid;
      remainingPayment -= minimumPayment;
      monthTotalInterest += interestCharge;

      monthPayments.push({
        debtId: debt.id,
        debtName: debt.name,
        payment: minimumPayment,
        principalPaid,
        interestPaid: interestCharge,
        remainingBalance: Math.max(0, debt.remainingBalance),
      });

      if (debt.remainingBalance <= 0) {
        debt.isPaidOff = true;
        if (!debtPayoffOrder.includes(debt.id)) {
          debtPayoffOrder.push(debt.id);
        }
      }
    }

    // Apply extra payment to first non-paid-off debt
    if (remainingPayment > 0) {
      const targetDebt = workingDebts.find((debt) => !debt.isPaidOff);

      if (targetDebt) {
        const extraPayment = Math.min(remainingPayment, targetDebt.remainingBalance);
        targetDebt.remainingBalance -= extraPayment;

        // Update the payment record
        const paymentRecord = monthPayments.find((p) => p.debtId === targetDebt.id);
        if (paymentRecord) {
          paymentRecord.payment += extraPayment;
          paymentRecord.principalPaid += extraPayment;
          paymentRecord.remainingBalance = Math.max(0, targetDebt.remainingBalance);
        }

        if (targetDebt.remainingBalance <= 0) {
          targetDebt.isPaidOff = true;
          if (!debtPayoffOrder.includes(targetDebt.id)) {
            debtPayoffOrder.push(targetDebt.id);
          }
        }
      }
    }

    totalInterestPaid += monthTotalInterest;

    const totalRemainingBalance = workingDebts.reduce(
      (sum, debt) => sum + (debt.isPaidOff ? 0 : debt.remainingBalance),
      0
    );

    monthlyBreakdown.push({
      month,
      date: monthDate,
      payments: monthPayments,
      totalPayment: monthPayments.reduce((sum, p) => sum + p.payment, 0),
      totalInterestPaid: monthTotalInterest,
      totalRemainingBalance,
    });

    // Safety check to prevent infinite loops
    if (month > 600) {
      // 50 years
      break;
    }
  }

  const totalAmountPaid = monthlyPayment * month;

  return {
    strategy,
    totalMonths: month,
    totalInterestPaid,
    totalAmountPaid,
    monthlyBreakdown,
    debtPayoffOrder,
  };
}

/**
 * Compare snowball vs avalanche strategies
 */
export function compareStrategies(
  debts: Debt[],
  monthlyPayment: number
): {
  snowball: PayoffPlan;
  avalanche: PayoffPlan;
  comparison: {
    monthsDifference: number;
    interestSavings: number;
    recommendation: "snowball" | "avalanche";
    reason: string;
  };
} {
  const snowball = calculateSnowballPlan(debts, monthlyPayment);
  const avalanche = calculateAvalanchePlan(debts, monthlyPayment);

  const monthsDifference = snowball.totalMonths - avalanche.totalMonths;
  const interestSavings = snowball.totalInterestPaid - avalanche.totalInterestPaid;

  let recommendation: "snowball" | "avalanche";
  let reason: string;

  if (Math.abs(interestSavings) < 100 || Math.abs(monthsDifference) <= 2) {
    // If difference is minimal, recommend snowball for psychological wins
    recommendation = "snowball";
    reason =
      "Both methods are similar in cost. Snowball is recommended for quick wins and motivation.";
  } else if (interestSavings > 500) {
    // If avalanche saves significant interest
    recommendation = "avalanche";
    reason = `Avalanche saves $${interestSavings.toFixed(0)} in interest and pays off debt ${Math.abs(monthsDifference)} months faster.`;
  } else {
    // Default to snowball for psychological benefits
    recommendation = "snowball";
    reason =
      "Snowball provides quick wins by paying off smaller debts first, which can boost motivation.";
  }

  return {
    snowball,
    avalanche,
    comparison: {
      monthsDifference,
      interestSavings,
      recommendation,
      reason,
    },
  };
}

/**
 * Calculate debt-free date
 */
export function calculateDebtFreeDate(plan: PayoffPlan): Date {
  const now = new Date();
  const debtFreeDate = new Date(now.getTime() + plan.totalMonths * 30 * 24 * 60 * 60 * 1000);
  return debtFreeDate;
}

/**
 * Calculate total debt
 */
export function calculateTotalDebt(debts: Debt[]): number {
  return debts.reduce((sum, debt) => sum + debt.balance, 0);
}

/**
 * Calculate total minimum payment
 */
export function calculateTotalMinimumPayment(debts: Debt[]): number {
  return debts.reduce((sum, debt) => sum + debt.minimumPayment, 0);
}

/**
 * Save payoff strategy
 */
export async function savePayoffStrategy(strategy: PayoffStrategy): Promise<void> {
  try {
    await AsyncStorage.setItem(PAYOFF_STRATEGY_KEY, JSON.stringify(strategy));
  } catch (error) {
    console.error("Failed to save payoff strategy:", error);
    throw error;
  }
}

/**
 * Load payoff strategy
 */
export async function loadPayoffStrategy(): Promise<PayoffStrategy | null> {
  try {
    const data = await AsyncStorage.getItem(PAYOFF_STRATEGY_KEY);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error("Failed to load payoff strategy:", error);
    return null;
  }
}

/**
 * Get debt type icon
 */
export function getDebtTypeIcon(type: Debt["type"]): string {
  const icons: Record<Debt["type"], string> = {
    credit_card: "💳",
    student_loan: "🎓",
    car_loan: "🚗",
    personal_loan: "💰",
    mortgage: "🏠",
    other: "📄",
  };

  return icons[type] || "📄";
}

/**
 * Get debt type label
 */
export function getDebtTypeLabel(type: Debt["type"]): string {
  const labels: Record<Debt["type"], string> = {
    credit_card: "Credit Card",
    student_loan: "Student Loan",
    car_loan: "Car Loan",
    personal_loan: "Personal Loan",
    mortgage: "Mortgage",
    other: "Other",
  };

  return labels[type] || "Other";
}
