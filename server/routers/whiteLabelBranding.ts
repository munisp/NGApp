import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";

const brandingProfiles = [
  { id: "BR-001", partnerId: "WL-001", appName: "PayFast POS", primaryColor: "#1E40AF", secondaryColor: "#3B82F6", accentColor: "#DBEAFE", fontFamily: "Inter", logoUrl: "", faviconUrl: "", domain: "payfast.54link.com", customCss: "", loginBg: "gradient-blue", dashboardLayout: "standard", emailTemplate: "branded", smsSignature: "PayFast", receiptHeader: "PayFast POS - Powered by 54Link", receiptFooter: "Thank you for using PayFast", status: "draft" },
  { id: "BR-002", partnerId: "WL-003", appName: "MobileMoney POS", primaryColor: "#7C3AED", secondaryColor: "#8B5CF6", accentColor: "#EDE9FE", fontFamily: "Poppins", logoUrl: "mobilemoney-logo.png", faviconUrl: "mobilemoney-favicon.ico", domain: "mobilemoney.54link.com", customCss: "", loginBg: "gradient-purple", dashboardLayout: "compact", emailTemplate: "branded", smsSignature: "MobileMoney", receiptHeader: "MobileMoney Express - Powered by 54Link", receiptFooter: "Thank you for choosing MobileMoney", status: "active" },
];

export const whiteLabelBrandingRouter = router({
  getStats: protectedProcedure.query(() => ({ totalProfiles: brandingProfiles.length, activeProfiles: brandingProfiles.filter(b => b.status === "active").length, draftProfiles: brandingProfiles.filter(b => b.status === "draft").length, customDomains: 2 })),
  listProfiles: protectedProcedure.query(() => brandingProfiles),
  getProfile: protectedProcedure.input(z.object({ id: z.string() })).query(({ input }) => brandingProfiles.find(b => b.id === input.id) || null),
  updateBranding: protectedProcedure.input(z.object({ profileId: z.string(), appName: z.string().optional(), primaryColor: z.string().optional(), secondaryColor: z.string().optional(), fontFamily: z.string().optional(), domain: z.string().optional() })).mutation(({ input }) => ({ success: true, profileId: input.profileId, updatedAt: new Date().toISOString() })),
  previewBranding: protectedProcedure.input(z.object({ profileId: z.string() })).query(({ input }) => ({ previewUrl: `https://preview.54link.com/${input.profileId}`, expiresAt: new Date(Date.now() + 3600000).toISOString() })),
  getThemeOptions: protectedProcedure.query(() => ({ fonts: ["Inter", "Poppins", "Roboto", "Open Sans", "Montserrat", "Lato"], layouts: ["standard", "compact", "wide", "minimal"], loginBackgrounds: ["gradient-blue", "gradient-purple", "gradient-green", "solid-dark", "solid-light", "custom-image"] })),
});
