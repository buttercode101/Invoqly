"use client";

import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowDownRight, ArrowUpRight, Bell, CalendarDays, ChevronDown, ChevronRight, CircleHelp, Command, CreditCard, Download, FileCheck2, FilePlus2, FileText, Home, LifeBuoy, MoreHorizontal, Plus, Search, Settings2, Sparkles, Users, Wallet, X } from "lucide-react";

type Status = "Paid" | "Awaiting payment" | "Overdue";
const records = [
 {id:"INV-0148",client:"Northstar Studio",initials:"NS",date:"Nov 08, 2026",amount:4250,currency:"USD",status:"Awaiting payment" as Status,tone:"sand"},
 {id:"INV-0147",client:"Forma & Field",initials:"FF",date:"Nov 07, 2026",amount:187500,currency:"ZAR",status:"Paid" as Status,tone:"lilac"},
 {id:"INV-0146",client:"Goodwell Partners",initials:"GP",date:"Nov 05, 2026",amount:2800,currency:"USD",status:"Overdue" as Status,tone:"mint"},
 {id:"INV-0145",client:"Morrow Digital",initials:"MD",date:"Nov 03, 2026",amount:960,currency:"EUR",status:"Awaiting payment" as Status,tone:"peach"},
 {id:"INV-0144",client:"Atelier August",initials:"AA",date:"Oct 30, 2026",amount:32500,currency:"ZAR",status:"Paid" as Status,tone:"blue"}
];
const groups = [
 {title:"WORKSPACE",items:[["Overview",Home],["Invoices",FileText],["Clients",Users],["Expenses",Wallet],["Payments",CreditCard]] as const},
 {title:"MANAGE",items:[["Reports",FileCheck2],["Settings",Settings2]] as const}
];
const fmt=(n:number,c:string)=>new Intl.NumberFormat("en",{style:"currency",currency:c,maximumFractionDigits:c==="ZAR"?2:0}).format(n);

