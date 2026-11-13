import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withDb } from "@/lib/db";
import { quotePublicLinks, quotes, workspaces } from "@/lib/db/schema";
import { hashQuoteToken } from "@/lib/quote-share";
import { resolveDocumentLineItems } from "@/lib/documents";

export const runtime="nodejs";
export const dynamic="force-dynamic";
type Context={params:Promise<{token:string}>};
const decisionSchema=z.object({
 decision:z.enum(["Accepted","Declined"]),
 signerName:z.string().trim().min(2).max(120),
 signerEmail:z.string().trim().email().max(254).optional().or(z.literal("")),
 agreed:z.literal(true).optional(),
 signatureDataUrl:z.string().max(180000).regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/).optional(),
 rejectionReason:z.string().trim().max(500).optional().default(""),
});
function fail(message:string,status=400){return NextResponse.json({error:message},{status,headers:{"Cache-Control":"no-store"}});}
function localBusinessDate(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Johannesburg"}).format(new Date())}
function isExpired(link:{revokedAt:Date|null;expiresAt:Date}){return Boolean(link.revokedAt||link.expiresAt.getTime()<=Date.now());}

export async function GET(_request:Request,context:Context){
 const {token}=await context.params;
 if(!/^[a-f0-9]{64}$/.test(token))return fail("This quotation link is not valid.",404);
 try{return await withDb(async db=>{
  const tokenHash=await hashQuoteToken(token);
  const [link]=await db.select().from(quotePublicLinks).where(eq(quotePublicLinks.tokenHash,tokenHash)).limit(1);
  if(!link)return fail("This quotation link is not available.",404);
  if(isExpired(link))return fail("This quotation link has expired or been revoked.",410);
  const [quote]=await db.select().from(quotes).where(and(eq(quotes.id,link.quoteId),eq(quotes.workspaceId,link.workspaceId))).limit(1);
  if(!quote)return fail("This quotation is no longer available.",404);
  if(link.decisionStatus==="Pending"&&quote.status!=="Sent"&&quote.status!=="Viewed")return fail("This quotation is no longer open for a decision.",409);
  if(link.decisionStatus==="Pending"&&quote.validUntil<localBusinessDate())return fail("This quotation has expired. Ask the sender for an updated quotation.",410);
  const [workspace]=await db.select({businessName:workspaces.businessName,businessAddress:workspaces.businessAddress,vatNumber:workspaces.vatNumber,documentSettings:workspaces.documentSettings}).from(workspaces).where(eq(workspaces.id,link.workspaceId)).limit(1);
  const viewedAt=new Date();await db.update(quotePublicLinks).set({lastViewedAt:viewedAt}).where(eq(quotePublicLinks.id,link.id));if(link.decisionStatus==="Pending"&&quote.status==="Sent")await db.update(quotes).set({status:"Viewed",updatedAt:viewedAt}).where(and(eq(quotes.id,quote.id),eq(quotes.workspaceId,quote.workspaceId),eq(quotes.status,"Sent")));
  const lineItems=resolveDocumentLineItems(quote.lineItems,{description:quote.description,quantity:quote.quantity,unitPriceMinor:quote.unitPriceMinor});
  return NextResponse.json({
   quote:{id:quote.id,number:quote.number,customerName:quote.customerName,customerEmail:quote.customerEmail,customerCompany:quote.customerCompany,issueDate:quote.issueDate,validUntil:quote.validUntil,currency:quote.currency,status:quote.status,lineItems,documentDesign:quote.documentDesign??workspace?.documentSettings??null,decisionStatus:link.decisionStatus,signerName:link.signerName,signerEmail:link.signerEmail,signatureDataUrl:link.signatureDataUrl,agreementAt:link.agreedAt?.toISOString()??null,decisionAt:link.decisionAt?.toISOString()??null,rejectionReason:link.rejectionReason},
   business:{name:workspace?.businessName??"Your business",address:workspace?.businessAddress??"",vatNumber:workspace?.vatNumber??""},
   linkExpiresAt:link.expiresAt.toISOString()
  },{headers:{"Cache-Control":"private, no-store"}});
 });}catch(error){console.error("quote.public_get",error);return fail("The quotation could not be loaded. Please try again.",500);}
}

export async function POST(request:Request,context:Context){
 const {token}=await context.params;
 const origin=request.headers.get("origin");
 if(!origin||origin!==new URL(request.url).origin)return fail("A same-origin request is required.",403);
 if(!/^[a-f0-9]{64}$/.test(token))return fail("This quotation link is not available.",404);
 if(!(request.headers.get("content-type")||"").toLowerCase().includes("application/json"))return fail("JSON content is required.",415);
 try{
  const parsed=decisionSchema.safeParse(await request.json());
  if(!parsed.success)return fail("Check your name, consent and signature before submitting.",422);
  const input=parsed.data;
  if(input.decision==="Accepted"&&(!input.agreed||!input.signatureDataUrl))return fail("Confirm the terms and draw your signature before accepting.",422);
  return await withDb(async db=>{
   const tokenHash=await hashQuoteToken(token);
   const result=await db.transaction(async tx=>{
    const [link]=await tx.select().from(quotePublicLinks).where(eq(quotePublicLinks.tokenHash,tokenHash)).for("update").limit(1);
    if(!link)return {error:"not-found" as const};
    if(isExpired(link))return {error:"expired" as const};
    if(link.decisionStatus!=="Pending")return {error:"decided" as const};
    const [quote]=await tx.select().from(quotes).where(and(eq(quotes.id,link.quoteId),eq(quotes.workspaceId,link.workspaceId))).for("update").limit(1);
    if(!quote)return {error:"not-found" as const};
    if(quote.status!=="Sent"&&quote.status!=="Viewed")return {error:"closed" as const};
    if(quote.validUntil<localBusinessDate())return {error:"expired" as const};
    const now=new Date();
    await tx.update(quotePublicLinks).set({decisionStatus:input.decision,signerName:input.signerName,signerEmail:input.signerEmail||null,signatureDataUrl:input.decision==="Accepted"?input.signatureDataUrl:null,agreedAt:input.decision==="Accepted"?now:null,rejectionReason:input.decision==="Declined"?input.rejectionReason:null,decisionAt:now}).where(eq(quotePublicLinks.id,link.id));
    await tx.update(quotes).set({status:input.decision,updatedAt:now}).where(and(eq(quotes.id,quote.id),eq(quotes.workspaceId,quote.workspaceId)));
    return {decision:input.decision,decisionAt:now.toISOString()};
   });
   if("error" in result){
    if(result.error==="not-found")return fail("This quotation link is not available.",404);
    if(result.error==="expired")return fail("This quotation has expired or its link has been revoked.",410);
    if(result.error==="decided")return fail("A decision has already been recorded for this quotation.",409);
    return fail("This quotation is no longer open for a decision.",409);
   }
   return NextResponse.json({ok:true,...result},{headers:{"Cache-Control":"no-store"}});
  });
 }catch(error){console.error("quote.public_decision",error);return fail("Your decision could not be recorded. Please try again.",500);}
}
