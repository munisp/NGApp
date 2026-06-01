import { defineConfig } from "drizzle-kit";

const rawUrl =
  process.env.POSTGRES_URL ??
  process.env.DATABASE_URL ??
  "postgresql://ogrmm:ogrmm_secure_2026@localhost:5432/og_rmm";

// Disable SSL for local PostgreSQL; enable for remote TiDB/Neon/Supabase
const isLocal =
  rawUrl.includes("localhost") || rawUrl.includes("127.0.0.1");

const connectionString =
  isLocal && !rawUrl.includes("sslmode")
    ? rawUrl + "?sslmode=disable"
    : rawUrl;

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  },
});
