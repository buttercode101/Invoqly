import Link from "next/link";
import type { Metadata } from "next";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Simple invoicing and cash flow tools",
  description: "Create professional invoices, track payments and understand your cash flow. Free core tools, with optional pay-as-you-go services.",
};

export default function HomePage() {
  return <main className="public-home">
    <nav className="public-nav"><Link href="/" className="brand"><span className="brand-mark">i<span>.</span></span><span>invoqly</span></Link><div><Link href="/sign-in">Sign in</Link><Link className="public-nav-cta" href="/sign-up">Get started free</Link></div></nav>
    <section className="public-hero"><div className="public-copy"><span className="eyebrow"><i/> FINANCES, WITHOUT THE FUSS</span><h1>Spend less time<br/>on admin. <em>Get back<br/>to your work.</em></h1><p>Invoices, quotations, clients, expenses and cash flow in one calm, straightforward workspace. Start billing without building a contact list first. No subscription required for the essentials.</p><div className="public-actions"><Link className="btn btn-primary" href="/guest">Try Invoqly free — no account <span>→</span></Link><Link className="public-secondary" href="/sign-up">Create an account for cloud sync</Link></div><div className="public-points"><span>Free core tools, forever</span><span>No monthly subscription</span><span>Pay only for optional services</span></div></div>
    <div className="public-flow" aria-label="How Invoqly works">
      <div className="flow-head"><span>FROM FIRST QUOTE TO PAYMENT</span><span>ONE WORKFLOW</span></div>
      <ol className="flow-list">
        <li className="flow-step"><span className="flow-index" aria-hidden="true">01</span><div className="flow-step-copy"><b>Prepare a quotation</b><p>Set out the work, quantity and price before you commit.</p></div><small className="flow-tag">QUOTE</small></li>
        <li className="flow-step"><span className="flow-index" aria-hidden="true">02</span><div className="flow-step-copy"><b>Issue an invoice</b><p>Bill directly or turn an accepted quotation into an invoice.</p></div><small className="flow-tag">INVOICE</small></li>
        <li className="flow-step"><span className="flow-index" aria-hidden="true">03</span><div className="flow-step-copy"><b>Record the payment</b><p>Track what has been received and what is still outstanding.</p></div><small className="flow-tag">PAYMENT</small></li>
      </ol>
      <div className="flow-foot"><span>You can invoice directly at any time.</span><strong>MANUAL PAYMENT RECORDS</strong></div>
    </div></section>
    <section className="public-features"><div><span>01 / BILLING</span><h2>Invoices that get out of your way.</h2><p>Create invoices with customer details entered on the spot, or save contacts for later. Prepare quotations, track decisions and turn accepted quotes into invoices.</p></div><div><span>02 / CASH FLOW</span><h2>Know what came in and went out.</h2><p>Record payments and expenses, see outstanding balances and keep a clear view of your numbers.</p></div><div><span>03 / AI CO-PILOT</span><h2>AI that prepares work for your review.</h2><p>After you enable it, the co-pilot can draft invoices and quotations, prioritise overdue receivables and model cash-flow scenarios. You approve every action.</p></div></section>
    <footer className="public-footer"><span>© {new Date().getFullYear()} Invoqly</span><span>Built for independent businesses.</span><Link href="/privacy">Privacy</Link><Link href="/sign-up">Start free →</Link></footer>
  </main>;
}
