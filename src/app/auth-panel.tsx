"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff, LockKeyhole } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export function AuthPanel({mode}:{mode:"sign-in"|"sign-up"}) {
  const [name,setName]=useState("");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [showPassword,setShowPassword]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [busy,setBusy]=useState(false);
  useEffect(()=>{if(mode!=="sign-in")return;const params=new URLSearchParams(window.location.search);if(params.get("created")==="1")setNotice("Account created. Check your inbox if email verification is required.");if(params.get("reset")==="1")setNotice("Your password has been updated. Sign in with your new password.");},[mode]);
  const submit=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();setError("");setBusy(true);
    try {
      if(mode==="sign-up"){
        const result=await authClient.signUp.email({name,email,password});
        if(result.error) throw new Error(result.error.message||"Account creation failed.");
        window.location.assign("/sign-in?created=1");
      } else {
        const result=await authClient.signIn.email({email,password,rememberMe:true});
        if(result.error) throw new Error(result.error.message||"Sign in failed.");
        window.location.assign("/");
      }
    } catch(e) {setError(e instanceof Error?e.message:"Something went wrong. Please try again.");}
    finally {setBusy(false);}
  };
  return <main className="auth-shell"><section className="auth-brand"><Link href="/" className="brand"><span className="brand-mark">i<span>.</span></span><span>invoqly</span></Link><div className="auth-brand-copy"><span className="eyebrow"><i/> BUSINESS, IN GOOD ORDER</span><h1>Make the work<br/>feel lighter.</h1><p>Invoices, clients and cash flow — together in one considered workspace.</p></div><div className="auth-brand-foot"><span>Designed for independent businesses.</span><span>South Africa first. Open to the world.</span></div></section><section className="auth-main"><div className="auth-card"><div className="auth-lock"><LockKeyhole size={18}/></div><span className="auth-kicker">{mode==="sign-in"?"WELCOME BACK":"GET STARTED"}</span><h2>{mode==="sign-in"?"Sign in to Invoqly":"Create your workspace"}</h2><p className="auth-intro">{mode==="sign-in"?"Pick up where your business left off.":"A calmer way to manage the money side of your work."}</p>{notice&&<div className="auth-success">{notice}</div>}<form onSubmit={submit}>{mode==="sign-up"&&<label>Your name<input value={name} onChange={e=>setName(e.target.value)} autoComplete="name" required minLength={2} maxLength={80} placeholder="Your full name"/></label>}<label>Email address<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" required maxLength={254} placeholder="you@business.com"/></label><label>Password<span className="password-input"><input type={showPassword?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} autoComplete={mode==="sign-in"?"current-password":"new-password"} required minLength={mode==="sign-up"?12:1} maxLength={128} placeholder={mode==="sign-up"?"At least 12 characters":"Your password"}/><button type="button" onClick={()=>setShowPassword(!showPassword)} aria-label={showPassword?"Hide password":"Show password"}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></span>{mode==="sign-up"&&<small>Use at least 12 characters. A unique passphrase is best.</small>}</label>{error&&<p className="auth-error" role="alert">{error}</p>}<button className="btn btn-primary auth-submit" disabled={busy}>{busy?"Please wait…":mode==="sign-in"?"Sign in":"Create account"}<ArrowRight size={16}/></button></form><p className="auth-switch">{mode==="sign-in"?<> <Link href="/forgot-password">Forgot password?</Link><br/>New to Invoqly?</>:"Already have an account?"} <Link href={mode==="sign-in"?"/sign-up":"/sign-in"}>{mode==="sign-in"?"Create an account":"Sign in"}</Link></p><p className="auth-legal">By continuing, you agree to use Invoqly responsibly and keep your account credentials private.</p></div></section></main>;
}
