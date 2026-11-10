(()=>{
 const $=s=>document.querySelector(s);let overview=null;
 const api=async(url,options={})=>{const r=await fetch(url,{credentials:'same-origin',headers:{'Content-Type':'application/json'},...options});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'ZI could not complete that request.');return d};
 const ngn=v=>'₦'+(Number(v||0)/100).toLocaleString('en-NG',{maximumFractionDigits:0});
 function bubble(text,who='zi'){const el=document.createElement('div');el.className='bubble '+who;el.textContent=text;$('#messages').append(el);$('#messages').scrollTop=$('#messages').scrollHeight;}
 let recognition=null,voiceActive=false,isSpeaking=false,restartTimer=null;
 function speak(text){
  if(!('speechSynthesis'in window)){voiceStatus('Speech playback is not supported in this browser.');return;}
  isSpeaking=true;
  if(recognition){try{recognition.stop()}catch{}}
  window.speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(text);
  const lang=localStorage.getItem('zyvora-language')||'en';
  u.lang=lang==='en'?'en-GB':lang;
  const voices=window.speechSynthesis.getVoices();
  const female=voices.find(v=>/female|samantha|victoria|serena|karen|moira|tessa|zira|aria|jenny|susan|sara/i.test(v.name));
  const regional=voices.find(v=>v.lang.toLowerCase().startsWith(u.lang.toLowerCase().slice(0,2)));
  if(female)u.voice=female;else if(regional)u.voice=regional;
  u.rate=0.98;u.pitch=1.16;
  u.onend=()=>{isSpeaking=false;if(voiceActive){voiceStatus('Your turn — speak naturally. No wake phrase needed.');scheduleRecognitionRestart(250);}};
  u.onerror=()=>{isSpeaking=false;if(voiceActive)scheduleRecognitionRestart(500);};
  window.speechSynthesis.speak(u);
 }
 function scheduleRecognitionRestart(delay=350){
  clearTimeout(restartTimer);
  if(!voiceActive||isSpeaking)return;
  restartTimer=setTimeout(()=>{if(!voiceActive||isSpeaking||!recognition)return;try{recognition.start()}catch{}},delay);
 }
 function startVoice(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){voiceStatus('Continuous voice input is unavailable in this browser. Please use Chrome or Edge.');return;}
  if(voiceActive)return;
  recognition=new SR();recognition.lang='en-NG';recognition.continuous=true;recognition.interimResults=false;recognition.maxAlternatives=1;
  recognition.onstart=()=>{voiceActive=true;$('#voiceStart').disabled=true;$('#voiceStop').disabled=false;voiceStatus('ZI is listening. Speak naturally — no “Hey Zed” required.');speak('Hello! I am ZI, your ZYVORA assistant. I am here. What would you like to do?');};
  recognition.onresult=async event=>{
   for(let i=event.resultIndex;i<event.results.length;i++){
    if(!event.results[i].isFinal)continue;
    const said=event.results[i][0].transcript.trim();
    if(!said||!voiceActive)continue;
    if(isSpeaking)continue;
    voiceStatus('ZI is thinking…');
    await ask(said,{speak:true});
   }
  };
  recognition.onerror=e=>{
   if(e.error==='not-allowed'||e.error==='service-not-allowed'){voiceStatus('Microphone permission is blocked. Allow microphone access in your browser, then try again.');stopVoice();return;}
   if(e.error==='audio-capture'){voiceStatus('No microphone was found. Connect or enable a microphone.');stopVoice();return;}
   if(e.error!=='no-speech'&&e.error!=='aborted')voiceStatus('Voice input issue: '+e.error+'. Trying again…');
  };
  recognition.onend=()=>{if(voiceActive&&!isSpeaking)scheduleRecognitionRestart(450);};
  try{recognition.start();}catch{voiceStatus('Could not start the microphone. Please try again.');}
 }
 function stopVoice(){
  voiceActive=false;isSpeaking=false;clearTimeout(restartTimer);
  if(recognition){recognition.onend=null;try{recognition.stop()}catch{}recognition=null;}
  if('speechSynthesis'in window)window.speechSynthesis.cancel();
  if($('#voiceStart'))$('#voiceStart').disabled=false;
  if($('#voiceStop'))$('#voiceStop').disabled=true;
  voiceStatus('Voice conversation ended.');
 }
 function showError(message){$('#error').textContent=message;$('#error').classList.remove('hidden');$('#status').textContent='CONNECTION ISSUE';$('#status').style.color='#e19a8e';}
 function render(d){overview=d;const o=d.overview;$('#revenue').textContent=ngn(o.paid.paid_revenue_kobo);$('#orders').textContent=o.orders.total;$('#ordersSub').textContent=`${o.orders.last_24h} in the last 24 hours · ${o.pendingOrders} needing processing`;$('#people').textContent=`${o.users.customers} / ${o.users.sellers}`;$('#products').textContent=o.products.total;$('#stockSub').textContent=`${o.products.low_stock} low stock · ${o.products.out_of_stock} out of stock`;
 const items=[];if(o.pendingSellerApplications)items.push(`${o.pendingSellerApplications} seller application(s) awaiting your review`);if(o.openSupportTickets)items.push(`${o.openSupportTickets} open support ticket(s)`);if(o.pendingOrders)items.push(`${o.pendingOrders} order(s) pending or processing`);if(o.products.low_stock)items.push(`${o.products.low_stock} product(s) have five or fewer units`);if(!items.length)items.push('No urgent signals from the current overview. Keep monitoring orders and stock.');$('#attention').replaceChildren(...items.map(t=>{const li=document.createElement('li');li.textContent=t;return li}));$('#status').textContent='● LIVE DATABASE CONNECTED';$('#status').style.color='#a7c79c';$('#error').classList.add('hidden');}
 async function refresh(){try{const d=await api('/api/zi/overview');render(d)}catch(e){showError(e.message);if(e.message.includes('sign in')||e.message.includes('permission'))showError(e.message+' Sign in with your ZYVORA administrator account, then reopen ZI.');}}
 async function ask(message,opts={}){const q=String(message||'').trim();if(!q)return;bubble(q,'you');$('#question').value='';try{const d=await api('/api/zi/ask',{method:'POST',body:JSON.stringify({message:q})});bubble(d.answer,'zi');if(opts.speak)speak(d.answer);if(d.overview)render({overview:d.overview})}catch(e){bubble(e.message,'zi');if(opts.speak)speak(e.message);}}
 $('#askForm').addEventListener('submit',e=>{e.preventDefault();ask($('#question').value)});document.querySelectorAll('[data-prompt]').forEach(b=>b.addEventListener('click',()=>ask(b.dataset.prompt)));$('#refresh').addEventListener('click',refresh);$('#voiceStart').addEventListener('click',()=>{startVoice();if(!voiceActive){/* recognition start is asynchronous; greeting follows onstart */}});$('#voiceStop').addEventListener('click',stopVoice);window.addEventListener('pagehide',stopVoice);if('speechSynthesis'in window)window.speechSynthesis.onvoiceschanged=()=>{};refresh();
})();
