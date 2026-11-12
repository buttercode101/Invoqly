export type ReceiptObject = {
  body: ReadableStream<Uint8Array>;
  httpEtag: string;
  writeHttpMetadata(headers: Headers): void;
};

export async function putReceiptObject(_key:string,_bytes:ArrayBuffer,_contentType:string,_workspaceId:string):Promise<void>{
  throw new Error("Private receipt storage is available on the Cloudflare deployment only.");
}
export async function getReceiptObject(_key:string):Promise<ReceiptObject|null>{return null;}
export async function headReceiptObject(_key:string):Promise<boolean>{return false;}
export async function deleteReceiptObject(_key:string):Promise<void>{}
