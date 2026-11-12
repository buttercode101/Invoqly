"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Copy, LoaderCircle, Send, Sparkles } from "lucide-react";
import { formatMinor } from "@/lib/money";

type QuoteData = {
  customerName: string; customerEmail: string; customerCompany: string; description: string;
  quantity: number; unitPriceMinor: number; currency: string; validUntil: string;
};
type InvoiceData = {
  clientId?: string; customerName: string; customerEmail: string; customerCompany: string; description: string;
  quantity: number; unitPriceMinor: number; currency: string; dueDate: string; saveContact?: boolean;
};
type Reminder = { invoiceNumber: string; customerName: string; dueDate: string; amountMinor: number; currency: string; subject: string; body: string };
type AssistantResult = {
  reply: string;
  draft?: { type: "create_quote" | "create_invoice"; data: QuoteData | InvoiceData; sourceDocumentNumber?: string | null; totalMinor: number; currency: string } | null;
  scenario?: { currency: string; baselineNetMinor: number; scenarioNetMinor: number; differenceMinor: number; safeToSpendMinor: number | null; invoiceDelayDays: number; supplierDelayDays: number; weeks: Array<{ startDate: string; endDate: string; netMinor: number; inflowsMinor: number; outflowsMinor: number }>; months: Array<{ startDate: string; endDate: string; netMinor: number; inflowsMinor: number; outflowsMinor: number }> } | null;
  reminders?: Reminder[];
  priorities?: Array<{ invoiceId: string; number: string; customerName: string; openAmountMinor: number; daysOverdue: number; currency: string }>;
  totalImpactMinor?: number;
  profiles?: Array<{ clientId: string; clientName: string; currency: string; onTimeRatePercent: number | null; averageDaysToPay: number | null; preferredPaymentMethod: string | null; overdueBalanceMinor: number; dueInvoiceCount: number; onTimeInvoiceCount: number; paidInvoiceCount: number; lateInvoiceCount: number; confidence: "low" | "medium" | "high" | "none" }>;
  error?: string;
};
type Message = { role: "user" | "assistant"; content: string };
type Props = {
  workspace: { businessName: string; currency: string; clients: Array<{ id: string; name: string }>; invoices: Array<{ id: string }>; quotes: Array<{ id: string }> };
  onCreateQuote: (data: QuoteData) => Promise<boolean>;
  onCreateInvoice: (data: InvoiceData) => Promise<boolean>;
};

const fmt = (amount: number, currency: string) => formatMinor(amount, currency, "en-ZA");

