"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Download, FileText, RotateCcw, ShieldCheck, X } from "lucide-react";
import { downloadDocumentPdf } from "@/lib/document-pdf";
import { resolveDocumentSettings, type DocumentSettings } from "@/lib/document-design";

type PublicQuote = {
  id: string; number: string; customerName: string; customerEmail: string; customerCompany: string;
  issueDate: string; validUntil: string; currency: string; status: string;
  lineItems: Array<{ description: string; quantity: number; unitPriceMinor: number }>;
  documentDesign: Partial<DocumentSettings> | null; decisionStatus: string; signerName?: string | null;
  signerEmail?: string | null; signatureDataUrl?: string | null; decisionAt?: string | null; rejectionReason?: string | null;
};
type PublicData = { quote: PublicQuote; business: { name: string }; linkExpiresAt: string };

const money = (minor: number, currency: string) => {
  try { return new Intl.NumberFormat("en-ZA", { style: "currency", currency }).format(minor / 100); }
  catch { return currency + " " + (minor / 100).toFixed(2); }
};

export default function PublicQuoteClient({ token }: { token: string }) {
  const [data, setData] = useState<PublicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [signature, setSignature] = useState("");
  const [hasInk, setHasInk] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [decision, setDecision] = useState<"Accepted" | "Declined" | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);

  useEffect(() => {
    let active = true;
    fetch("/api/public/quotes/" + token, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "This quotation is not available.");
        if (active) setData(body as PublicData);
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "This quotation could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  const resizeCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const previous = signature;
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(150 * ratio);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.scale(ratio, ratio);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = 2.3;
    context.strokeStyle = "#17251d";
    if (previous) {
      const image = new Image();
      image.onload = () => context.drawImage(image, 0, 0, rect.width, 150);
      image.src = previous;
    }
  };

  useEffect(() => {
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [data]);

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const startDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const context = canvas.getContext("2d");
    if (!context) return;
    canvas.setPointerCapture(event.pointerId);
    drawing.current = true;
    const p = point(event);
    context.beginPath();
    context.moveTo(p.x, p.y);
  };
  const draw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const context = event.currentTarget.getContext("2d");
    if (!context) return;
    const p = point(event);
    context.lineTo(p.x, p.y);
    context.stroke();
    setHasInk(true);
  };
  const stopDrawing = () => {
    if (!drawing.current || !canvasRef.current) return;
    drawing.current = false;
    const value = canvasRef.current.toDataURL("image/png");
    setSignature(value);
  };
  const clearSignature = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    setSignature("");
    setHasInk(false);
  };

  const submitDecision = async (next: "Accepted" | "Declined") => {
    if (!data || submitting) return;
    if (name.trim().length < 2) { setError("Enter your full name to record your decision."); return; }
    if (next === "Accepted" && (!agreed || !signature)) { setError("Confirm the terms and draw your signature before accepting."); return; }
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/public/quotes/" + token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: next, signerName: name.trim(), signerEmail: email.trim(), agreed: agreed || next === "Declined", signatureDataUrl: next === "Accepted" ? signature : undefined, rejectionReason: next === "Declined" ? reason.trim() : "" }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Your decision could not be recorded.");
      setDecision(next);
      setData((current) => current ? { ...current, quote: { ...current.quote, status: next, decisionStatus: next, signerName: name.trim(), signerEmail: email.trim(), signatureDataUrl: next === "Accepted" ? signature : null, decisionAt: body.decisionAt, rejectionReason: next === "Declined" ? reason.trim() : null } } : current);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your decision could not be recorded.");
    } finally {
      setSubmitting(false);
    }
  };

  const downloadPdf = async () => {
    if (!data) return;
    const q = data.quote;
    const settings = resolveDocumentSettings(q.documentDesign);
    try {
      await downloadDocumentPdf({
        kind: "Quotation", number: q.number, businessName: data.business.name, customerName: q.customerName,
        customerCompany: q.customerCompany, customerEmail: q.customerEmail, currency: q.currency,
        issueDate: q.issueDate, dueLabel: "Valid until " + q.validUntil, status: q.status,
        lineItems: q.lineItems, settings, signatureDataUrl:q.signatureDataUrl, signerName:q.signerName, decisionAt:q.decisionAt,
      });
    } catch {
      setError("The quotation PDF could not be generated. Please try again.");
    }
  };

  if (loading) return <main className="public-quote-state"><div className="public-quote-loader"/>Loading your quotation…</main>;
  if (!data) return <main className="public-quote-state"><div className="public-quote-error"><FileText size={22}/><h1>Quotation unavailable</h1><p>{error || "This link may have expired or been withdrawn."}</p></div></main>;

  const q = data.quote;
  const settings = resolveDocumentSettings(q.documentDesign);
  const total = q.lineItems.reduce((sum, line) => sum + line.quantity * line.unitPriceMinor, 0);
  const decided = q.decisionStatus !== "Pending" || Boolean(decision);
  return (
    <main className="public-quote-page">
      <header className="public-quote-top">
        <a href="/" className="public-quote-brand"><span>i.</span> invoqly</a>
        <span>Secure quotation review</span>
      </header>
      <div className="public-quote-layout">
        <section className="public-quote-document">
          <div className="public-quote-document-head" style={{ borderColor: settings.accentColor }}>
            {settings.logoDataUrl ? <img className="public-quote-logo" src={settings.logoDataUrl} alt="Business logo"/> : <span className="public-quote-mark" style={{ background: settings.accentColor }}>{(settings.brandName || data.business.name).slice(0,1).toUpperCase()}</span>}
            <div><p className="public-quote-eyebrow">QUOTATION FROM</p><h1>{settings.brandName || data.business.name}</h1></div>
            <div className="public-quote-number"><b>{q.number}</b><span>Valid until {q.validUntil}</span></div>
          </div>
          <div className="public-quote-recipient"><div><small>PREPARED FOR</small><b>{q.customerName}</b>{q.customerCompany && <span>{q.customerCompany}</span>}{q.customerEmail && <span>{q.customerEmail}</span>}</div><div><small>ISSUED</small><b>{q.issueDate}</b></div></div>
          <div className="public-quote-lines">
            <div className="public-quote-line public-quote-line-head"><span>Description</span><span>Qty</span><span>Unit price</span><span>Amount</span></div>
            {q.lineItems.map((line, index) => <div className="public-quote-line" key={index}><span>{line.description}</span><span>{line.quantity}</span><span>{money(line.unitPriceMinor,q.currency)}</span><b>{money(line.quantity*line.unitPriceMinor,q.currency)}</b></div>)}
          </div>
          <div className="public-quote-total"><span>Total</span><b style={{ color: settings.accentColor }}>{money(total,q.currency)}</b></div>
          <div className="public-quote-document-foot"><span>Prepared with Invoqly</span><button onClick={downloadPdf}><Download size={15}/> Download PDF</button></div>
        </section>
        <aside className="public-quote-decision">
          {decided ? (
            <div className="public-quote-result">
              <span className={q.status === "Accepted" ? "public-quote-result-icon accepted" : "public-quote-result-icon declined"}>{q.status === "Accepted" ? <Check/> : <X/>}</span>
              <p className="public-quote-eyebrow">DECISION RECORDED</p>
              <h2>{q.status === "Accepted" ? "Quotation accepted" : "Quotation declined"}</h2>
              <p>{q.status === "Accepted" ? "Your approval has been securely recorded. The business can now follow up with the next steps." : "Your response has been sent to the business."}</p>
              {q.signerName && <div className="public-quote-signed"><small>RECORDED FOR</small><b>{q.signerName}</b>{q.decisionAt && <span>{new Date(q.decisionAt).toLocaleString()}</span>}{q.signatureDataUrl && <img src={q.signatureDataUrl} alt="Recorded signature"/>}</div>}
            </div>
          ) : (
            <>
              <p className="public-quote-eyebrow">YOUR DECISION</p>
              <h2>Review and respond</h2>
              <p className="public-quote-help">Check the scope and total carefully. You can accept with an electronic signature or decline with a note.</p>
              <label className="public-quote-field">Full name<input value={name} onChange={e=>setName(e.target.value)} autoComplete="name" maxLength={120} placeholder="Your full name"/></label>
              <label className="public-quote-field">Email address <span>Optional</span><input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" maxLength={254} placeholder="you@example.com"/></label>
              <label className="public-quote-consent"><input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)}/><span>I have reviewed this quotation and agree to the scope, pricing and terms shown above.</span></label>
              <div className="public-quote-signature">
                <div><b>Electronic signature</b><span>Draw your signature below to accept</span></div>
                <div className="public-quote-canvas-wrap">{!hasInk && <span className="public-quote-sign-hint">Sign here</span>}<canvas ref={canvasRef} onPointerDown={startDrawing} onPointerMove={draw} onPointerUp={stopDrawing} onPointerCancel={stopDrawing} aria-label="Draw your electronic signature"/></div>
                <button type="button" className="public-quote-clear" onClick={clearSignature}><RotateCcw size={13}/> Clear signature</button>
              </div>
              {error && <p className="public-quote-error">{error}</p>}
              <button className="public-quote-accept" style={{ background: settings.accentColor }} disabled={submitting} onClick={()=>void submitDecision("Accepted")}>{submitting ? "Recording…" : "Accept & sign quotation"}</button>
              <details className="public-quote-decline"><summary>Decline this quotation</summary><label className="public-quote-field">Reason <span>Optional</span><textarea value={reason} onChange={e=>setReason(e.target.value)} maxLength={500} placeholder="Tell the business why you are declining…"/></label><button disabled={submitting} onClick={()=>void submitDecision("Declined")}>Confirm decline</button></details>
            </>
          )}
          <div className="public-quote-security"><ShieldCheck size={15}/><span>Your response is recorded securely. No Invoqly account or app installation is needed.</span></div>
        </aside>
      </div>
      <footer className="public-quote-footer">Invoqly · Business, in good order.</footer>
    </main>
  );
}
