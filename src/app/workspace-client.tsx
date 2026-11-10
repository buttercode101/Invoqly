"use client";

import { useEffect, useMemo, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { deriveInvoiceStatus, outstandingBalanceMinor } from "@/lib/billing";
import { decimalToMinor, formatMinor } from "@/lib/money";
import { ArrowDownLeft, ArrowDownRight, ArrowUpRight, Bell, CalendarDays, ChevronDown, ChevronRight, CircleHelp, Command, CreditCard, Download, FileCheck2, FilePlus2, FileText, Home, LifeBuoy, MoreHorizontal, Plus, Search, Settings2, Sparkles, Users, Wallet, X, Trash2, Printer, Check, Pencil, Building2, Receipt, CircleDollarSign, LogOut } from "lucide-react";

type Status = "Draft" | "Sent" | "Partially paid" | "Paid" | "Overdue";
type Client = { id:string; name:string; email:string; company:string; currency:string; createdAt:string };
type Invoice = { id:string; clientId:string; number:string; issueDate:string; dueDate:string; description:string; quantity:number; unitPriceMinor:number; currency:string; status:Status; createdAt:string };
type Payment = { id:string; invoiceId:string; clientId:string; date:string; amountMinor:number; currency:string; method:string; reference:string; notes:string; createdAt:string };
type Expense = { id:string; vendor:string; category:string; date:string; amountMinor:number; currency:string; notes:string };
type Store = { clients:Client[]; invoices:Invoice[]; payments:Payment[]; expenses:Expense[]; businessName:string; currency:string; locale:string };
const seed:Store = { businessName:"Your business",currency:"ZAR",locale:"en-ZA",clients:[],invoices:[],payments:[],expenses:[] };
const groups=[{title:"WORKSPACE",items:[["Overview",Home],["Invoices",FileText],["Clients",Users],["Expenses",Wallet],["Payments",CreditCard]] as const},{title:"MANAGE",items:[["Reports",FileCheck2],["Settings",Settings2]] as const}];
const fmt=(n:number,c:string)=>formatMinor(n,c,"en-ZA");
const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-")};
const dateAfterDays=(days:number)=>{const d=new Date();d.setDate(d.getDate()+days);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-")};
const invoiceAmountMinor=(invoice:Pick<Invoice,"quantity"|"unitPriceMinor">)=>{if(!Number.isSafeInteger(invoice.quantity)||invoice.quantity<1||!Number.isSafeInteger(invoice.unitPriceMinor)||invoice.unitPriceMinor<0)throw new Error("Invoice quantity and unit price must be valid safe integers.");const total=invoice.quantity*invoice.unitPriceMinor;if(!Number.isSafeInteger(total))throw new Error("Invoice line total exceeds the supported amount.");return total};
const moneyTotal=(rows:{amountMinor?:number;quantity?:number;unitPriceMinor?:number}[])=>rows.reduce((s,r)=>{const value=r.amountMinor??(r.quantity??1)*(r.unitPriceMinor??0);const total=s+value;if(!Number.isSafeInteger(total))throw new Error("Workspace total exceeds the supported amount.");return total},0);
const invoiceTotal=(rows:Invoice[])=>rows.reduce((sum,invoice)=>{const total=sum+invoiceAmountMinor(invoice);if(!Number.isSafeInteger(total))throw new Error("Invoice total exceeds the supported amount.");return total},0);
const initials=(name:string)=>name.split(/\s+/).slice(0,2).map(s=>s[0]).join("").toUpperCase();
const escapeHtml=(value:unknown)=>String(value).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");

export default function WorkspaceClient({user}:{user:{id:string;name:string;email:string}}){
 const [store,setStore]=useState<Store>(seed),[loaded,setLoaded]=useState(false),[loadError,setLoadError]=useState("");
 const [actionError,setActionError]=useState(""),[saving,setSaving]=useState(false);
 const [active,setActive]=useState("Overview"),[query,setQuery]=useState(""),[create,setCreate]=useState(""),[notice,setNotice]=useState(false);
 const refreshWorkspace=async()=>{const response=await fetch("/api/workspace",{cache:"no-store"});const result=await response.json();if(!response.ok)throw new Error(result.error||"Workspace could not be loaded.");setStore(result.workspace);setLoaded(true);};
 useEffect(()=>{let alive=true;(async()=>{try{const response=await fetch("/api/workspace",{cache:"no-store"});const result=await response.json();if(!response.ok)throw new Error(result.error||"Workspace could not be loaded.");if(alive){setStore(result.workspace);setLoaded(true)}}catch(error){if(alive){setLoadError(error instanceof Error?error.message:"Workspace could not be loaded.");setLoaded(true)}}})();return()=>{alive=false}},[]);
 const mutate=async(payload:Record<string,unknown>)=>{setSaving(true);setActionError("");try{const response=await fetch("/api/workspace",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const result=await response.json();if(!response.ok)throw new Error(result.error||"The change could not be saved.");setStore(result.workspace);return true}catch(error){setActionError(error instanceof Error?error.message:"The change could not be saved.");return false}finally{setSaving(false)}};

