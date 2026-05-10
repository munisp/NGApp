/**
 * E5: Customer onboarding workflow with BVN/NIN verification.
 * Tier-based KYC with progressive verification, risk scoring,
 * and automated account creation.
 */

export interface OnboardingApplication {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  dateOfBirth: string;
  gender: "male" | "female";
  email: string;
  phone: string;
  bvn: string;
  nin?: string;
  address: string;
  lga: string;
  state: string;
  nationality: string;
  employmentStatus: "employed" | "self_employed" | "student" | "retired" | "unemployed";
  productType: "savings" | "current" | "domiciliary" | "fixed_deposit";
  tier: "Tier 1" | "Tier 2" | "Tier 3";
  status: "draft" | "bvn_pending" | "bvn_verified" | "nin_pending" | "nin_verified" | "documents_pending" | "under_review" | "approved" | "rejected";
  riskScore: number;
  bvnVerified: boolean;
  ninVerified: boolean;
  livenessCheckPassed: boolean;
  documentVerified: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  accountNumber?: string;
  rejectionReason?: string;
}

const applications: OnboardingApplication[] = [
  {
    id: "OB-001", firstName: "Amina", lastName: "Yusuf", middleName: "Halima",
    dateOfBirth: "1992-03-15", gender: "female", email: "amina.yusuf@gmail.com", phone: "+2348012345678",
    bvn: "22345678901", nin: "12345678901234", address: "15 Aminu Kano Crescent, Wuse 2",
    lga: "Wuse", state: "FCT Abuja", nationality: "Nigerian",
    employmentStatus: "employed", productType: "savings", tier: "Tier 3",
    status: "approved", riskScore: 15, bvnVerified: true, ninVerified: true,
    livenessCheckPassed: true, documentVerified: true,
    createdAt: "2026-05-08T09:00:00Z", updatedAt: "2026-05-08T14:00:00Z",
    completedAt: "2026-05-08T14:00:00Z", accountNumber: "5400001234",
  },
  {
    id: "OB-002", firstName: "Chinedu", lastName: "Okeke",
    dateOfBirth: "1988-07-22", gender: "male", email: "chinedu.o@outlook.com", phone: "+2349098765432",
    bvn: "33456789012", address: "42 Allen Avenue, Ikeja",
    lga: "Ikeja", state: "Lagos", nationality: "Nigerian",
    employmentStatus: "self_employed", productType: "current", tier: "Tier 2",
    status: "documents_pending", riskScore: 35, bvnVerified: true, ninVerified: false,
    livenessCheckPassed: true, documentVerified: false,
    createdAt: "2026-05-09T10:00:00Z", updatedAt: "2026-05-09T11:00:00Z",
  },
  {
    id: "OB-003", firstName: "Fatimah", lastName: "Abdullahi",
    dateOfBirth: "2000-11-03", gender: "female", email: "fatimah.a@yahoo.com", phone: "+2347055551234",
    bvn: "44567890123", address: "8 Bello Road, Kano",
    lga: "Nassarawa", state: "Kano", nationality: "Nigerian",
    employmentStatus: "student", productType: "savings", tier: "Tier 1",
    status: "bvn_verified", riskScore: 10, bvnVerified: true, ninVerified: false,
    livenessCheckPassed: false, documentVerified: false,
    createdAt: "2026-05-09T13:00:00Z", updatedAt: "2026-05-09T13:30:00Z",
  },
  {
    id: "OB-004", firstName: "Oluwaseun", lastName: "Adebayo",
    dateOfBirth: "1975-01-20", gender: "male", email: "oluwaseun@corporate.ng", phone: "+2348033334444",
    bvn: "55678901234", nin: "56789012345678", address: "Plot 1234, Victoria Island",
    lga: "Eti-Osa", state: "Lagos", nationality: "Nigerian",
    employmentStatus: "employed", productType: "domiciliary", tier: "Tier 3",
    status: "rejected", riskScore: 72, bvnVerified: true, ninVerified: true,
    livenessCheckPassed: true, documentVerified: false,
    createdAt: "2026-05-07T08:00:00Z", updatedAt: "2026-05-07T16:00:00Z",
    rejectionReason: "PEP flag — additional due diligence required per CBN circular",
  },
];

export function getOnboardingApplications() { return applications; }

export function validateBVN(bvn: string): { valid: boolean; reason?: string } {
  if (!/^\d{11}$/.test(bvn)) return { valid: false, reason: "BVN must be exactly 11 digits" };
  return { valid: true };
}

export function validateNIN(nin: string): { valid: boolean; reason?: string } {
  if (!/^\d{11}$/.test(nin)) return { valid: false, reason: "NIN must be exactly 11 digits" };
  return { valid: true };
}

export function calculateOnboardingRisk(app: { employmentStatus: string; tier: string; bvnVerified: boolean; ninVerified: boolean }): number {
  let score = 0;
  if (!app.bvnVerified) score += 30;
  if (!app.ninVerified) score += 20;
  if (app.employmentStatus === "unemployed") score += 15;
  if (app.tier === "Tier 3" && !app.ninVerified) score += 10;
  return Math.min(score, 100);
}
