import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withDb } from "@/lib/db";
import { auditEvents, quotePublicLinks, quotes } from "@/lib/db/schema";
import { getCurrentUser, getOrCreateWorkspace } from "@/lib/workspace";
import { createQuoteToken, hashQuoteToken, isSameOriginRequest } from "@/lib/quote-share";

export const runtime="nodejs";
export const dynamic="force-dynamic";
function fail(message:string,status=400){return NextResponse.json({error:message},{status,headers:{"Cache-Control":"no-store"}});}

export async function POST(request:Request,context:{params:Promise<{id:string}>}){
 if(!isSameOriginRequest(request))return fail("A same-origin request is required.",403);
 const origin=new URL(request.url).origin;
 const {id}=await context.params;
 if(!/^[0-9a-f-]{36}$/i.test(id))return fail("Quotation not found.",404);
 try{return await withDb(async db=>{
  const user=await getCurrentUser(db,request.headers);
  if(!user)return fail("Sign in to create a client approval link.",401);
  const workspace=await getOrCreateWorkspace(db,user.id);
  const token=createQuoteToken(),tokenHash=await hashQuoteToken(token);
  const result=await db.transaction(async tx=>{
   const [quote]=await tx.select().from(quotes).where(and(eq(quotes.id,id),eq(quotes.workspaceId,workspace.id))).for("update").limit(1);
   if(!quote)return {error:"not-found" as const};
   if(["Accepted","Declined","Converted"].includes(quote.status))return {error:"closed" as const};
   const validUntil=new Date(quote.validUntil+"T23:59:59.999+02:00").getTime();
   if(!Number.isFinite(validUntil)||validUntil<=Date.now())return {error:"expired" as const};
   const expiresAt=new Date(Math.min(Date.now()+30*24*60*60*1000,validUntil));
   await tx.update(quotePublicLinks).set({revokedAt:new Date()}).where(and(eq(quotePublicLinks.workspaceId,workspace.id),eq(quotePublicLinks.quoteId,quote.id),eq(quotePublicLinks.decisionStatus,"Pending")));
   await tx.insert(quotePublicLinks).values({workspaceId:workspace.id,quoteId:quote.id,tokenHash,expiresAt});
   await tx.update(quotes).set({status:"Sent",updatedAt:new Date()}).where(and(eq(quotes.id,quote.id),eq(quotes.workspaceId,workspace.id)));
   await tx.insert(auditEvents).values({workspaceId:workspace.id,actorUserId:user.id,action:"quote.share_link_created",entityType:"quote",entityId:quote.id,metadata:{expiresAt:expiresAt.toISOString()}});
   return {expiresAt};
  });
  if("error" in result){
   if(result.error==="not-found")return fail("Quotation not found.",404);
   if(result.error==="expired")return fail("This quotation has expired. Update its validity date before sharing.",410);
   return fail("A quotation that has already been accepted, declined or converted cannot be shared again.",409);
  }
  return NextResponse.json({url:new URL("/quote/"+token,origin).toString(),expiresAt:result.expiresAt.toISOString()},{headers:{"Cache-Control":"no-store"}});
 });}catch(error){console.error("quote.share_link",error);return fail("The client approval link could not be created. Please try again.",500);}
}

export async function DELETE(request:Request,context:{params:Promise<{id:string}>}){
 if(!isSameOriginRequest(request))return fail("A same-origin request is required.",403);
 const {id}=await context.params;
 if(!/^[0-9a-f-]{36}$/i.test(id))return fail("Quotation not found.",404);
 try{return await withDb(async db=>{
  const user=await getCurrentUser(db,request.headers);
  if(!user)return fail("Sign in to revoke a client approval link.",401);
  const workspace=await getOrCreateWorkspace(db,user.id);
  const result=await db.transaction(async tx=>{
   const [quote]=await tx.select().from(quotes).where(and(eq(quotes.id,id),eq(quotes.workspaceId,workspace.id))).for("update").limit(1);
   if(!quote)return {error:"not-found" as const};
   if(quote.status!=="Sent"&&quote.status!=="Viewed")return {error:"not-open" as const};
   const now=new Date();
   const revoked=await tx.update(quotePublicLinks).set({revokedAt:now}).where(and(eq(quotePublicLinks.workspaceId,workspace.id),eq(quotePublicLinks.quoteId,quote.id),eq(quotePublicLinks.decisionStatus,"Pending"))).returning({id:quotePublicLinks.id});
   if(!revoked.length)return {error:"no-link" as const};
   await tx.update(quotes).set({status:"Draft",updatedAt:now}).where(and(eq(quotes.id,quote.id),eq(quotes.workspaceId,workspace.id)));
   await tx.insert(auditEvents).values({workspaceId:workspace.id,actorUserId:user.id,action:"quote.share_link_revoked",entityType:"quote",entityId:quote.id,metadata:{revokedLinks:revoked.length}});
   return {ok:true as const};
  });
  if("error" in result)return result.error==="not-found"?fail("Quotation not found.",404):fail("There is no open approval link to revoke.",409);
  return NextResponse.json({ok:true},{headers:{"Cache-Control":"no-store"}});
 });}catch(error){console.error("quote.revoke_share_link",error);return fail("The client approval link could not be revoked. Please try again.",500);}
}
