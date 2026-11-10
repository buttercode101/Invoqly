import "server-only";

type TransactionalEmail={to:string;subject:string;text:string};

export async function sendTransactionalEmail(message:TransactionalEmail) {
  const apiKey=process.env.RESEND_API_KEY;
  const from=process.env.RESEND_FROM_EMAIL||"Invoqly <no-reply@invoqly.xyz>";
  if(!apiKey) throw new Error("Transactional email is not configured. Add RESEND_API_KEY before enabling production email.");
  const response=await fetch("https://api.resend.com/emails",{
    method:"POST",
    headers:{"Authorization":`Bearer ${apiKey}`,"Content-Type":"application/json"},
    body:JSON.stringify({from,to:[message.to],subject:message.subject,text:message.text}),
    cache:"no-store",
  });
  if(!response.ok) {
    const detail=(await response.text()).slice(0,500);
    console.error("email.provider_error",{status:response.status,detail});
    throw new Error("The email provider rejected the message.");
  }
}
