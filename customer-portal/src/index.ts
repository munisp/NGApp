import express from "express";
import { v4 as uuidv4 } from "uuid";

const app = express();
app.use(express.json());

// Dashboard
app.get("/api/v1/portal/dashboard", (req, res) => {
  res.json({
    customer_id: "CUST-001",
    name: "John Adebayo Okafor",
    active_policies: 3,
    pending_claims: 1,
    total_premium_paid: 185000,
    next_payment_due: "2026-06-01",
    next_payment_amount: 15000,
    loyalty_points: 2450,
    loyalty_tier: "Silver",
    notifications_unread: 5,
    policies_summary: [
      { id: "POL-MTR-001", type: "Motor Third Party", status: "active", expiry: "2027-01-15", premium: 15000 },
      { id: "POL-LIF-001", type: "Term Life", status: "active", expiry: "2036-05-20", premium: 5000 },
      { id: "POL-HC-001", type: "Hospital Cash", status: "active", expiry: "2026-12-31", premium: 1000 },
    ],
    recent_activity: [
      { date: "2026-05-10", action: "Claim filed", reference: "CLM-001", status: "processing" },
      { date: "2026-05-01", action: "Premium paid", reference: "PAY-045", amount: 15000 },
      { date: "2026-04-15", action: "Policy renewed", reference: "POL-MTR-001" },
    ],
  });
});

// Policy details
app.get("/api/v1/portal/policies/:id", (req, res) => {
  res.json({
    policy_id: req.params.id,
    type: "Motor Third Party",
    status: "active",
    holder: "John Adebayo Okafor",
    start_date: "2026-01-15",
    end_date: "2027-01-15",
    premium: 15000,
    premium_frequency: "monthly",
    sum_insured: 1000000,
    vehicle: {
      make: "Toyota", model: "Corolla", year: 2022,
      registration: "LAG-234-XY", color: "Silver",
    },
    benefits: [
      { name: "Third Party Bodily Injury", limit: 1000000 },
      { name: "Third Party Property Damage", limit: 500000 },
    ],
    documents: [
      { type: "certificate", name: "Insurance Certificate", download_url: "/api/v1/portal/documents/cert-001" },
      { type: "policy_schedule", name: "Policy Schedule", download_url: "/api/v1/portal/documents/sched-001" },
    ],
    payment_history: [
      { date: "2026-05-01", amount: 15000, status: "paid", reference: "PAY-045" },
      { date: "2026-04-01", amount: 15000, status: "paid", reference: "PAY-038" },
      { date: "2026-03-01", amount: 15000, status: "paid", reference: "PAY-031" },
    ],
  });
});

// Quick claim filing
app.post("/api/v1/portal/claims/file", (req, res) => {
  const { policy_id, claim_type, description, amount } = req.body;
  res.status(201).json({
    claim_id: `CLM-${uuidv4().slice(0, 8).toUpperCase()}`,
    policy_id,
    claim_type,
    status: "submitted",
    estimated_processing: "24 hours",
    message: "Your claim has been submitted. You will receive updates via SMS and WhatsApp.",
    next_steps: [
      "Upload supporting documents (photos, police report)",
      "AI damage assessment will be performed automatically",
      "Track progress in real-time on this portal",
    ],
  });
});

// Payment
app.post("/api/v1/portal/payments/initiate", (req, res) => {
  const { policy_id, amount, channel } = req.body;
  res.status(201).json({
    payment_id: `PAY-${uuidv4().slice(0, 6).toUpperCase()}`,
    policy_id,
    amount,
    channel: channel || "mobile_money",
    status: "pending",
    payment_url: channel === "card" ? "https://checkout.paystack.com/abc123" : undefined,
    ussd_code: channel === "ussd" ? "*384*NGAPP*15000#" : undefined,
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "healthy", service: "customer-portal" });
});

const port = process.env.PORT || 8107;
app.listen(port, () => console.log(`Customer Portal API on port ${port}`));
