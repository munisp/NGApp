/**
 * Partner Onboarding Router — Multi-step tenant registration flow.
 * Step 1: Validate invite code
 * Step 2: Register company details → create tenant
 * Step 3: Setup branding (logo, colors, domain)
 * Step 4: Configure corridors and fee structure
 * Step 5: Preview and go live
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";

// ─── In-memory stores ──────────────────────────────────────────────────────
interface TenantRecord {
  id: number;
  slug: string;
  name: string;
  companyRegistrationNumber: string;
  country: string;
  currency: string;
  status: "trial" | "active" | "suspended" | "churned";
  contactEmail: string;
  contactPhone: string;
  address: string;
  website: string;
  inviteCode: string;
  onboardingStep: number; // 1-5
  onboardingComplete: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface BrandingRecord {
  tenantId: number;
  logoUrl: string;
  faviconUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
  brandName: string;
  tagline: string;
  customDomain: string;
  supportEmail: string;
  supportPhone: string;
  termsUrl: string;
  privacyUrl: string;
  customCss: string;
  isLive: boolean;
}

interface CorridorRecord {
  id: number;
  tenantId: number;
  sourceCountry: string;
  sourceCurrency: string;
  destinationCountry: string;
  destinationCurrency: string;
  status: "active" | "paused" | "disabled";
  minAmount: string;
  maxAmount: string;
  dailyLimit: string;
  estimatedDeliveryMinutes: number;
  paymentMethods: string[];
  deliveryMethods: string[];
}

interface FeeRecord {
  id: number;
  tenantId: number;
  corridorId: number | null;
  txType: string;
  feeType: "percentage" | "flat" | "tiered";
  feeValue: string;
  minFee: string;
  maxFee: string;
  tieredRules: Array<{ minAmount: number; maxAmount: number; fee: number }> | null;
  description: string;
  isActive: boolean;
}

let nextTenantId = 1;
let nextCorridorId = 1;
let nextFeeId = 1;
const tenants: TenantRecord[] = [];
const brandings: BrandingRecord[] = [];
const corridors: CorridorRecord[] = [];
const fees: FeeRecord[] = [];

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").substring(0, 64);
}

export const partnerOnboardingRouter = router({
  /** Step 1: Validate invite code (public — no auth needed) */
  validateInvite: protectedProcedure
    .input(z.object({ code: z.string().min(1).max(32) }))
    .query(({ input }) => {
      // Delegate to inviteCodes.validate — here we just confirm the code shape
      return { valid: true, code: input.code };
    }),

  /** Step 2: Register company and create tenant */
  registerTenant: protectedProcedure
    .input(z.object({
      inviteCode: z.string().min(1).max(32),
      companyName: z.string().min(2).max(128),
      companyRegistrationNumber: z.string().min(2).max(64),
      country: z.string().length(3).default("NGA"),
      currency: z.string().length(3).default("NGN"),
      contactEmail: z.string().email().max(320),
      contactPhone: z.string().min(8).max(20),
      address: z.string().max(500).default(""),
      website: z.string().max(256).default(""),
    }))
    .mutation(({ input }) => {
      // Check for duplicate slug
      const slug = slugify(input.companyName);
      if (tenants.find(t => t.slug === slug)) {
        throw new TRPCError({ code: "CONFLICT", message: "A tenant with this name already exists" });
      }

      const tenant: TenantRecord = {
        id: nextTenantId++,
        slug,
        name: input.companyName,
        companyRegistrationNumber: input.companyRegistrationNumber,
        country: input.country,
        currency: input.currency,
        status: "trial",
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
        address: input.address,
        website: input.website,
        inviteCode: input.inviteCode,
        onboardingStep: 2,
        onboardingComplete: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      tenants.push(tenant);

      // Create default branding
      brandings.push({
        tenantId: tenant.id,
        logoUrl: "",
        faviconUrl: "",
        primaryColor: "#2563EB",
        secondaryColor: "#1E40AF",
        accentColor: "#F59E0B",
        backgroundColor: "#0F172A",
        textColor: "#F8FAFC",
        fontFamily: "Inter",
        brandName: input.companyName,
        tagline: `${input.companyName} — Fast, Secure Remittances`,
        customDomain: "",
        supportEmail: input.contactEmail,
        supportPhone: input.contactPhone,
        termsUrl: "",
        privacyUrl: "",
        customCss: "",
        isLive: false,
      });

      return { tenant, step: 2 };
    }),

  /** Step 3: Setup branding */
  updateBranding: protectedProcedure
    .input(z.object({
      tenantId: z.number().int(),
      logoUrl: z.string().max(2048).optional(),
      faviconUrl: z.string().max(2048).optional(),
      primaryColor: z.string().max(9).optional(),
      secondaryColor: z.string().max(9).optional(),
      accentColor: z.string().max(9).optional(),
      backgroundColor: z.string().max(9).optional(),
      textColor: z.string().max(9).optional(),
      fontFamily: z.string().max(64).optional(),
      brandName: z.string().max(128).optional(),
      tagline: z.string().max(256).optional(),
      customDomain: z.string().max(256).optional(),
      supportEmail: z.string().email().max(320).optional(),
      supportPhone: z.string().max(20).optional(),
      termsUrl: z.string().max(2048).optional(),
      privacyUrl: z.string().max(2048).optional(),
      customCss: z.string().max(10000).optional(),
    }))
    .mutation(({ input }) => {
      const branding = brandings.find(b => b.tenantId === input.tenantId);
      if (!branding) throw new TRPCError({ code: "NOT_FOUND", message: "Tenant branding not found" });

      // Update only provided fields
      if (input.logoUrl !== undefined) branding.logoUrl = input.logoUrl;
      if (input.faviconUrl !== undefined) branding.faviconUrl = input.faviconUrl;
      if (input.primaryColor !== undefined) branding.primaryColor = input.primaryColor;
      if (input.secondaryColor !== undefined) branding.secondaryColor = input.secondaryColor;
      if (input.accentColor !== undefined) branding.accentColor = input.accentColor;
      if (input.backgroundColor !== undefined) branding.backgroundColor = input.backgroundColor;
      if (input.textColor !== undefined) branding.textColor = input.textColor;
      if (input.fontFamily !== undefined) branding.fontFamily = input.fontFamily;
      if (input.brandName !== undefined) branding.brandName = input.brandName;
      if (input.tagline !== undefined) branding.tagline = input.tagline;
      if (input.customDomain !== undefined) branding.customDomain = input.customDomain;
      if (input.supportEmail !== undefined) branding.supportEmail = input.supportEmail;
      if (input.supportPhone !== undefined) branding.supportPhone = input.supportPhone;
      if (input.termsUrl !== undefined) branding.termsUrl = input.termsUrl;
      if (input.privacyUrl !== undefined) branding.privacyUrl = input.privacyUrl;
      if (input.customCss !== undefined) branding.customCss = input.customCss;

      // Advance onboarding step
      const tenant = tenants.find(t => t.id === input.tenantId);
      if (tenant && tenant.onboardingStep < 3) {
        tenant.onboardingStep = 3;
        tenant.updatedAt = new Date();
      }

      return branding;
    }),

  /** Step 4: Add corridors */
  addCorridor: protectedProcedure
    .input(z.object({
      tenantId: z.number().int(),
      sourceCountry: z.string().length(3),
      sourceCurrency: z.string().length(3),
      destinationCountry: z.string().length(3),
      destinationCurrency: z.string().length(3),
      minAmount: z.string().default("10.00"),
      maxAmount: z.string().default("1000000.00"),
      dailyLimit: z.string().default("5000000.00"),
      estimatedDeliveryMinutes: z.number().int().min(1).default(30),
      paymentMethods: z.array(z.string()).default(["bank_transfer", "mobile_money"]),
      deliveryMethods: z.array(z.string()).default(["bank_deposit", "mobile_wallet"]),
    }))
    .mutation(({ input }) => {
      const corridor: CorridorRecord = {
        id: nextCorridorId++,
        tenantId: input.tenantId,
        sourceCountry: input.sourceCountry,
        sourceCurrency: input.sourceCurrency,
        destinationCountry: input.destinationCountry,
        destinationCurrency: input.destinationCurrency,
        status: "active",
        minAmount: input.minAmount,
        maxAmount: input.maxAmount,
        dailyLimit: input.dailyLimit,
        estimatedDeliveryMinutes: input.estimatedDeliveryMinutes,
        paymentMethods: input.paymentMethods,
        deliveryMethods: input.deliveryMethods,
      };
      corridors.push(corridor);

      // Advance onboarding
      const tenant = tenants.find(t => t.id === input.tenantId);
      if (tenant && tenant.onboardingStep < 4) {
        tenant.onboardingStep = 4;
        tenant.updatedAt = new Date();
      }

      return corridor;
    }),

  /** Step 4b: Add fee override */
  addFeeOverride: protectedProcedure
    .input(z.object({
      tenantId: z.number().int(),
      corridorId: z.number().int().optional(),
      txType: z.string().max(64).default("transfer"),
      feeType: z.enum(["percentage", "flat", "tiered"]).default("percentage"),
      feeValue: z.string().default("1.5000"),
      minFee: z.string().default("100.00"),
      maxFee: z.string().default("50000.00"),
      tieredRules: z.array(z.object({
        minAmount: z.number(),
        maxAmount: z.number(),
        fee: z.number(),
      })).optional(),
      description: z.string().max(500).default(""),
    }))
    .mutation(({ input }) => {
      const fee: FeeRecord = {
        id: nextFeeId++,
        tenantId: input.tenantId,
        corridorId: input.corridorId ?? null,
        txType: input.txType,
        feeType: input.feeType,
        feeValue: input.feeValue,
        minFee: input.minFee,
        maxFee: input.maxFee,
        tieredRules: input.tieredRules ?? null,
        description: input.description,
        isActive: true,
      };
      fees.push(fee);
      return fee;
    }),

  /** Step 5: Complete onboarding and go live */
  completeOnboarding: protectedProcedure
    .input(z.object({ tenantId: z.number().int() }))
    .mutation(({ input }) => {
      const tenant = tenants.find(t => t.id === input.tenantId);
      if (!tenant) throw new TRPCError({ code: "NOT_FOUND", message: "Tenant not found" });
      tenant.onboardingStep = 5;
      tenant.onboardingComplete = true;
      tenant.status = "active";
      tenant.updatedAt = new Date();
      return { tenant, message: "Onboarding complete! Your white-label instance is now live." };
    }),

  /** Get onboarding progress for a tenant */
  getProgress: protectedProcedure
    .input(z.object({ tenantId: z.number().int() }))
    .query(({ input }) => {
      const tenant = tenants.find(t => t.id === input.tenantId);
      if (!tenant) throw new TRPCError({ code: "NOT_FOUND", message: "Tenant not found" });
      const branding = brandings.find(b => b.tenantId === input.tenantId);
      const tenantCorridors = corridors.filter(c => c.tenantId === input.tenantId);
      const tenantFees = fees.filter(f => f.tenantId === input.tenantId);
      return {
        tenant,
        branding,
        corridors: tenantCorridors,
        fees: tenantFees,
        currentStep: tenant.onboardingStep,
        isComplete: tenant.onboardingComplete,
      };
    }),

  /** Get branding for white-label preview */
  getBranding: protectedProcedure
    .input(z.object({ tenantId: z.number().int() }))
    .query(({ input }) => {
      const branding = brandings.find(b => b.tenantId === input.tenantId);
      if (!branding) throw new TRPCError({ code: "NOT_FOUND", message: "Branding not found" });
      return branding;
    }),

  /** List corridors for a tenant */
  listCorridors: protectedProcedure
    .input(z.object({ tenantId: z.number().int() }))
    .query(({ input }) => {
      return corridors.filter(c => c.tenantId === input.tenantId);
    }),

  /** List fee overrides for a tenant */
  listFees: protectedProcedure
    .input(z.object({ tenantId: z.number().int() }))
    .query(({ input }) => {
      return fees.filter(f => f.tenantId === input.tenantId);
    }),

  /** Delete a corridor */
  removeCorridor: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(({ input }) => {
      const idx = corridors.findIndex(c => c.id === input.id);
      if (idx === -1) throw new TRPCError({ code: "NOT_FOUND", message: "Corridor not found" });
      corridors.splice(idx, 1);
      return { success: true } as any;
    }),

  /** Delete a fee override */
  removeFee: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(({ input }) => {
      const idx = fees.findIndex(f => f.id === input.id);
      if (idx === -1) throw new TRPCError({ code: "NOT_FOUND", message: "Fee override not found" });
      fees.splice(idx, 1);
      return { success: true } as any;
    }),
});
