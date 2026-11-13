"use client";

import { useEffect,useRef,useState } from "react";
import { Check,Download,FileText,RotateCcw,ShieldCheck,X } from "lucide-react";
import { calculateDocumentTax,calculateDocumentTotal,type DocumentLineItem } from "@/lib/documents";
import { createDocumentPdf } from "@/lib/document-pdf";
import { resolveDocumentSettings,type DocumentSettings } from "@/lib/document-design";

type PublicQuote={
 id:string;number:string;customerName:string;customerEmail:string;customerCompany:string;issueDate:string;validUntil:string;currency:string;status:string;
 lineItems:DocumentLineItem[];documentDesign:Partial<DocumentSettings>|null;decisionStatus:string;signerName?:string|null;signerEmail?:string|null;
 signatureDataUrl?:string|null;decisionAt?:string|null;rejectionReason?:string|null;
};
type PublicData={quote:PublicQuote;business:{name:string;address:string;vatNumber:string};linkExpiresAt:string};
const money=(minor:number,currency:string)=>new Intl.NumberFormat("en-ZA",{style:"currency",currency}).format(minor/100);

export default function PublicQuoteClient({token}:{token:string}){
 const [data,setData]=useState<PublicData|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const [name,setName]=useState(""),[email,setEmail]=useState(""),[reason,setReason]=useState(""),[agreed,setAgreed]=useState(false);
 const [signature,setSignature]=useState(""),[hasInk,setHasInk]=useState(false),[submitting,setSubmitting]=useState(false),[decision,setDecision]=useState<"Accepted"|"Declined"|null>(null);
 const canvasRef=useRef<HTMLCanvasElement|null>(null),drawing=useRef(false);

 useEffect(()=>{let active=true;fetch("/api/public/quotes/"+token,{cache:"no-store"}).then(async response=>{const body=await response.json();if(!response.ok)throw new Error(body.error||"This quotation is not available.");if(active)setData(body as PublicData)}).catch(e=>{if(active)setError(e instanceof Error?e.message:"This quotation could not be loaded.")}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[token]);

 useEffect(()=>{
  const canvas=canvasRef.current;if(!canvas)return;const rect=canvas.getBoundingClientRect();if(!rect.width)return;
  const ratio=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(rect.width*ratio);canvas.height=Math.round(150*ratio);
  const context=canvas.getContext("2d");if(!context)return;context.scale(ratio,ratio);context.fillStyle="#fff";context.fillRect(0,0,rect.width,150);
  context.lineCap="round";context.lineJoin="round";context.lineWidth=2.4;context.strokeStyle="#17251d";
  if(signature){const image=new Image();image.onload=()=>context.drawImage(image,0,0,rect.width,150);image.src=signature}
 },[data,signature]);

 const point=(event:React.PointerEvent<HTMLCanvasElement>)=>{const rect=event.currentTarget.getBoundingClientRect();return{x:event.clientX-rect.left,y:event.clientY-rect.top}};
 const start=(event:React.PointerEvent<HTMLCanvasElement>)=>{const context=event.currentTarget.getContext("2d");if(!context)return;event.currentTarget.setPointerCapture(event.pointerId);drawing.current=true;const p=point(event);context.beginPath();context.moveTo(p.x,p.y)};
 const draw=(event:React.PointerEvent<HTMLCanvasElement>)=>{if(!drawing.current)return;const context=event.currentTarget.getContext("2d");if(!context)return;const p=point(event);context.lineTo(p.x,p.y);context.stroke();setHasInk(true)};
 const stop=()=>{if(!drawing.current||!canvasRef.current)return;drawing.current=false;setSignature(canvasRef.current.toDataURL("image/jpeg",0.84))};
 const clear=()=>{const canvas=canvasRef.current,context=canvas?.getContext("2d");if(!canvas||!context)return;context.clearRect(0,0,canvas.width,canvas.height);context.fillStyle="#fff";context.fillRect(0,0,canvas.width,canvas.height);setSignature("");setHasInk(false)};

 const submit=async(next:"Accepted"|"Declined")=>{
  if(!data||submitting)return;
  if(name.trim().length<2){setError("Enter your full name to record your decision.");return}
  if(next==="Accepted"&&(!agreed||!signature)){setError("Confirm the quotation terms and draw your signature before accepting.");return}
  setSubmitting(true);setError("");
  try{
   const response=await fetch("/api/public/quotes/"+token,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({decision:next,signerName:name.trim(),signerEmail:email.trim(),agreed:agreed||next==="Declined",signatureDataUrl:next==="Accepted"?signature:undefined,rejectionReason:next==="Declined"?reason.trim():""})});
   const body=await response.json();if(!response.ok)throw new Error(body.error||"Your decision could not be recorded.");
   setDecision(next);setData(current=>current?{...current,quote:{...current.quote,status:next,decisionStatus:next,signerName:name.trim(),signerEmail:email.trim(),signatureDataUrl:next==="Accepted"?signature:null,decisionAt:body.decisionAt,rejectionReason:next==="Declined"?reason.trim():null}}:current);
  }catch(e){setError(e instanceof Error?e.message:"Your decision could not be recorded.")}finally{setSubmitting(false)}
 };

 const downloadPdf=()=>{
  if(!data)return;const q=data.quote,settings=resolveDocumentSettings(q.documentDesign);
  try{
   const blob=createDocumentPdf({type:"quotation",number:q.number,businessName:data.business.name,businessAddress:data.business.address,vatNumber:data.business.vatNumber,brandName:settings.brandName,accentColor:settings.accentColor,logoDataUrl:settings.logoDataUrl,customerName:q.customerName,customerCompany:q.customerCompany,customerEmail:q.customerEmail,issueDate:q.issueDate,validUntil:q.validUntil,status:q.status,currency:q.currency,lineItems:q.lineItems,template:settings.templateId,signatureDataUrl:q.signatureDataUrl,signerName:q.signerName,decisionAt:q.decisionAt});
   const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=q.number+".pdf";document.body.appendChild(a);a.click();a.remove();window.setTimeout(()=>URL.revokeObjectURL(url),30000);
  }catch{setError("The quotation PDF could not be generated. Please try again.")}
 };

 if(loading)return <main className="public-quote-state"><div className="public-quote-loader"/>Loading your quotation…</main>;
 if(!data)return <main className="public-quote-state"><div className="public-quote-error"><FileText size={22}/><h1>Quotation unavailable</h1><p>{error||"This link may have expired or been withdrawn."}</p></div></main>;
 const q=data.quote,settings=resolveDocumentSettings(q.documentDesign),total=calculateDocumentTotal(q.lineItems),tax=calculateDocumentTax(q.lineItems);
 const decided=q.decisionStatus!=="Pending"||Boolean(decision);
 return <main className="public-quote-page">
  <header className="public-quote-top"><a href="/" className="public-quote-brand"><span>i.</span> invoqly</a><span>Secure quotation review</span></header>
  <div className="public-quote-layout">
   <section className="public-quote-document">
    <div className="public-quote-document-head" style={{borderColor:settings.accentColor}}>
     {settings.logoDataUrl?<img className="public-quote-logo" src={settings.logoDataUrl} alt="Business logo"/>:<span className="public-quote-mark" style={{background:settings.accentColor}}>{(settings.brandName||data.business.name).slice(0,1).toUpperCase()}</span>}
     <div><p className="public-quote-eyebrow">QUOTATION FROM</p><h1>{settings.brandName||data.business.name}</h1>{data.business.address&&<span className="public-quote-address">{data.business.address}</span>}{data.business.vatNumber&&<span className="public-quote-address">VAT {data.business.vatNumber}</span>}</div>
     <div className="public-quote-number"><b>{q.number}</b><span>Valid until {q.validUntil}</span></div>
    </div>
    <div className="public-quote-recipient"><div><small>PREPARED FOR</small><b>{q.customerName}</b>{q.customerCompany&&<span>{q.customerCompany}</span>}{q.customerEmail&&<span>{q.customerEmail}</span>}</div><div><small>ISSUED</small><b>{q.issueDate}</b></div></div>
    <div className="public-quote-lines"><div className="public-quote-line public-quote-line-head"><span>Description</span><span>Qty</span><span>Unit price</span><span>Amount</span></div>
     {tax.lines.map((line,index)=><div className="public-quote-line" key={index}><span>{line.description}</span><span>{line.quantity}</span><span>{money(line.unitPriceMinor,q.currency)}</span><b>{money(line.grossMinor,q.currency)}</b></div>)}
    </div>
    <div className="public-quote-total"><span>Total</span><b style={{color:settings.accentColor}}>{money(total,q.currency)}</b></div>
    {tax.taxMinor>0&&<p className="public-quote-tax">Includes VAT of {money(tax.taxMinor,q.currency)} where applicable.</p>}
    <div className="public-quote-document-foot"><span>Prepared with Invoqly</span><button onClick={downloadPdf}><Download size={15}/> Download PDF</button></div>
   </section>
   <aside className="public-quote-decision">
    {decided?<div className="public-quote-result"><span className={q.status==="Accepted"?"public-quote-result-icon accepted":"public-quote-result-icon declined"}>{q.status==="Accepted"?<Check/>:<X/>}</span><p className="public-quote-eyebrow">DECISION RECORDED</p><h2>{q.status==="Accepted"?"Quotation accepted":"Quotation declined"}</h2><p>{q.status==="Accepted"?"Your approval has been securely recorded. The business can now follow up with the next steps.":"Your response has been sent to the business."}</p>{q.signerName&&<div className="public-quote-signed"><small>RECORDED FOR</small><b>{q.signerName}</b>{q.decisionAt&&<span>{new Date(q.decisionAt).toLocaleString()}</span>}{q.signatureDataUrl&&<img src={q.signatureDataUrl} alt="Recorded signature"/>}</div>}</div>:<>
     <p className="public-quote-eyebrow">YOUR DECISION</p><h2>Review and respond</h2><p className="public-quote-help">Check the scope, pricing and validity date. Accept with an electronic signature or decline with a note.</p>
     <label className="public-quote-field">Full name<input value={name} onChange={e=>setName(e.target.value)} autoComplete="name" maxLength={120} placeholder="Your full name"/></label>
     <label className="public-quote-field">Email address <span>Optional</span><input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" maxLength={254} placeholder="you@example.com"/></label>
     <label className="public-quote-consent"><input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)}/><span>I have reviewed this quotation and agree to the scope, pricing and terms shown above.</span></label>
     <div className="public-quote-signature"><div><b>Electronic signature</b><span>Draw your signature below to accept</span></div><div className="public-quote-canvas-wrap">{!hasInk&&<span className="public-quote-sign-hint">Sign here</span>}<canvas ref={canvasRef} onPointerDown={start} onPointerMove={draw} onPointerUp={stop} onPointerCancel={stop} aria-label="Draw your electronic signature"/></div><button type="button" className="public-quote-clear" onClick={clear}><RotateCcw size={13}/> Clear signature</button></div>
     {error&&<p className="public-quote-error">{error}</p>}
     <button className="public-quote-accept" style={{background:settings.accentColor}} disabled={submitting} onClick={()=>void submit("Accepted")}>{submitting?"Recording…":"Accept & sign quotation"}</button>
     <details className="public-quote-decline"><summary>Decline this quotation</summary><label className="public-quote-field">Reason <span>Optional</span><textarea value={reason} onChange={e=>setReason(e.target.value)} maxLength={500} placeholder="Tell the business why you are declining…"/></label><button disabled={submitting} onClick={()=>void submit("Declined")}>Confirm decline</button></details>
    </>}
    <div className="public-quote-security"><ShieldCheck size={15}/><span>Your response is recorded securely. No Invoqly account or app installation is needed.</span></div>
   </aside>
  </div>
  <footer className="public-quote-footer">Invoqly · Business, in good order.</footer>
 </main>;
}
