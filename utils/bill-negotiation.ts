import AsyncStorage from "@react-native-async-storage/async-storage";

export interface RecurringBill {
  id: string;
  provider: string;
  category: "internet" | "phone" | "insurance" | "utilities" | "subscription";
  amount: number;
  frequency: "monthly" | "quarterly" | "annual";
  lastPaid: number;
  autoRenew: boolean;
}

export interface NegotiationOpportunity {
  billId: string;
  provider: string;
  category: string;
  currentAmount: number;
  potentialSavings: number;
  savingsPercent: number;
  negotiationDifficulty: "easy" | "medium" | "hard";
  bestTimeToCall: string;
  script: string;
  tips: string[];
  alternativeProviders?: Array<{
    name: string;
    price: number;
    features: string[];
  }>;
}

export interface NegotiationResult {
  billId: string;
  provider: string;
  originalAmount: number;
  newAmount: number;
  savings: number;
  negotiatedAt: number;
  notes: string;
}

const BILLS_KEY = "recurring_bills";
const NEGOTIATION_RESULTS_KEY = "negotiation_results";

/**
 * Analyze recurring bills for negotiation opportunities
 */
export async function analyzeBillsForNegotiation(
  bills: RecurringBill[]
): Promise<NegotiationOpportunity[]> {
  const opportunities: NegotiationOpportunity[] = [];

  for (const bill of bills) {
    const opportunity = analyzeIndividualBill(bill);
    if (opportunity) {
      opportunities.push(opportunity);
    }
  }

  // Sort by potential savings (highest first)
  return opportunities.sort((a, b) => b.potentialSavings - a.potentialSavings);
}

/**
 * Analyze individual bill for negotiation potential
 */
function analyzeIndividualBill(bill: RecurringBill): NegotiationOpportunity | null {
  const { category, amount, provider } = bill;

  // Calculate potential savings based on category and amount
  let savingsPercent = 0;
  let difficulty: "easy" | "medium" | "hard" = "medium";

  switch (category) {
    case "internet":
      savingsPercent = amount > 80 ? 25 : 15;
      difficulty = "easy";
      break;
    case "phone":
      savingsPercent = amount > 60 ? 30 : 20;
      difficulty = "easy";
      break;
    case "insurance":
      savingsPercent = amount > 200 ? 20 : 10;
      difficulty = "medium";
      break;
    case "utilities":
      savingsPercent = amount > 150 ? 15 : 8;
      difficulty = "hard";
      break;
    case "subscription":
      savingsPercent = amount > 20 ? 50 : 25;
      difficulty = "easy";
      break;
  }

  const potentialSavings = amount * (savingsPercent / 100);

  // Only suggest negotiation if savings are meaningful
  if (potentialSavings < 5) {
    return null;
  }

  return {
    billId: bill.id,
    provider,
    category,
    currentAmount: amount,
    potentialSavings,
    savingsPercent,
    negotiationDifficulty: difficulty,
    bestTimeToCall: getBestTimeToCall(category),
    script: generateNegotiationScript(bill, savingsPercent),
    tips: getNegotiationTips(category),
    alternativeProviders: getAlternativeProviders(category),
  };
}

/**
 * Get best time to call for negotiation
 */
function getBestTimeToCall(category: string): string {
  const times: Record<string, string> = {
    internet: "Weekdays 9-11 AM or 2-4 PM (avoid lunch hour)",
    phone: "Weekdays 10 AM-12 PM or 3-5 PM",
    insurance: "Weekdays 10 AM-2 PM (avoid month-end)",
    utilities: "Weekdays 8-10 AM or 2-4 PM",
    subscription: "Anytime during business hours",
  };

  return times[category] || "Weekdays during business hours";
}

/**
 * Generate negotiation script
 */
