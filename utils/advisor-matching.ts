import AsyncStorage from "@react-native-async-storage/async-storage";

export interface FinancialAdvisor {
  id: string;
  name: string;
  firm: string;
  certifications: string[]; // CFP, CFA, etc.
  specializations: string[]; // retirement, estate, tax, etc.
  location: string;
  country: string;
  minNetWorth: number;
  feeStructure: "aum" | "hourly" | "flat" | "commission";
  feePercentage?: number; // for AUM
  hourlyRate?: number;
  rating: number; // 0-5
  reviewCount: number;
  yearsExperience: number;
  bio: string;
  phone: string;
  email: string;
  website?: string;
  availableSlots: ConsultationSlot[];
}

export interface ConsultationSlot {
  id: string;
  advisorId: string;
  date: number;
  duration: number; // minutes
  type: "phone" | "video" | "in_person";
  booked: boolean;
}

export interface AdvisorMatch {
  advisor: FinancialAdvisor;
  matchScore: number; // 0-100
  matchReasons: string[];
}

export interface UserProfile {
  netWorth: number;
  goals: string[]; // retirement, estate, tax, investment, etc.
  location: string;
  country: string;
  preferredFeeStructure?: "aum" | "hourly" | "flat";
  maxFee?: number;
}

export interface Consultation {
  id: string;
  advisorId: string;
  slotId: string;
  userId: string;
  date: number;
  duration: number;
  type: "phone" | "video" | "in_person";
  status: "scheduled" | "completed" | "cancelled";
  notes?: string;
}

const ADVISORS_STORAGE_KEY = "financial_advisors";
const CONSULTATIONS_STORAGE_KEY = "consultations";
const USER_PROFILE_STORAGE_KEY = "advisor_user_profile";

// Sample advisors for demonstration
const SAMPLE_ADVISORS: FinancialAdvisor[] = [
  {
    id: "1",
    name: "Dr. Adebayo Okonkwo",
    firm: "Okonkwo Wealth Management",
    certifications: ["CFP", "CFA"],
    specializations: ["retirement", "estate", "investment"],
    location: "Lagos",
    country: "Nigeria",
    minNetWorth: 50000,
    feeStructure: "aum",
    feePercentage: 1.0,
    rating: 4.8,
    reviewCount: 124,
    yearsExperience: 15,
    bio: "Specializing in retirement and estate planning for high-net-worth individuals across West Africa.",
    phone: "+234 123 456 7890",
    email: "adebayo@okonkwowealth.ng",
    website: "https://okonkwowealth.ng",
    availableSlots: [],
  },
  {
    id: "2",
    name: "Sarah Mwangi",
    firm: "Nairobi Financial Advisors",
    certifications: ["CFP", "MBA"],
    specializations: ["tax", "investment", "business"],
    location: "Nairobi",
    country: "Kenya",
    minNetWorth: 25000,
    feeStructure: "hourly",
    hourlyRate: 150,
    rating: 4.9,
    reviewCount: 89,
    yearsExperience: 12,
    bio: "Expert in tax optimization and investment strategies for entrepreneurs and business owners.",
    phone: "+254 700 123 456",
    email: "sarah@nairobifinancial.ke",
    availableSlots: [],
  },
  {
    id: "3",
    name: "Kwame Asante",
    firm: "Asante Financial Planning",
    certifications: ["CFP"],
    specializations: ["retirement", "debt", "budgeting"],
    location: "Accra",
    country: "Ghana",
    minNetWorth: 10000,
    feeStructure: "flat",
    rating: 4.7,
    reviewCount: 156,
    yearsExperience: 10,
    bio: "Helping families achieve financial security through comprehensive retirement and debt management planning.",
    phone: "+233 20 123 4567",
    email: "kwame@asantefinancial.gh",
    availableSlots: [],
  },
  {
    id: "4",
    name: "Thabo Ndlovu",
    firm: "Ndlovu Wealth Advisors",
    certifications: ["CFP", "CFA", "CAIA"],
    specializations: ["investment", "estate", "retirement"],
    location: "Johannesburg",
    country: "South Africa",
    minNetWorth: 100000,
    feeStructure: "aum",
    feePercentage: 0.75,
    rating: 5.0,
    reviewCount: 67,
    yearsExperience: 20,
    bio: "Premier wealth management for ultra-high-net-worth individuals with complex estate and investment needs.",
    phone: "+27 11 123 4567",
    email: "thabo@ndlovuwealth.co.za",
    website: "https://ndlovuwealth.co.za",
    availableSlots: [],
  },
];

