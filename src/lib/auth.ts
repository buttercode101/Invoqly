import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db, schema } from "@/lib/db";

const secret = process.env.BETTER_AUTH_SECRET;
if (!secret || secret.length < 32) throw new Error("BETTER_AUTH_SECRET must contain at least 32 characters.");

export const auth = betterAuth({
  appName: "Invoqly",
  baseURL: {
    allowedHosts: ["invoqly.xyz","www.invoqly.xyz","invoqly.vercel.app","invoqly-*.vercel.app","localhost:3000","127.0.0.1:3000"],
    protocol: "auto",
    fallback: "https://invoqly.xyz",
  },
  secret,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
  },
  trustedOrigins: [
    "https://invoqly.xyz",
    "https://www.invoqly.xyz",
    "https://invoqly.vercel.app",
    "https://invoqly-*.vercel.app",
    ...(process.env.NODE_ENV === "development" || process.env.CI === "true" ? ["http://localhost:3000","http://127.0.0.1:3000"] : []),
  ],
  advanced: {
    cookiePrefix: "invoqly",
    useSecureCookies: process.env.NODE_ENV === "production",
  },
  session: {
    expiresIn: 60 * 60 * 24 * 14,
    updateAge: 60 * 60 * 24,
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 10,
  },
});
