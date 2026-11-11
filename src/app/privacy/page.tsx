import Link from "next/link";

export const metadata = { title: "Privacy | Invoqly", description: "How Invoqly handles workspace and AI co-pilot data." };

export default function PrivacyPage() {
  return <main className="public-home privacy-page">
    <nav className="public-nav"><Link href="/" className="brand"><span className="brand-mark">i<span>.</span></span><span>invoqly</span></Link><Link href="/guest">Use the free workspace →</Link></nav>
    <article className="privacy-content">
      <span className="eyebrow"><i/> TRUST & DATA</span>
      <h1>Privacy, clearly stated.</h1>
      <p className="subtitle">Last updated: 11 November 2026</p>
      <h2>Information you add</h2>
      <p>When you use an account workspace, Invoqly stores the business records you create, including customers, quotations, invoices, payments and expenses, in its application database. Guest-mode records remain in the guest experience and are not automatically attached to an account.</p>
      <h2>AI co-pilot processing</h2>
      <p>The AI co-pilot is optional and requires an account. Before its first use, you must enable it after reviewing this notice. When you submit a request, Invoqly sends your message, the recent conversation turns shown in the co-pilot, and a limited read-only selection of workspace records (customer names, invoice and quotation details, payment records and future-dated expenses) to Cloudflare Workers AI to generate a response.</p>
      <p>Invoqly records AI usage metadata for rate limiting and audit purposes, including the model identifier. It does not store the prompt or model response in the application audit log. Conversation turns are held in the active browser session and sent with later co-pilot requests while that session remains open.</p>
      <p>AI output can be wrong. It cannot directly change your records, calculate authoritative totals or VAT, send messages, or schedule reminders. You review and approve any document creation. Read Cloudflare's <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noreferrer">Privacy Policy</a> and <a href="https://www.cloudflare.com/terms/" target="_blank" rel="noreferrer">Terms</a> for information about its services.</p>
      <h2>Integrations and financial accounts</h2>
      <p>Bank feeds, email inboxes, SMS services and payment gateways are not connected unless the product explicitly provides and you enable such an integration. The current AI co-pilot does not access those services.</p>
      <h2>Security and control</h2>
      <p>Account access is protected by authentication. Do not include passwords, identity numbers, bank credentials or other unnecessary sensitive information in AI prompts. You can disable the co-pilot at any time from its workspace panel; disabling it prevents further AI requests from that browser until you enable it again.</p>
      <h2>Questions and data requests</h2>
      <p>For privacy questions or requests concerning your account data, contact the Invoqly team through the support channel provided in the application.</p>
      <p className="privacy-back"><Link href="/">← Back to Invoqly</Link></p>
    </article>
    <footer className="public-footer"><span>© {new Date().getFullYear()} Invoqly</span><span>Business, in good order.</span><Link href="/guest">Try free →</Link></footer>
  </main>;
}