export async function loadAdvisors(): Promise<FinancialAdvisor[]> {
  try {
    const data = await AsyncStorage.getItem(ADVISORS_STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
    // Initialize with sample advisors
    await AsyncStorage.setItem(ADVISORS_STORAGE_KEY, JSON.stringify(SAMPLE_ADVISORS));
    return SAMPLE_ADVISORS;
  } catch (error) {
    console.error("Failed to load advisors:", error);
    return SAMPLE_ADVISORS;
  }
}

export async function loadUserProfile(): Promise<UserProfile | null> {
  try {
    const data = await AsyncStorage.getItem(USER_PROFILE_STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error("Failed to load user profile:", error);
    return null;
  }
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  try {
    await AsyncStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch (error) {
    console.error("Failed to save user profile:", error);
    throw error;
  }
}

export async function matchAdvisors(profile: UserProfile): Promise<AdvisorMatch[]> {
  try {
    const advisors = await loadAdvisors();
    const matches: AdvisorMatch[] = [];

    for (const advisor of advisors) {
      let score = 0;
      const reasons: string[] = [];

      // Location match (20 points)
      if (advisor.country === profile.country) {
        score += 20;
        reasons.push(`Based in ${advisor.country}`);
      }

      // Net worth requirement (20 points)
      if (profile.netWorth >= advisor.minNetWorth) {
        score += 20;
        reasons.push("Meets minimum net worth requirement");
      } else {
        score -= 10;
      }

      // Specialization match (40 points total, 10 per goal)
      const matchingGoals = profile.goals.filter((goal) =>
        advisor.specializations.includes(goal)
      );
      const goalScore = Math.min(40, matchingGoals.length * 10);
      score += goalScore;
      if (matchingGoals.length > 0) {
        reasons.push(`Specializes in ${matchingGoals.join(", ")}`);
      }

      // Fee structure preference (10 points)
      if (profile.preferredFeeStructure && advisor.feeStructure === profile.preferredFeeStructure) {
        score += 10;
        reasons.push(`Offers preferred ${advisor.feeStructure.toUpperCase()} fee structure`);
      }

      // Rating bonus (10 points max)
      score += advisor.rating * 2;
      if (advisor.rating >= 4.5) {
        reasons.push(`Highly rated (${advisor.rating}/5.0)`);
      }

      // Experience bonus (up to 10 points)
      if (advisor.yearsExperience >= 15) {
        score += 10;
        reasons.push(`${advisor.yearsExperience}+ years of experience`);
      } else if (advisor.yearsExperience >= 10) {
        score += 5;
      }

      // Ensure score is between 0 and 100
      score = Math.min(100, Math.max(0, score));

      if (score >= 30) {
        // Only include advisors with reasonable match
        matches.push({
          advisor,
          matchScore: score,
          matchReasons: reasons,
        });
      }
    }

    // Sort by match score descending
    matches.sort((a, b) => b.matchScore - a.matchScore);

    return matches;
  } catch (error) {
    console.error("Failed to match advisors:", error);
    return [];
  }
}

export async function loadConsultations(): Promise<Consultation[]> {
  try {
    const data = await AsyncStorage.getItem(CONSULTATIONS_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("Failed to load consultations:", error);
    return [];
  }
}

export async function bookConsultation(consultation: Consultation): Promise<void> {
  try {
    const consultations = await loadConsultations();
    consultations.push(consultation);
    await AsyncStorage.setItem(CONSULTATIONS_STORAGE_KEY, JSON.stringify(consultations));
  } catch (error) {
    console.error("Failed to book consultation:", error);
    throw error;
  }
}

export async function cancelConsultation(consultationId: string): Promise<void> {
  try {
    const consultations = await loadConsultations();
    const consultation = consultations.find((c) => c.id === consultationId);
    if (consultation) {
      consultation.status = "cancelled";
      await AsyncStorage.setItem(CONSULTATIONS_STORAGE_KEY, JSON.stringify(consultations));
    }
  } catch (error) {
    console.error("Failed to cancel consultation:", error);
    throw error;
  }
}

export function getFeeStructureLabel(structure: FinancialAdvisor["feeStructure"]): string {
  switch (structure) {
    case "aum":
      return "Assets Under Management";
    case "hourly":
      return "Hourly Rate";
    case "flat":
      return "Flat Fee";
    case "commission":
      return "Commission-Based";
  }
}

export function calculateEstimatedFee(advisor: FinancialAdvisor, netWorth: number): string {
  switch (advisor.feeStructure) {
    case "aum":
      if (advisor.feePercentage) {
        const fee = (netWorth * advisor.feePercentage) / 100;
        return `$${fee.toLocaleString()}/year`;
      }
      return "Contact for pricing";
    case "hourly":
      if (advisor.hourlyRate) {
        return `$${advisor.hourlyRate}/hour`;
      }
      return "Contact for pricing";
    case "flat":
      return "Contact for pricing";
    case "commission":
      return "Performance-based";
  }
}

export function getMatchScoreColor(score: number): string {
  if (score >= 80) return "#22C55E"; // success
  if (score >= 60) return "#0a7ea4"; // primary
  if (score >= 40) return "#F59E0B"; // warning
  return "#EF4444"; // error
}

export function getMatchScoreLabel(score: number): string {
  if (score >= 80) return "Excellent Match";
  if (score >= 60) return "Good Match";
  if (score >= 40) return "Fair Match";
  return "Poor Match";
}

export async function generateAvailableSlots(advisorId: string): Promise<ConsultationSlot[]> {
  // Generate sample slots for the next 7 days
  const slots: ConsultationSlot[] = [];
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  for (let day = 1; day <= 7; day++) {
    const date = now + day * dayMs;
    // Morning slot
    slots.push({
      id: `${advisorId}-${day}-morning`,
      advisorId,
      date: date + 9 * 60 * 60 * 1000, // 9 AM
      duration: 60,
      type: "video",
      booked: false,
    });
    // Afternoon slot
    slots.push({
      id: `${advisorId}-${day}-afternoon`,
      advisorId,
      date: date + 14 * 60 * 60 * 1000, // 2 PM
      duration: 60,
      type: "video",
      booked: false,
    });
  }

  return slots;
}
