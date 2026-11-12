import { env } from "cloudflare:workers";
import type { ReceiptObject } from "./receipts";

type ReceiptBucket = {
  put(key:string,value:ArrayBuffer,options?:{httpMetadata?:{contentType?:string;cacheControl?:string};customMetadata?:Record<string,string>}):Promise<unknown>;
  get(key:string):Promise<ReceiptObject|null>;
  head(key:string):Promise<unknown|null>;
  delete(key:string):Promise<void>;
};
const bucket=()=> (env as unknown as {R2_RECEIPTS:ReceiptBucket}).R2_RECEIPTS;
export async function putReceiptObject(key:string,bytes:ArrayBuffer,contentType:string,workspaceId:string):Promise<void>{
  await bucket().put(key,bytes,{httpMetadata:{contentType,cacheControl:"private, no-store"},customMetadata:{workspaceId,kind:"expense-receipt"}});
}
export async function getReceiptObject(key:string):Promise<ReceiptObject|null>{return bucket().get(key);}
export async function headReceiptObject(key:string):Promise<boolean>{return Boolean(await bucket().head(key));}
export async function deleteReceiptObject(key:string):Promise<void>{await bucket().delete(key);}
