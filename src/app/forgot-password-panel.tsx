"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export function ForgotPasswordPanel(){
 const [email,setEmail]=useState("");
 const [error,setError]=useState("");
 const [sent,setSent]=useState(false);
 const [busy,setBusy]=useState(false);
 const submit=async(event:FormEvent<HTMLFormElement>)=>{
  event.preventDefault();setBusy(true);setError("");
  const result=await authClient.requestPasswordReset({email,redirectTo:"/reset-password"});
  if(result.error)setError(result.error.message||"We couldn't request a reset link.");
  else setSent(true);
  setBusy(false);
 };
 return <main className="auth-shell"><section className="auth-brand"><Link href="/" className="brand"><span className="brand-mark">i<span>.</span></span><span>invoqly</span></Link><div className="auth-brand-copy"><span className="eyebrow"><i/> ACCOUNT SECURITY</span><h1>Back in<br/>your hands.</h1><p>We'll help you regain access without compromising your account.</p></div><div className="auth-brand-foot"><span>Private by design.</span><span>Invoqly account support.</span></div></section><section className="auth-main"><div className="auth-card"><div className="auth-lock"><Mail size={18}/></div><span className="auth-kicker">PASSWORD RECOVERY</span><h2>Reset your password</h2><p className="auth-intro">Enter the email address associated with your account. If it exists, we'll send a secure reset link.</p>{sent?<div className="auth-success">If an account matches that address, a reset email is on its way.</div>:<form onSubmit={submit}><label>Email address<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required maxLength={254} autoComplete="email" placeholder="you@business.com"/></label>{error&&<p className="auth-error" role="alert">{error}</p>}<button className="btn btn-primary auth-submit" disabled={busy}>{busy?"Sending…":"Send reset link"}</button></form>}<p className="auth-switch"><Link href="/sign-in"><ArrowLeft size={13}/> Back to sign in</Link></p></div></section></main>;
}
