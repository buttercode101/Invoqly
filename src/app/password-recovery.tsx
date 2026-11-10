"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, KeyRound, LockKeyhole } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export function PasswordRecovery({mode}:{mode:"request"|"reset"}) {
  const router=useRouter();
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [confirmation,setConfirmation]=useState("");
  const [token,setToken]=useState("");
  const [invalidToken,setInvalidToken]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [busy,setBusy]=useState(false);

  useEffect(()=>{
    if(mode!=="reset")return;
    const params=new URLSearchParams(window.location.search);
    setToken(params.get("token")??"");
    setInvalidToken(params.has("error")||!params.has("token"));
  },[mode]);

  const submit=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();setError("");setNotice("");setBusy(true);
    try {
      if(mode==="request"){
        const result=await authClient.requestPasswordReset({email,redirectTo:`${window.location.origin}/reset-password`});
        if(result.error)throw new Error(result.error.message||"We couldn't request a reset link. Try again later.");
        setNotice("If an account exists for that address, a secure reset link will arrive by email.");
      } else {
        if(!token||invalidToken)throw new Error("This reset link is invalid or has expired. Request a new one.");
        if(password!==confirmation)throw new Error("Your passwords do not match.");
        const result=await authClient.resetPassword({newPassword:password,token});
        if(result.error)throw new Error(result.error.message||"This reset link could not be used. Request a new one.");
        router.replace("/sign-in?reset=1");
        router.refresh();
      }
    } catch(e) {
      setError(e instanceof Error?e.message:"Something went wrong. Please try again.");
    } finally {setBusy(false);}
  };

  return <main className="auth-shell">
    <section className="auth-brand">
      <Link href="/" className="brand"><span className="brand-mark">i<span>.</span></span><span>invoqly</span></Link>
      <div className="auth-brand-copy"><span className="eyebrow"><i/> ACCOUNT SECURITY</span><h1>Back in<br/>control.</h1><p>Secure access to the work and records that matter.</p></div>
      <div className="auth-brand-foot"><span>Designed for independent businesses.</span><span>South Africa first. Open to the world.</span></div>
    </section>
    <section className="auth-main"><div className="auth-card">
      <div className="auth-lock">{mode==="request"?<KeyRound size={18}/>:<LockKeyhole size={18}/>}</div>
      <span className="auth-kicker">ACCOUNT RECOVERY</span>
      <h2>{mode==="request"?"Reset your password":"Choose a new password"}</h2>
      <p className="auth-intro">{mode==="request"?"Enter the email address on your account. We'll send a secure reset link if it matches.":"Create a new password for your Invoqly account."}</p>
      {notice&&<div className="auth-success"><CheckCircle2 size={16}/>{notice}</div>}
      {mode==="reset"&&invalidToken?<div className="auth-error" role="alert">This reset link is missing, invalid or expired. Request a new one below.</div>:null}
      {!(mode==="reset"&&invalidToken)&&<form onSubmit={submit}>
        {mode==="request"?<label>Email address<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" required maxLength={254} placeholder="you@business.com"/></label>:<>
          <label>New password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password" required minLength={12} maxLength={128} placeholder="At least 12 characters"/></label>
          <label>Confirm new password<input type="password" value={confirmation} onChange={e=>setConfirmation(e.target.value)} autoComplete="new-password" required minLength={12} maxLength={128} placeholder="Enter it again"/></label>
        </>}
        {error&&<p className="auth-error" role="alert">{error}</p>}
        <button className="btn btn-primary auth-submit" disabled={busy}>{busy?"Please wait…":mode==="request"?"Send reset link":"Update password"}<ArrowRight size={16}/></button>
      </form>}
      {mode==="reset"&&invalidToken&&<Link className="btn btn-primary auth-submit" href="/forgot-password">Request a new link <ArrowRight size={16}/></Link>}
      <p className="auth-switch"><Link href="/sign-in"><ArrowLeft size={13}/> Back to sign in</Link></p>
      <p className="auth-legal">Reset links are single-use and expire. Never share a password reset email or link.</p>
    </div></section>
  </main>;
}
