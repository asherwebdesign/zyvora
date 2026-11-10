// Transactional email delivery via Resend. Safe no-op until a verified sender and key exist.
async function sendTransactionalEmail({to,subject,html,text}) {
  const apiKey=process.env.RESEND_API_KEY;
  const from=process.env.EMAIL_FROM;
  if(!apiKey || !from || !to) return { sent:false, reason:"email_not_configured" };
  const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},body:JSON.stringify({from,to,subject,html,text}),signal:AbortSignal.timeout(10000)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data.message||"Email provider rejected the message.");
  return {sent:true,id:data.id||null};
}
module.exports={sendTransactionalEmail};