export default function AssistantPanel({ workspace, onCreateQuote, onCreateInvoice }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<AssistantResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [consent, setConsent] = useState(false);
  const [consentLoading, setConsentLoading] = useState(true);

  const submit = async (value = prompt) => {
    const text = value.trim();
    if (!text || busy || !consent) return;
    setPrompt("");
    setError("");
    setResult(null);
    setMessages(current => [...current, { role: "user", content: text }]);
    setBusy(true);
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: messages.slice(-8).map(item => ({ ...item, content: item.content.slice(-800) })) })
      });
      const payload = await response.json() as AssistantResult;
      if (!response.ok) throw new Error(payload.error || "The co-pilot couldn't complete that request.");
      setResult(payload);
      setMessages(current => [...current, { role: "assistant", content: payload.reply }]);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "The co-pilot couldn't complete that request.";
      setError(message);
      setMessages(current => [...current, { role: "assistant", content: message }]);
    } finally {
      setBusy(false);
    }
  };

  const approve = async () => {
    if (!result?.draft) return;
    const ok = result.draft.type === "create_quote"
      ? await onCreateQuote(result.draft.data as QuoteData)
      : await onCreateInvoice(result.draft.data as InvoiceData);
    if (ok) {
      setResult(null);
      setMessages(current => [...current, { role: "assistant", content: "Approved and saved. The new document is now in your workspace." }]);
    }
  };

  const copyReminder = async (reminder: Reminder) => {
    try {
      await navigator.clipboard.writeText("Subject: " + reminder.subject + "\n\n" + reminder.body);
      setCopied(reminder.invoiceNumber);
    } catch {
      setError("Clipboard access was blocked. Select and copy the reminder text manually.");
    }
  };

  useEffect(() => {
    fetch("/api/assistant/consent").then(response => response.json() as Promise<{ accepted?: boolean }>).then(data => setConsent(data.accepted === true)).catch(() => setConsent(false)).finally(() => setConsentLoading(false));
  }, []);

  const setAiConsent = async (accepted: boolean) => {
    setError("");
    try {
      const response = await fetch("/api/assistant/consent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accepted }) });
      if (!response.ok) throw new Error("Could not update the AI privacy preference.");
      setConsent(accepted);
      if (!accepted) { setMessages([]); setResult(null); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update the AI privacy preference."); }
  };

  const suggestions = [
    "Which overdue invoices should I chase first?",
    "Draft reminders for everything overdue more than 10 days.",
    "Show the cash-flow impact if my largest invoice pays 21 days late."
  ];

  return <section className="assistant-page">
    <div className="assistant-intro">
      <div className="assistant-orb"><Sparkles size={20}/></div>
      <div>
        <div className="eyebrow"><i/> INVOQLY CO-PILOT</div>
        <h1>Put your business to work<span>.</span></h1>
        <p className="subtitle">Ask naturally. Review every proposed action before it changes your records.</p>
      </div>
    </div>
    <div className="assistant-layout">
      <div className="assistant-main panel">
        <div className="assistant-topline">
          <div><b>Business assistant</b><small>{workspace.businessName} · {workspace.currency}</small></div>
          <div className="assistant-top-actions"><span className="assistant-status"><i className={consent ? "is-enabled" : "is-idle"}/>{consent ? "Enabled" : "Consent required"}</span>{consent && <button type="button" className="assistant-disable" onClick={() => void setAiConsent(false)} disabled={busy}>Turn off</button>}</div>
        </div>
        <div className="assistant-conversation" aria-live="polite">
          {!consent && <div className="assistant-consent">
            <div className="assistant-consent-icon"><Sparkles size={19}/></div>
            <h2>{consentLoading ? "Checking your privacy preference…" : "Enable your AI co-pilot"}</h2>
            <p>When you use the co-pilot, your message, recent conversation turns and selected workspace records are processed by Cloudflare Workers AI. Invoqly records usage metadata, not your prompt text. No invoice or payment record is changed and no reminder is sent without your approval.</p>
            <p>Review the <Link href="/privacy" target="_blank" rel="noreferrer">privacy notice</Link> before enabling this optional feature.</p>
            <button className="btn btn-primary" onClick={() => void setAiConsent(true)} disabled={consentLoading}>I understand — enable AI</button>
          </div>}
          {consent && messages.length === 0 && <div className="assistant-welcome">
            <Sparkles size={22}/>
            <h2>What would you like to get done?</h2>
            <p>I can prepare document drafts, model supported cash-flow scenarios and draft payment reminders using your workspace records.</p>
            <div className="assistant-suggestions">
              {suggestions.map(item => <button key={item} onClick={() => void submit(item)} disabled={busy}>{item}<ArrowUpRight size={14}/></button>)}
            </div>
          </div>}
          {consent && messages.map((message, index) => <div key={index} className={"assistant-message " + message.role}>
            {message.role === "assistant" && <span className="assistant-message-icon"><Sparkles size={14}/></span>}
            <p>{message.content}</p>
          </div>)}
          {consent && busy && <div className="assistant-message assistant"><span className="assistant-message-icon"><Sparkles size={14}/></span><p><LoaderCircle size={15} className="assistant-spinner"/> Reviewing your workspace…</p></div>}
        </div>
        {error && <p className="assistant-error" role="alert">{error}</p>}
        {consent && <form className="assistant-composer" onSubmit={event => { event.preventDefault(); void submit(); }}>
          <textarea value={prompt} onChange={event => setPrompt(event.target.value)} placeholder="Ask Invoqly to prepare, analyse or follow up…" rows={2} maxLength={2000} disabled={busy}/>
          <button className="btn btn-primary" disabled={busy || !prompt.trim()} aria-label="Send message"><Send size={16}/> Send</button>
        </form>}
        {consent && <p className="assistant-footnote">20 AI requests per workspace per day. Turn off AI at any time. Your records are never changed or messages sent without approval.</p>}
      </div>
      <aside className="assistant-side">
        {result?.draft && <div className="panel assistant-draft">
          <div className="assistant-card-label"><span><Check size={14}/></span> READY FOR REVIEW</div>
          <h2>{result.draft.type === "create_quote" ? "Quotation draft" : "Invoice draft"}</h2>
          {result.draft.sourceDocumentNumber && <p className="assistant-source">Based on {result.draft.sourceDocumentNumber}</p>}
          <div className="assistant-draft-row"><span>Customer</span><b>{result.draft.data.customerName}</b></div>
          <div className="assistant-draft-row"><span>Description</span><b>{result.draft.data.description}</b></div>
          <div className="assistant-draft-row"><span>Quantity</span><b>{result.draft.data.quantity}</b></div>
          <div className="assistant-draft-row"><span>{"validUntil" in result.draft.data ? "Valid until" : "Due date"}</span><b>{"validUntil" in result.draft.data ? result.draft.data.validUntil : result.draft.data.dueDate}</b></div>
          <div className="assistant-draft-row"><span>Unit price</span><b>{fmt(result.draft.data.unitPriceMinor, result.draft.currency)}</b></div>
          <div className="assistant-draft-total"><span>Calculated total</span><strong>{fmt(result.draft.totalMinor, result.draft.currency)}</strong></div>
          <button className="btn btn-primary assistant-approve" onClick={() => void approve()}><Check size={16}/> Approve and create</button>
          <p className="assistant-footnote">The total is calculated by Invoqly's money engine, not generated by AI.</p>
        </div>}
        {result?.scenario && <div className="panel assistant-draft">
          <div className="assistant-card-label"><span><Check size={14}/></span> SCENARIO MODEL</div>
          <h2>13-week cash movement</h2>
          <div className="assistant-draft-row"><span>Baseline net movement</span><b>{fmt(result.scenario.baselineNetMinor, result.scenario.currency)}</b></div>
          <div className="assistant-draft-row"><span>Scenario net movement</span><b>{fmt(result.scenario.scenarioNetMinor, result.scenario.currency)}</b></div>
          <div className="assistant-draft-total"><span>Change vs baseline</span><strong>{fmt(result.scenario.differenceMinor, result.scenario.currency)}</strong></div>
          <div className="assistant-period-heading"><b>13-week view</b><span>Weekly net movement</span></div>
          <div className="assistant-period-list">
            {result.scenario.weeks.map((week, index) => <div className="assistant-period-row" key={week.startDate}>
              <span>W{index + 1} · {week.startDate}</span><b>{fmt(week.netMinor, result.scenario!.currency)}</b>
            </div>)}
          </div>
          <div className="assistant-period-heading"><b>12-month view</b><span>Monthly net movement</span></div>
          <div className="assistant-period-list">
            {result.scenario.months.map(month => <div className="assistant-period-row" key={month.startDate}>
              <span>{new Date(month.startDate + "T00:00:00Z").toLocaleDateString("en-ZA", { month: "short", year: "numeric", timeZone: "UTC" })}</span><b>{fmt(month.netMinor, result.scenario!.currency)}</b>
            </div>)}
          </div>
          <p className="assistant-footnote">Opening cleared cash is not set. These are projected cash movements, not account balances. Safe-to-spend remains unavailable until a verified opening cash balance and reserve are entered.</p>
        </div>}
        {result?.profiles && <div className="panel assistant-draft">
          <div className="assistant-card-label"><span><Check size={14}/></span> PAYMENT HISTORY</div>
          <h2>Client payment behaviour</h2>
          {result.profiles.length === 0 && <p className="assistant-footnote">No saved clients are available to analyse yet.</p>}
          {result.profiles.map(profile => <div className="assistant-client-profile" key={profile.clientId}>
            <div className="assistant-client-profile-top"><b>{profile.clientName}</b><span className={"assistant-confidence " + profile.confidence}>{profile.confidence === "none" ? "No history" : profile.confidence + " sample"}</span></div>
            <div className="assistant-client-metrics">
              <div><strong>{profile.onTimeRatePercent === null ? "—" : profile.onTimeRatePercent + "%"}</strong><span>Paid on time</span></div>
              <div><strong>{profile.averageDaysToPay === null ? "—" : profile.averageDaysToPay + " days"}</strong><span>Average time to pay</span></div>
              <div><strong>{fmt(profile.overdueBalanceMinor, profile.currency)}</strong><span>Overdue balance</span></div>
            </div>
            <div className="assistant-client-profile-foot">
              <span>{profile.paidInvoiceCount} paid of {profile.dueInvoiceCount} due invoices</span>
              <span>{profile.preferredPaymentMethod ? "Often pays by " + profile.preferredPaymentMethod : "No preferred method yet"}</span>
            </div>
          </div>)}
          <p className="assistant-footnote">The percentage is the share of invoices paid by their due date. It is not a credit score or a prediction. Low samples are labelled; missing history is not treated as poor reliability.</p>
        </div>}
        {result?.priorities && result.priorities.length > 0 && <div className="panel assistant-draft">
          <div className="assistant-card-label"><span><Check size={14}/></span> PRIORITISED BY CASH IMPACT</div>
          <h2>Invoices to chase first</h2>
          {result.priorities.map(item => <div className="assistant-draft-row" key={item.invoiceId}>
            <span><b>{item.number}</b><br/>{item.customerName}<br/><small>{item.daysOverdue} days overdue</small></span>
            <b>{fmt(item.openAmountMinor, item.currency)}</b>
          </div>)}
          <div className="assistant-draft-total"><span>Potential cash to recover</span><strong>{fmt(result.totalImpactMinor ?? 0, result.priorities[0]?.currency ?? workspace.currency)}</strong></div>
          <p className="assistant-footnote">Ranked by outstanding balance, then days overdue. This is not a guarantee of payment.</p>
        </div>}
        {result?.reminders && result.reminders.length > 0 && <div className="panel assistant-draft">
          <div className="assistant-card-label"><span><Check size={14}/></span> DRAFTS ONLY</div>
          <h2>{result.reminders.length} payment reminder{result.reminders.length === 1 ? "" : "s"}</h2>
          {result.reminders.map(reminder => <div className="assistant-reminder" key={reminder.invoiceNumber}>
            <div><b>{reminder.invoiceNumber}</b><span>{reminder.customerName} · {fmt(reminder.amountMinor, reminder.currency)}</span></div>
            <pre>{reminder.body}</pre>
            <button className="btn btn-light" onClick={() => void copyReminder(reminder)}><Copy size={14}/>{copied === reminder.invoiceNumber ? "Copied" : "Copy reminder"}</button>
          </div>)}
          <p className="assistant-footnote">Nothing has been sent or scheduled. Review and send through your chosen channel.</p>
        </div>}
        {!result?.draft && !result?.scenario && !(result?.reminders?.length) && !(result?.priorities?.length) && !result?.profiles && <div className="panel assistant-boundary">
          <b>What the co-pilot can use today</b>
          <div><span>Clients</span><strong>{workspace.clients.length}</strong></div>
          <div><span>Invoices</span><strong>{workspace.invoices.length}</strong></div>
          <div><span>Quotations</span><strong>{workspace.quotes.length}</strong></div>
          <p>It reads the records in this workspace. It does not have access to your bank account or email inbox.</p>
        </div>}
      </aside>
    </div>
  </section>;
}
