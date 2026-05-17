import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";

type OnboardingStage = "application" | "document_review" | "compliance_check" | "branding_setup" | "technical_integration" | "testing" | "go_live" | "active";
interface PartnerApplication {
  id: string; companyName: string; contactName: string; email: string; phone: string;
  businessType: string; registrationNumber: string; taxId: string; country: string; state: string;
  stage: OnboardingStage; submittedAt: string; updatedAt: string; assignedReviewer: string;
  documents: { type: string; status: string; uploadedAt: string }[];
  complianceChecks: { check: string; status: string; completedAt: string }[];
  brandingConfig: { primaryColor: string; secondaryColor: string; logo: string; domain: string; appName: string };
  technicalConfig: { apiKeyGenerated: boolean; webhookUrl: string; sandboxReady: boolean; sdkIntegrated: boolean };
  slaDeadline: string; riskScore: number; approvalHistory: { action: string; by: string; at: string; notes: string }[];
}

const partnerApplications: PartnerApplication[] = [
  {
    id: "WL-001", companyName: "PayFast Nigeria Ltd", contactName: "Adebayo Ogunlesi", email: "adebayo@payfast.ng",
    phone: "+234-801-234-5678", businessType: "fintech", registrationNumber: "RC-1234567", taxId: "TIN-98765432",
    country: "Nigeria", state: "Lagos", stage: "branding_setup", submittedAt: "2026-03-15T10:00:00Z",
    updatedAt: "2026-04-18T14:30:00Z", assignedReviewer: "admin@54link.com",
    documents: [
      { type: "Certificate of Incorporation", status: "approved", uploadedAt: "2026-03-15T10:05:00Z" },
      { type: "CAC Form", status: "approved", uploadedAt: "2026-03-15T10:10:00Z" },
      { type: "Tax Clearance Certificate", status: "approved", uploadedAt: "2026-03-16T09:00:00Z" },
      { type: "Board Resolution", status: "approved", uploadedAt: "2026-03-16T09:30:00Z" },
      { type: "AML/CFT Policy", status: "approved", uploadedAt: "2026-03-17T11:00:00Z" },
    ],
    complianceChecks: [
      { check: "KYB Verification", status: "passed", completedAt: "2026-03-20T12:00:00Z" },
      { check: "AML Screening", status: "passed", completedAt: "2026-03-21T10:00:00Z" },
      { check: "PEP Check", status: "passed", completedAt: "2026-03-21T11:00:00Z" },
      { check: "Sanctions Screening", status: "passed", completedAt: "2026-03-22T09:00:00Z" },
      { check: "CBN License Verification", status: "passed", completedAt: "2026-03-23T14:00:00Z" },
    ],
    brandingConfig: { primaryColor: "#1E40AF", secondaryColor: "#3B82F6", logo: "", domain: "payfast.54link.com", appName: "PayFast POS" },
    technicalConfig: { apiKeyGenerated: true, webhookUrl: "https://api.payfast.ng/webhooks/54link", sandboxReady: true, sdkIntegrated: false },
    slaDeadline: "2026-04-30T23:59:59Z", riskScore: 15,
    approvalHistory: [
      { action: "submitted", by: "adebayo@payfast.ng", at: "2026-03-15T10:00:00Z", notes: "Initial application submitted" },
      { action: "documents_approved", by: "admin@54link.com", at: "2026-03-18T16:00:00Z", notes: "All documents verified" },
      { action: "compliance_passed", by: "compliance@54link.com", at: "2026-03-23T15:00:00Z", notes: "All checks passed" },
      { action: "branding_started", by: "adebayo@payfast.ng", at: "2026-04-01T09:00:00Z", notes: "Branding configuration initiated" },
    ],
  },
  {
    id: "WL-002", companyName: "QuickPay Solutions", contactName: "Chioma Eze", email: "chioma@quickpay.com.ng",
    phone: "+234-802-345-6789", businessType: "agency_banking", registrationNumber: "RC-2345678", taxId: "TIN-87654321",
    country: "Nigeria", state: "Abuja", stage: "document_review", submittedAt: "2026-04-10T08:00:00Z",
    updatedAt: "2026-04-15T11:00:00Z", assignedReviewer: "reviewer@54link.com",
    documents: [
      { type: "Certificate of Incorporation", status: "approved", uploadedAt: "2026-04-10T08:05:00Z" },
      { type: "CAC Form", status: "pending", uploadedAt: "2026-04-10T08:10:00Z" },
      { type: "Tax Clearance Certificate", status: "pending", uploadedAt: "2026-04-11T09:00:00Z" },
    ],
    complianceChecks: [],
    brandingConfig: { primaryColor: "#059669", secondaryColor: "#10B981", logo: "", domain: "", appName: "" },
    technicalConfig: { apiKeyGenerated: false, webhookUrl: "", sandboxReady: false, sdkIntegrated: false },
    slaDeadline: "2026-05-10T23:59:59Z", riskScore: 0,
    approvalHistory: [
      { action: "submitted", by: "chioma@quickpay.com.ng", at: "2026-04-10T08:00:00Z", notes: "Application submitted" },
    ],
  },
  {
    id: "WL-003", companyName: "MobileMoney Express", contactName: "Ibrahim Musa", email: "ibrahim@mobilemoney.ng",
    phone: "+234-803-456-7890", businessType: "mobile_money", registrationNumber: "RC-3456789", taxId: "TIN-76543210",
    country: "Nigeria", state: "Kano", stage: "active", submittedAt: "2026-01-05T10:00:00Z",
    updatedAt: "2026-02-28T16:00:00Z", assignedReviewer: "admin@54link.com",
    documents: [
      { type: "Certificate of Incorporation", status: "approved", uploadedAt: "2026-01-05T10:05:00Z" },
      { type: "CAC Form", status: "approved", uploadedAt: "2026-01-05T10:10:00Z" },
      { type: "Tax Clearance Certificate", status: "approved", uploadedAt: "2026-01-06T09:00:00Z" },
      { type: "Board Resolution", status: "approved", uploadedAt: "2026-01-06T09:30:00Z" },
      { type: "AML/CFT Policy", status: "approved", uploadedAt: "2026-01-07T11:00:00Z" },
    ],
    complianceChecks: [
      { check: "KYB Verification", status: "passed", completedAt: "2026-01-10T12:00:00Z" },
      { check: "AML Screening", status: "passed", completedAt: "2026-01-11T10:00:00Z" },
      { check: "PEP Check", status: "passed", completedAt: "2026-01-11T11:00:00Z" },
      { check: "Sanctions Screening", status: "passed", completedAt: "2026-01-12T09:00:00Z" },
      { check: "CBN License Verification", status: "passed", completedAt: "2026-01-13T14:00:00Z" },
    ],
    brandingConfig: { primaryColor: "#7C3AED", secondaryColor: "#8B5CF6", logo: "mobilemoney-logo.png", domain: "mobilemoney.54link.com", appName: "MobileMoney POS" },
    technicalConfig: { apiKeyGenerated: true, webhookUrl: "https://api.mobilemoney.ng/webhooks", sandboxReady: true, sdkIntegrated: true },
    slaDeadline: "2026-02-05T23:59:59Z", riskScore: 8,
    approvalHistory: [
      { action: "submitted", by: "ibrahim@mobilemoney.ng", at: "2026-01-05T10:00:00Z", notes: "Application submitted" },
      { action: "documents_approved", by: "admin@54link.com", at: "2026-01-08T16:00:00Z", notes: "All documents verified" },
      { action: "compliance_passed", by: "compliance@54link.com", at: "2026-01-13T15:00:00Z", notes: "All checks passed" },
      { action: "branding_completed", by: "ibrahim@mobilemoney.ng", at: "2026-01-20T09:00:00Z", notes: "Branding finalized" },
      { action: "integration_completed", by: "tech@mobilemoney.ng", at: "2026-02-10T14:00:00Z", notes: "SDK integrated" },
      { action: "testing_passed", by: "qa@54link.com", at: "2026-02-20T16:00:00Z", notes: "All tests passed" },
      { action: "go_live", by: "admin@54link.com", at: "2026-02-28T16:00:00Z", notes: "Partner is now live" },
    ],
  },
];

