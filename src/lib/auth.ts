import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { getDb, schema } from "@/lib/db";
import { sendTransactionalEmail } from "@/lib/email";

let cachedAuth: ReturnType<typeof betterAuth> | undefined;

export function getAuth() {
  if (cachedAuth) return cachedAuth;

  const secret = process.env.BETTER_AUTH_SECRET;
  const emailVerificationRequired = process.env.AUTH_EMAIL_VERIFICATION === "true";
  if (!secret || secret.length < 32) throw new Error("BETTER_AUTH_SECRET must contain at least 32 characters.");

  cachedAuth = betterAuth({
    appName: "Invoqly",
    baseURL: {
      allowedHosts: ["invoqly.xyz","www.invoqly.xyz","invoqly.vercel.app","invoqly-*.vercel.app","localhost:3000","127.0.0.1:3000","invoqly-preview.*.workers.dev"],
      protocol: "auto",
      fallback: "https://invoqly.xyz",
    },
    secret,
    database: drizzleAdapter(getDb(), { provider: "pg", schema }),
    emailAndPassword: {
      enabled: true,
      autoSignIn: false,
      requireEmailVerification: emailVerificationRequired,
      sendResetPassword: async ({ user, url }) => { await sendTransactionalEmail({to:user.email,subject:"Reset your Invoqly password",text:`Use this secure link to reset your Invoqly password: ${url}\n\nIf you did not request this, you can ignore this email.`}); },
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
      "https://invoqly-preview.*.workers.dev",
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
      max: process.env.CI === "true" ? 30 : 10,
    },
  });

  return cachedAuth;
}
