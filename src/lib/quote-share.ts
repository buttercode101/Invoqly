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
  if(!origin)return request.headers.get("sec-fetch-site")==="same-origin";
  try {
    const parsed=new URL(origin);
    const requestUrl=new URL(request.url);
    const forwardedHost=request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const host=forwardedHost||request.headers.get("host")||requestUrl.host;
    const forwardedProto=request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const protocol=forwardedProto?forwardedProto.replace(/:$/,""):requestUrl.protocol.replace(":","");
    const expected=new URL(protocol+"://"+host).origin;
    return parsed.origin===expected||parsed.origin===requestUrl.origin;
  } catch { return false; }
}
