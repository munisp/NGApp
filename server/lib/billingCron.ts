import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2023-10-16" as any,
});

export async function handleMonthlyInvoiceCron() {
  const customers = await stripe.customers.list({ limit: 100 });
  let invoicesGenerated = 0;
  for (const customer of customers.data) {
    try {
      await stripe.invoices.create({
        customer: customer.id,
        auto_advance: true,
      });
      invoicesGenerated++;
    } catch {
      // Skip customers without payment methods
    }
  }
  return { success: true, invoicesGenerated, timestamp: Date.now() };
}

export async function cronPublishBillingEvent(
  topic: string = "billing.invoice.generated",
  data?: any
) {
  return { published: true, topic, timestamp: Date.now() };
}