export default function HomePage(){
 const [active,setActive]=useState("Overview"),[query,setQuery]=useState(""),[period,setPeriod]=useState("Last 30 days"),[create,setCreate]=useState(false),[notice,setNotice]=useState(false);
 const rows=useMemo(()=>records.filter(r=>(r.id+" "+r.client+" "+r.status).toLowerCase().includes(query.toLowerCase())),[query]);
 return <main className="shell">
  <aside className="sidebar">
   <a className="brand" href="#"><span className="brand-mark">i<span>.</span></span><span>invoqly</span></a>
   <button className="workspace-switch"><span className="workspace-avatar">S</span><span className="workspace-copy"><b>Studio North</b><small>Preview workspace</small></span><ChevronDown size={15}/></button>
   <nav className="side-nav">{groups.map(g=><div className="nav-group" key={g.title}><p className="nav-label">{g.title}</p>{g.items.map(([label,Icon])=><button key={label} onClick={()=>setActive(label)} className={"nav-item "+(active===label?"active":"")}><Icon size={17}/><span>{label}</span>{label==="Invoices"&&<small>12</small>}</button>)}</div>)}</nav>
   <div className="sidebar-bottom"><div className="upgrade-card"><span className="upgrade-icon"><Sparkles size={16}/></span><b>Make room to grow.</b><p>Tools that grow with the way you work.</p><button onClick={()=>setActive("Plans")}>Explore plans <ArrowUpRight size={13}/></button></div><button className="nav-item"><CircleHelp size={17}/><span>Help & support</span></button><div className="profile-row"><div className="profile-avatar">RN</div><span className="profile-copy"><b>Riley North</b><small>Workspace owner</small></span><MoreHorizontal size={18}/></div></div>
  </aside>
  <section className="main-area">
   <header className="topbar"><div className="breadcrumb"><span>Workspace</span><ChevronRight size={14}/><b>{active}</b></div><div className="top-actions"><label className="search-box"><Search size={16}/><input aria-label="Search invoices" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search anything…"/><kbd><Command size={10}/> K</kbd></label><button className="icon-button notification" aria-label="Notifications" onClick={()=>setNotice(!notice)}><Bell size={18}/><i/></button><button className="help-button"><LifeBuoy size={16}/> Help</button></div></header>
   {notice&&<div className="notice-pop"><div><b>Notifications</b><button onClick={()=>setNotice(false)} aria-label="Close"><X size={15}/></button></div><p>You’re all caught up. New activity will appear here.</p></div>}
   <div className="page-content">
    <div className="welcome-row"><div><div className="eyebrow"><i/> MONDAY, NOVEMBER 10, 2026</div><h1>Good morning, Riley<span>.</span></h1><p className="subtitle">Here’s what’s happening with your business.</p></div><div className="welcome-actions"><button className="btn btn-light"><Download size={15}/> Export</button><button className="btn btn-primary" onClick={()=>setCreate(true)}><Plus size={17}/> Create new</button></div></div>
    <div className="demo-banner"><Sparkles size={15}/><span><b>Preview workspace</b> · Illustrative figures and sample records, not live financial data.</span><button onClick={()=>setCreate(true)}>Try creating something <ArrowUpRight size={13}/></button></div>
    <div className="section-heading"><div><h2>Your overview</h2><p>A snapshot of your financial activity.</p></div><button className="period-select" onClick={()=>setPeriod(period==="Last 30 days"?"This month":"Last 30 days")}><CalendarDays size={15}/>{period}<ChevronDown size={14}/></button></div>
    <div className="metrics-grid">
     <Metric title="Total invoiced" value="R 284,500" unit="ZAR" icon={<FileText size={17}/>} tone="green" trend="12.8%" note="vs previous period"/>
     <Metric title="Collected" value="R 196,250" unit="ZAR" icon={<ArrowDownLeft size={17}/>} tone="blue" trend="8.2%" note="vs previous period"/>
     <Metric title="Awaiting payment" value="R 68,250" unit="ZAR" icon={<Wallet size={17}/>} tone="amber" trend="6 invoices" note="across 4 clients"/>
     <Metric title="Overdue" value="R 20,000" unit="ZAR" icon={<ArrowDownRight size={17}/>} tone="rose" trend="2 invoices" note="needs your attention"/>
    </div>
    <div className="content-grid">
     <section className="panel invoice-panel"><div className="panel-head"><div><h2>Recent invoices</h2><p>Your latest billing activity</p></div><button className="text-link" onClick={()=>setActive("Invoices")}>View all <ArrowUpRight size={14}/></button></div><div className="table-wrap"><table><thead><tr><th>CLIENT</th><th>ISSUED</th><th>AMOUNT</th><th>STATUS</th><th/></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td><div className="client-cell"><span className={"client-avatar "+r.tone}>{r.initials}</span><span><b>{r.client}</b><small>{r.id}</small></span></div></td><td className="date-cell">{r.date}</td><td className="amount-cell">{fmt(r.amount,r.currency)}<small>{r.currency}</small></td><td><span className={"status "+r.status.toLowerCase().replaceAll(" ","-")}><i/>{r.status}</span></td><td><button className="row-more" aria-label={"Options for "+r.id}><MoreHorizontal size={17}/></button></td></tr>)}</tbody></table>{rows.length===0&&<p className="empty">No invoices match “{query}”.</p>}</div><div className="panel-foot">Showing {rows.length} of 5 sample invoices <button onClick={()=>setActive("Invoices")}>Go to invoices <ArrowUpRight size={13}/></button></div></section>
     <section className="panel cash-panel"><div className="panel-head"><div><h2>Cash flow</h2><p>Money in and out</p></div><MoreHorizontal size={18}/></div><div className="cash-total">R 72,840 <span><ArrowUpRight size={13}/> 9.4%</span></div><small className="muted">Net cash flow · ZAR</small><div className="legend"><span><i/> Inflow</span><span><i/> Outflow</span></div><div className="chart"><div className="axis"><span>80k</span><span>60k</span><span>40k</span><span>20k</span><span>0</span></div><div className="bars">{[[42,20],[66,28],[51,24],[78,35],[58,31],[88,38],[72,29],[96,42],[63,26],[81,34],[70,30],[92,40]].map((v,i)=><div className="bar-pair" key={i}><i style={{height:v[0]+"%"}}/><i style={{height:v[1]+"%"}}/></div>)}</div></div><div className="months"><span>Jun</span><span>Jul</span><span>Aug</span><span>Sep</span><span>Oct</span><span>Nov</span></div></section>
    </div>
    <div className="bottom-grid"><section className="panel attention-panel"><div className="panel-head"><div><h2>Needs attention</h2><p>A few things to keep moving</p></div><span className="count">2</span></div><Attention icon={<FileText size={16}/>} title="2 overdue invoices" detail="Goodwell Partners · $2,800"/><Attention icon={<Bell size={16}/>} title="6 invoices awaiting payment" detail="Consider sending a gentle reminder"/></section><section className="panel quick-panel"><div className="panel-head"><div><h2>Quick actions</h2><p>Pick up where you left off</p></div></div><div className="quick-actions"><button onClick={()=>setCreate(true)}><FilePlus2 size={17}/><b>New invoice</b><ArrowUpRight size={13}/></button><button onClick={()=>setActive("Clients")}><Users size={17}/><b>Add a client</b><ArrowUpRight size={13}/></button><button onClick={()=>setActive("Expenses")}><Wallet size={17}/><b>Record expense</b><ArrowUpRight size={13}/></button></div></section></div>
    <footer className="page-footer"><span>Invoqly · Business, in good order.</span><span>Preview environment · Sample data only</span></footer>
   </div>
  </section>
  {create&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setCreate(false)}}><section className="create-modal" role="dialog" aria-modal="true" aria-labelledby="create-title"><div className="modal-top"><span className="modal-icon"><FilePlus2 size={19}/></span><button onClick={()=>setCreate(false)} aria-label="Close"><X size={18}/></button></div><h2 id="create-title">What would you like to create?</h2><p>Choose a starting point for your next piece of work.</p>{[["Invoice","Bill a client for work completed.",FileText],["Quote","Send an estimate before work begins.",FileCheck2],["Expense","Keep track of money going out.",Wallet]].map(([title,desc,Icon]:any)=><button className="create-option" key={title} onClick={()=>{setCreate(false);setActive(title==="Quote"?"Quotes":title==="Expense"?"Expenses":"Invoices")}}><span><Icon size={18}/></span><span><b>{title}</b><small>{desc}</small></span><ChevronRight size={17}/></button>)}</section></div>}
 </main>
}
function Metric({title,value,unit,icon,tone,trend,note}:any){return <article className="metric-card"><div className="metric-top"><span>{title}</span><span className={"metric-icon "+tone}>{icon}</span></div><strong className="metric-value">{value}<small> {unit}</small></strong><div className="metric-foot"><b>{trend}</b><span>{note}</span></div></article>}
function Attention({icon,title,detail}:any){return <div className="attention-item"><span>{icon}</span><span><b>{title}</b><small>{detail}</small></span><ArrowUpRight size={15}/></div>}
