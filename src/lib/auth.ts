import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import type { Database } from "@/lib/db";
import { schema } from "@/lib/db";
import { sendTransactionalEmail } from "@/lib/email";

export function createAuth(db: Database) {
  const secret = process.env.BETTER_AUTH_SECRET;
  const emailVerificationRequired = process.env.AUTH_EMAIL_VERIFICATION === "true";
  if (!secret || secret.length < 32) throw new Error("BETTER_AUTH_SECRET must contain at least 32 characters.");

  return betterAuth({
  appName: "Invoqly",
  // Pin Better Auth to the deployment origin. Relying on request-host
  // inference can fall back to the canonical production host on Workers,
  // which causes session cookies to be scoped to the wrong origin.
  baseURL: process.env.BETTER_AUTH_URL || (process.env.NODE_ENV === "production" ? "https://invoqly.xyz" : "http://localhost:3000"),
  secret,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
    requireEmailVerification: emailVerificationRequired,
    sendResetPassword: async ({ user, url }) => { await sendTransactionalEmail({to:user.email,subject:"Reset your Invoqly password",text:`Use this secure link to reset your password: ${url}\n\nIf you did not request this, you can ignore this email.`}); },
    minPasswordLength: 12,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
  },
  emailVerification: {
    sendOnSignUp: emailVerificationRequired,
    sendOnSignIn: emailVerificationRequired,
    autoSignInAfterVerification: true,
    expiresIn: 3600,
    sendVerificationEmail: async ({ user, url }) => { if(emailVerificationRequired) await sendTransactionalEmail({to:user.email,subject:"Verify your Invoqly email",text:`Confirm your email address to secure your Invoqly account: ${url}\n\nThis link expires in one hour.`}); },
  },
  trustedOrigins: [
    "https://invoqly.xyz",
    "https://www.invoqly.xyz",
    "https://invoqly.vercel.app",
    "https://invoqly-*.vercel.app",
    "https://invoqly-preview.buttercoder-dev.workers.dev",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
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
}