function generateNegotiationScript(bill: RecurringBill, savingsPercent: number): string {
  const { provider, category, amount } = bill;
  const targetAmount = amount * (1 - savingsPercent / 100);

  const scripts: Record<string, string> = {
    internet: `Hi, I'm a long-time customer and I'm reviewing my expenses. I've been paying $${amount}/month for internet service, but I've seen promotional rates as low as $${targetAmount.toFixed(2)} for new customers. I'd like to stay with ${provider}, but I need a better rate. Can you match the promotional pricing or offer me a loyalty discount?`,

    phone: `Hello, I've been a ${provider} customer for a while and I'm looking at my phone bill of $${amount}/month. I've received offers from competitors for similar service at $${targetAmount.toFixed(2)}/month. I prefer to stay with ${provider}, but I need you to match or beat that rate. What can you do for me?`,

    insurance: `Hi, I'm calling about my ${category} policy. I'm currently paying $${amount}, but I've gotten quotes from other providers that are significantly lower. I've been a loyal customer and I'd like to stay, but I need a better rate. Can you review my policy and see if there are any discounts I'm missing or ways to reduce my premium?`,

    utilities: `Hello, I'm reviewing my utility bills and noticed I'm paying $${amount}/month. Are there any programs, off-peak rates, or energy-saving incentives that could help me reduce this cost? I'm also interested in budget billing if that would help stabilize my payments.`,

    subscription: `Hi, I'm calling about my subscription. I'm currently paying $${amount}/month, but I'm considering canceling because it's outside my budget. Before I do that, are there any promotional rates, discounts, or lower-tier plans that would work better for me?`,
  };

  return scripts[category] || `I'm calling about my ${category} service with ${provider}. I'm currently paying $${amount}, but I'd like to discuss options for reducing this cost.`;
}

/**
 * Get negotiation tips for category
 */
function getNegotiationTips(category: string): string[] {
  const tips: Record<string, string[]> = {
    internet: [
      "Mention competitor offers specifically (e.g., 'Comcast is offering...')",
      "Ask for the retention or loyalty department",
      "Be prepared to cancel if they don't budge",
      "Bundle services (internet + TV) for better rates",
      "Ask about promotional rates for existing customers",
    ],
    phone: [
      "Review your data usage before calling - you might be overpaying",
      "Mention you're considering switching to a competitor",
      "Ask about family or multi-line discounts",
      "Request autopay and paperless billing discounts",
      "Be polite but firm - retention specialists have flexibility",
    ],
    insurance: [
      "Get quotes from 3-4 competitors before calling",
      "Ask about all available discounts (bundling, safe driver, etc.)",
      "Increase your deductible to lower premiums",
      "Review your coverage - you might be over-insured",
      "Ask about usage-based insurance programs",
    ],
    utilities: [
      "Ask about budget billing to avoid seasonal spikes",
      "Inquire about time-of-use rates if you can shift usage",
      "Request a home energy audit (often free)",
      "Ask about renewable energy programs",
      "Check if you qualify for low-income assistance programs",
    ],
    subscription: [
      "Threaten to cancel - they'll often offer a discount",
      "Ask about annual plans (usually cheaper than monthly)",
      "Look for family or group plans",
      "Check if your employer or credit card offers discounts",
      "Downgrade to a lower tier if you don't use all features",
    ],
  };

  return tips[category] || [
    "Be polite but persistent",
    "Have competitor prices ready",
    "Ask to speak to retention specialists",
    "Be prepared to walk away",
  ];
}

/**
 * Get alternative providers
 */
function getAlternativeProviders(
  category: string
): Array<{ name: string; price: number; features: string[] }> {
  const alternatives: Record<
    string,
    Array<{ name: string; price: number; features: string[] }>
  > = {
    internet: [
      {
        name: "Google Fiber",
        price: 70,
        features: ["1 Gbps speed", "No data caps", "No contracts"],
      },
      {
        name: "Xfinity",
        price: 55,
        features: ["300 Mbps speed", "Free modem", "12-month promo"],
      },
      {
        name: "AT&T Fiber",
        price: 65,
        features: ["500 Mbps speed", "No equipment fees", "HBO Max included"],
      },
    ],
    phone: [
      {
        name: "Mint Mobile",
        price: 30,
        features: ["Unlimited talk/text", "10GB data", "Prepaid"],
      },
      {
        name: "Visible",
        price: 40,
        features: ["Unlimited everything", "Verizon network", "No contracts"],
      },
      {
        name: "Google Fi",
        price: 50,
        features: ["Flexible data", "International coverage", "Multi-network"],
      },
    ],
    insurance: [
      {
        name: "Geico",
        price: 120,
        features: ["15% online discount", "Good driver discount", "24/7 service"],
      },
      {
        name: "Progressive",
        price: 115,
        features: ["Name Your Price tool", "Snapshot discount", "Bundle savings"],
      },
      {
        name: "State Farm",
        price: 125,
        features: ["Local agent", "Drive Safe discount", "Multi-policy discount"],
      },
    ],
    subscription: [
      {
        name: "Free Tier",
        price: 0,
        features: ["Basic features", "Ad-supported", "Limited access"],
      },
      {
        name: "Student Plan",
        price: 5,
        features: ["50% discount", "Full features", "Verification required"],
      },
      {
        name: "Annual Plan",
        price: 8,
        features: ["2 months free", "Full features", "Paid yearly"],
      },
    ],
  };

  return alternatives[category] || [];
}