const onboardingStages: { id: OnboardingStage; label: string; order: number; requiredDocs: string[]; avgDays: number }[] = [
  { id: "application", label: "Application Submitted", order: 1, requiredDocs: [], avgDays: 1 },
  { id: "document_review", label: "Document Review", order: 2, requiredDocs: ["Certificate of Incorporation", "CAC Form", "Tax Clearance Certificate", "Board Resolution", "AML/CFT Policy"], avgDays: 5 },
  { id: "compliance_check", label: "Compliance Check", order: 3, requiredDocs: [], avgDays: 7 },
  { id: "branding_setup", label: "Branding Setup", order: 4, requiredDocs: [], avgDays: 5 },
  { id: "technical_integration", label: "Technical Integration", order: 5, requiredDocs: [], avgDays: 10 },
  { id: "testing", label: "Testing & QA", order: 6, requiredDocs: [], avgDays: 5 },
  { id: "go_live", label: "Go Live", order: 7, requiredDocs: [], avgDays: 2 },
  { id: "active", label: "Active", order: 8, requiredDocs: [], avgDays: 0 },
];

export const whiteLabelOnboardingRouter = router({
  getStats: protectedProcedure.query(() => ({
    totalPartners: partnerApplications.length,
    activePartners: partnerApplications.filter(p => p.stage === "active").length,
    pendingApplications: partnerApplications.filter(p => !["active", "go_live"].includes(p.stage)).length,
    avgOnboardingDays: 35,
    conversionRate: "78%",
  })),
  listApplications: protectedProcedure
    .input(z.object({ stage: z.string().optional(), search: z.string().optional() }).optional())
    .query(({ input }) => {
      let apps = [...partnerApplications];
      if (input?.stage) apps = apps.filter(a => a.stage === input.stage);
      if (input?.search) apps = apps.filter(a => a.companyName.toLowerCase().includes(input.search!.toLowerCase()));
      return { applications: apps, total: apps.length, stages: onboardingStages };
    }),
  getApplication: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => partnerApplications.find(a => a.id === input.id) || null),
  submitApplication: protectedProcedure
    .input(z.object({
      companyName: z.string(), contactName: z.string(), email: z.string().email(), phone: z.string(),
      businessType: z.string(), registrationNumber: z.string(), taxId: z.string(), country: z.string(), state: z.string(),
    }))
    .mutation(({ input }) => ({ id: `WL-${String(partnerApplications.length + 1).padStart(3, "0")}`, ...input, stage: "application" as OnboardingStage, submittedAt: new Date().toISOString() })),
  advanceStage: protectedProcedure
    .input(z.object({ applicationId: z.string(), notes: z.string().optional() }))
    .mutation(({ input }) => {
      const app = partnerApplications.find(a => a.id === input.applicationId);
      if (!app) return { success: false, error: "Application not found" };
      const currentStageIndex = onboardingStages.findIndex(s => s.id === app.stage);
      const nextStage = onboardingStages[currentStageIndex + 1];
      if (!nextStage) return { success: false, error: "Already at final stage" };
      return { success: true, previousStage: app.stage, newStage: nextStage.id, applicationId: input.applicationId };
    }),
  getOnboardingStages: protectedProcedure.query(() => onboardingStages),
  getDocumentChecklist: protectedProcedure
    .input(z.object({ applicationId: z.string() }))
    .query(({ input }) => {
      const app = partnerApplications.find(a => a.id === input.applicationId);
      const requiredDocs = ["Certificate of Incorporation", "CAC Form", "Tax Clearance Certificate", "Board Resolution", "AML/CFT Policy", "Director ID Documents", "Proof of Address", "Bank Statement (6 months)"];
      return requiredDocs.map(doc => ({ name: doc, status: app?.documents.find(d => d.type === doc)?.status || "not_uploaded", required: true }));
    }),
});
