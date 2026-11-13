export function createQuoteToken():string {
  const bytes=new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes,byte=>byte.toString(16).padStart(2,"0")).join("");
}
export async function hashQuoteToken(token:string):Promise<string>{
  if(!/^[a-f0-9]{64}$/.test(token))throw new Error("Invalid quotation link token.");
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,"0")).join("");
}

export function isValidQuoteToken(token:string):boolean {
  return /^[a-f0-9]{64}$/.test(token);
}
export function isSameOriginRequest(request:Request):boolean {
  const origin=request.headers.get("origin");
  return Boolean(origin&&origin===new URL(request.url).origin);
}
