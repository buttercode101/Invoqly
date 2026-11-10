import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db, schema } from "@/lib/db";

const secret = process.env.BETTER_AUTH_SECRET;
if (!secret || secret.length < 32) throw new Error("BETTER_AUTH_SECRET must contain at least 32 characters.");

export const auth = betterAuth({
  appName: "Invoqly",
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
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
    "https://*.vercel.app",
    "http://localhost:3000",
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
