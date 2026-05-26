/**
 * OG-RMM SaaS Stripe Products & Prices
 * Centralized product/price definitions for all subscription tiers
 */

export interface StripeProduct {
  name: string;
  description: string;
  planId: string;
  priceMonthly: number; // in cents
  priceAnnual: number;  // in cents
  features: string[];
  maxWells: number | null;
  maxUsers: number | null;
}

export const STRIPE_PRODUCTS: StripeProduct[] = [
  {
    name: "Starter",
    description: "For small operators — up to 10 wells, basic monitoring",
    planId: "starter",
    priceMonthly: 49900,   // $499/mo
    priceAnnual: 479000,   // $4,790/yr (~20% discount)
    maxWells: 10,
    maxUsers: 5,
    features: ["Real-time telemetry", "Alarm management", "Basic analytics", "Mobile app (iOS/Android)", "Email support"],
  },
  {
    name: "Professional",
    description: "For mid-size operators — up to 50 wells, advanced analytics",
    planId: "professional",
    priceMonthly: 199900,  // $1,999/mo
    priceAnnual: 1919000,  // $19,190/yr
    maxWells: 50,
    maxUsers: 25,
    features: ["Everything in Starter", "Digital twin (Three.js)", "PINN AI models", "Production allocation", "WITSML/PRODML", "IEC 62443 compliance", "Priority support"],
  },
  {
    name: "Enterprise",
    description: "For large operators — unlimited wells, full platform",
    planId: "enterprise",
    priceMonthly: 499900,  // $4,999/mo
    priceAnnual: 4799000,  // $47,990/yr
    maxWells: null,
    maxUsers: null,
    features: ["Everything in Professional", "OSDU R3 integration", "Federated learning", "SAP PM/Maximo", "SOC 2 audit trail", "SIL 2 safety", "White-label branding", "Dedicated CSM", "SLA 99.9%"],
  },
  {
    name: "Analytics Add-on",
    description: "Marketplace analytics plugins — per tenant",
    planId: "analytics-addon",
    priceMonthly: 29900,   // $299/mo
    priceAnnual: 287000,   // $2,870/yr
    maxWells: null,
    maxUsers: null,
    features: ["Reservoir simulation integration", "Carbon accounting (Scope 1/2/3)", "Drone inspection AI", "Advanced forecasting", "Custom dashboards"],
  },
];

export const STRIPE_WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
] as const;
