import { defineConfig } from "drizzle-kit";

// Use local PostgreSQL instead of cloud database
const connectionString = process.env.LOCAL_POSTGRES_URL || 'postgresql://fintech_user:fintech_password_2026@localhost:5432/fintech_mobile_app';

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
  },
});