/**
 * Save recurring bills
 */
export async function saveRecurringBills(bills: RecurringBill[]): Promise<void> {
  try {
    await AsyncStorage.setItem(BILLS_KEY, JSON.stringify(bills));
  } catch (error) {
    console.error("Failed to save recurring bills:", error);
    throw error;
  }
}

/**
 * Load recurring bills
 */
export async function loadRecurringBills(): Promise<RecurringBill[]> {
  try {
    const data = await AsyncStorage.getItem(BILLS_KEY);
    return data ? JSON.parse(data) : getMockBills();
  } catch (error) {
    console.error("Failed to load recurring bills:", error);
    return getMockBills();
  }
}

/**
 * Get mock bills for demonstration
 */
function getMockBills(): RecurringBill[] {
  return [
    {
      id: "1",
      provider: "Comcast Xfinity",
      category: "internet",
      amount: 89.99,
      frequency: "monthly",
      lastPaid: Date.now() - 15 * 24 * 60 * 60 * 1000,
      autoRenew: true,
    },
    {
      id: "2",
      provider: "Verizon",
      category: "phone",
      amount: 75.0,
      frequency: "monthly",
      lastPaid: Date.now() - 10 * 24 * 60 * 60 * 1000,
      autoRenew: true,
    },
    {
      id: "3",
      provider: "State Farm",
      category: "insurance",
      amount: 150.0,
      frequency: "monthly",
      lastPaid: Date.now() - 20 * 24 * 60 * 60 * 1000,
      autoRenew: true,
    },
    {
      id: "4",
      provider: "Netflix",
      category: "subscription",
      amount: 15.99,
      frequency: "monthly",
      lastPaid: Date.now() - 5 * 24 * 60 * 60 * 1000,
      autoRenew: true,
    },
  ];
}

/**
 * Save negotiation result
 */
export async function saveNegotiationResult(result: NegotiationResult): Promise<void> {
  try {
    const existing = await loadNegotiationResults();
    existing.push(result);
    await AsyncStorage.setItem(NEGOTIATION_RESULTS_KEY, JSON.stringify(existing));
  } catch (error) {
    console.error("Failed to save negotiation result:", error);
    throw error;
  }
}

/**
 * Load negotiation results
 */
export async function loadNegotiationResults(): Promise<NegotiationResult[]> {
  try {
    const data = await AsyncStorage.getItem(NEGOTIATION_RESULTS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("Failed to load negotiation results:", error);
    return [];
  }
}

/**
 * Calculate total savings from negotiations
 */
export async function calculateTotalSavings(): Promise<{
  totalSavings: number;
  monthlySavings: number;
  annualSavings: number;
  negotiationCount: number;
}> {
  const results = await loadNegotiationResults();

  const totalSavings = results.reduce((sum, result) => sum + result.savings, 0);
  const negotiationCount = results.length;

  // Estimate monthly and annual savings
  const monthlySavings = totalSavings;
  const annualSavings = monthlySavings * 12;

  return {
    totalSavings,
    monthlySavings,
    annualSavings,
    negotiationCount,
  };
}

/**
 * Get negotiation success rate
 */
export async function getNegotiationSuccessRate(): Promise<number> {
  const results = await loadNegotiationResults();

  if (results.length === 0) {
    return 0;
  }

  const successful = results.filter((r) => r.savings > 0).length;
  return (successful / results.length) * 100;
}
