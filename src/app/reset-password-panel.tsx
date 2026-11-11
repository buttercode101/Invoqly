"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export function ResetPasswordPanel(){
 const [token,setToken]=useState("");
 const [password,setPassword]=useState("");
 const [confirmation,setConfirmation]=useState("");
 const [error,setError]=useState("");
 const [done,setDone]=useState(false);
 const [busy,setBusy]=useState(false);
 useEffect(()=>{
  const params=new URLSearchParams(window.location.search);
  setToken(params.get("token")||"");
  if(params.has("error"))setError("This reset link is invalid or has expired. Request a new one.");
 },[]);
 const submit=async(event:FormEvent<HTMLFormElement>)=>{
  event.preventDefault();setBusy(true);setError("");
  try {
   if(!token)throw new Error("This reset link is missing or invalid. Request a new one.");
   if(password!==confirmation)throw new Error("Your passwords do not match.");
   const result=await authClient.resetPassword({newPassword:password,token});
   if(result.error)throw new Error(result.error.message||"The reset link is invalid or expired. Request a new one.");
   setDone(true);
  } catch(e) {
   setError(e instanceof Error?e.message:"The password could not be updated. Request a new reset link.");
  } finally {setBusy(false);}
 };
 return <main className="auth-shell"><section className="auth-brand"><Link href="/" className="brand"><span className="brand-mark">i<span>.</span></span><span>invoqly</span></Link><div className="auth-brand-copy"><span className="eyebrow"><i/> ACCOUNT SECURITY</span><h1>A fresh<br/>start.</h1><p>Choose a strong password you don't use anywhere else.</p></div><div className="auth-brand-foot"><span>Private by design.</span><span>Invoqly account support.</span></div></section><section className="auth-main"><div className="auth-card"><div className="auth-lock"><LockKeyhole size={18}/></div><span className="auth-kicker">PASSWORD RECOVERY</span><h2>Choose a new password</h2><p className="auth-intro">Use at least 12 characters.</p>{done?<div className="auth-success">Your password has been updated. <Link href="/sign-in?reset=1">Sign in</Link></div>:<form onSubmit={submit}><label>New password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={12} maxLength={128} autoComplete="new-password" placeholder="At least 12 characters"/></label><label>Confirm new password<input type="password" value={confirmation} onChange={e=>setConfirmation(e.target.value)} required minLength={12} maxLength={128} autoComplete="new-password" placeholder="Enter it again"/></label>{(!token||error)&&<p className="auth-error" role="alert">{error||"This reset link is missing or invalid. Request a new link."}</p>}<button className="btn btn-primary auth-submit" disabled={busy||!token}>{busy?"Updating…":"Update password"}</button>{!token&&<p className="auth-switch"><Link href="/forgot-password">Request a new reset link</Link></p>}</form>}<p className="auth-switch"><Link href="/sign-in"><ArrowLeft size={13}/> Back to sign in</Link></p></div></section></main>;
}
