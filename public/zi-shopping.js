/* ZYVORA · ZI personal shopping companion
   Catalogue-led recommendations only: ZI never invents stock, brands, prices or reviews. */
(()=>{
  const $=s=>document.querySelector(s);
  const panel=$('#ziCompanion'), toggle=$('#ziCompanionToggle'), close=$('#ziCompanionClose');
  if(!panel||!toggle)return;
  const chat=$('#ziCompanionMessages'), form=$('#ziCompanionForm'), input=$('#ziCompanionInput'), status=$('#ziCompanionStatus');
  let lastResults=[], recognition=null, listening=false, currentUser=null;
  const currency=()=>localStorage.getItem('zyvora-currency')||'NGN';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=k=>new Intl.NumberFormat(undefined,{style:'currency',currency:currency(),maximumFractionDigits:currency()==='NGN'?0:2}).format(Number(k||0)/100);
  function say(text){if(!('speechSynthesis'in window))return;window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);const lang=localStorage.getItem('zyvora-language')||'en';u.lang=({en:'en-NG',fr:'fr-FR',es:'es-ES',de:'de-DE',pt:'pt-PT',it:'it-IT',nl:'nl-NL',ar:'ar',hi:'hi-IN',ja:'ja-JP',ko:'ko-KR',zh:'zh-CN',sw:'sw-KE'})[lang]||lang;u.rate=.96;u.pitch=1.08;const voices=window.speechSynthesis.getVoices();const match=voices.find(v=>v.lang.toLowerCase().startsWith(u.lang.toLowerCase().slice(0,2)));if(match)u.voice=match;window.speechSynthesis.speak(u)}
  function addMessage(text,who='zi'){const el=document.createElement('div');el.className=`zi-chat-bubble ${who}`;el.textContent=text;chat.append(el);chat.scrollTop=chat.scrollHeight;return el}
  function open(){panel.hidden=false;toggle.setAttribute('aria-expanded','true');input.focus();}
  function shut(){panel.hidden=true;toggle.setAttribute('aria-expanded','false');stopListening();}
  toggle.addEventListener('click',open);close.addEventListener('click',shut);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)shut()});
  async function loadIdentity(){try{const r=await fetch('/api/me',{credentials:'same-origin'});const d=await r.json();currentUser=d.user||null;const first=currentUser?.name?.trim().split(/\s+/)[0];if(first){$('#ziCompanionGreeting').textContent=`Welcome back, ${first}.`;addMessage(`Welcome back, ${first}. It is lovely to see you again. Tell me what you are in the mood for, and I will search the ZYVORA catalogue with you.`)}else{$('#ziCompanionGreeting').textContent='Welcome to your world.'}}catch{}}
  function parseIntent(raw){const q=raw.toLowerCase();
    const categories=[['Fashion',/fashion|clothes|clothing|dress|shirt|trouser|jeans|blazer|outfit/],['Beauty',/beauty|skincare|skin care|serum|perfume|fragrance|makeup|cosmetic/],['Jewellery',/jewel|jewelry|jewellery|bracelet|watch|necklace|ring|cuff/],['Shoes',/shoe|heel|sneaker|trainer|boot|sandals/],['Bags',/bag|handbag|tote|purse/],['Accessories',/accessor|sunglasses|belt|scarf|hat/],['Lifestyle',/lifestyle|home|candle|vase|decor/]];
    const selected=categories.filter(([,re])=>re.test(q)).map(([c])=>c);
    const maxMatch=q.match(/(?:under|below|less than|max(?:imum)?(?: of)?|budget(?: of)?|within)\s*(?:₦|ngn|\$)?\s*([\d,]+(?:\.\d+)?)/i);let maxPrice=maxMatch?Number(maxMatch[1].replace(/,/g,'')):null;
    if(maxPrice&&(new RegExp(maxMatch[1].replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\s*k\\b','i').test(q)||/\bthousand\b/i.test(q.slice(maxMatch.index,maxMatch.index+maxMatch[0].length+18))))maxPrice*=1000;
    const minMatch=q.match(/(?:above|over|at least|from)\s*(?:₦|ngn|\$)?\s*([\d,]+)/i);let minPrice=minMatch?Number(minMatch[1].replace(/,/g,'')):null;
    const fx=typeof ZYVORA_FX!=='undefined'?(Number(ZYVORA_FX[currency()])||1):1;
    if(currency()!=='NGN'){if(maxPrice)maxPrice/=fx;if(minPrice)minPrice/=fx;}
    let sort='featured';if(/cheapest|least expensive|lowest price|price low|affordable|budget/.test(q))sort='price_asc';if(/most expensive|highest price|premium|luxury|expensive/.test(q))sort='price_desc';if(/best rated|top rated|highest rated|popular/.test(q))sort='rating';
    let term=raw.replace(/\b(show|find|search|look for|bring me|recommend|give me|i want|i need|please|order|buy|the best|best|cheapest|most|least|expensive|affordable|premium|luxury|under|below|less than|within my budget|budget of|for me|in the|category|products?|items?|pieces?|things?|clothes|clothing|fashion|beauty|jewellery|jewelry|shoes|bags|accessories|lifestyle|and|or|some|any|available|live|current|fine|nice|good|top|all|showcase)\b/gi,' ')
      .replace(/(?:₦|ngn|\$)\s*[\d,]+(?:\.\d+)?/gi,' ').replace(/\b\d+(?:\.\d+)?\s*k\b/gi,' ').replace(/\s+/g,' ').trim();
    return {categories:selected,category:selected.length===1?selected[0]:'',term,maxPrice,minPrice,sort};
  }
  async function searchProducts(intent){
    const categories=intent.categories?.length?intent.categories:[''];
    const terms=intent.term?intent.term.split(/(?:\s+(?:and|or)\s+|\s*,\s*)/i).map(x=>x.trim()).filter(Boolean):[''];
    const tasks=[];
    for(const category of categories)for(const term of terms){const params=new URLSearchParams();if(term)params.set('q',term);if(category)params.set('category',category);params.set('sort',intent.sort);tasks.push(fetch('/api/products/search?'+params,{credentials:'same-origin'}).then(async r=>{const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'I could not reach the catalogue right now.');return d.products||[]}))}
    const lists=await Promise.all(tasks);let list=[...new Map(lists.flat().map(p=>[Number(p.id),p])).values()];
    if(intent.maxPrice)list=list.filter(p=>Number(p.price_kobo)/100<=intent.maxPrice);if(intent.minPrice)list=list.filter(p=>Number(p.price_kobo)/100>=intent.minPrice);
    if(intent.sort==='price_asc')list.sort((a,b)=>Number(a.price_kobo)-Number(b.price_kobo));else if(intent.sort==='price_desc')list.sort((a,b)=>Number(b.price_kobo)-Number(a.price_kobo));else if(intent.sort==='rating')list.sort((a,b)=>Number(b.rating||0)-Number(a.rating||0)||Number(b.review_count||0)-Number(a.review_count||0));return list.slice(0,8)
  }
  function showResults(items){const host=document.createElement('div');host.className='zi-chat-results';if(!items.length){host.innerHTML='<p class="zi-no-results">I could not find a live, approved listing that matches those details just yet. Try another category or a wider budget. I will not make up products that are not in the catalogue.</p>';chat.append(host);chat.scrollTop=chat.scrollHeight;return}
    host.innerHTML=items.slice(0,5).map((p,i)=>`<article class="zi-product-result"><img src="${esc(p.image_url)}" alt="${esc(p.name)}" loading="lazy"><div class="zi-product-copy"><small>${esc(p.category||'ZYVORA FIND')}</small><b>${esc(p.name)}</b><span>${money(p.price_kobo)}</span><button type="button" data-zi-add="${Number(p.id)}">ADD TO BAG</button></div></article>`).join('');
    host.querySelectorAll('[data-zi-add]').forEach(btn=>btn.addEventListener('click',()=>{const id=Number(btn.dataset.ziAdd);const p=items.find(x=>Number(x.id)===id);if(!p)return; if(p.is_sample){addMessage(`${p.name} is a catalogue preview, not a verified item for purchase yet.`);return}if(typeof window.addToBag==='function'){window.addToBag(id);btn.textContent='ADDED';btn.disabled=true;addMessage(`I have added ${p.name} to your bag. You can review it before checkout.`)}else addMessage('Your shopping bag is still loading. Please try again in a moment.')}));
    chat.append(host);chat.scrollTop=chat.scrollHeight;
  }
  async function respond(text,{voice=false}={}){const q=String(text||'').trim();if(!q)return;addMessage(q,'you');input.value='';status.textContent='ZI is exploring the catalogue…';
    try{
      if(/\b(checkout|pay now|place (my )?order|go to checkout)\b/i.test(q)){addMessage('Absolutely. Your bag is yours to review first. Open the shopping bag, check every item and delivery detail, then you can continue through the secure checkout that is configured for this store. I will never place an order or charge you without your confirmation.');$('#bagButton')?.click();status.textContent='Here when you need me.';return}
      if(/\b(add (them|those|all|everything|first|second|third|last)?)\b/i.test(q)&&lastResults.length){const ordinal=/second/i.test(q)?1:/third/i.test(q)?2:/last/i.test(q)?lastResults.length-1:0;const chosen=/all|everything/i.test(q)?lastResults:lastResults.slice(ordinal,ordinal+1);let count=0;chosen.forEach(p=>{if(!p.is_sample&&typeof window.addToBag==='function'){window.addToBag(Number(p.id));count++}});addMessage(count?`Done — I added ${count} catalogue item${count===1?'':'s'} to your bag. Have a look before checkout.`:'Those listings are previews or cannot be added yet. I will only add verified purchasable products.');status.textContent='Here when you need me.';return}
      const intent=parseIntent(q);const products=await searchProducts(intent);lastResults=products;let line=products.length?`I found ${products.length} live catalogue match${products.length===1?'':'es'}${intent.categories?.length?` across ${intent.categories.join(', ')}`:''}${intent.sort==='price_asc'?' — starting with the lowest prices':intent.sort==='price_desc'?' — ordered from the highest prices':' — selected from the available listings'}. Take a look. The details and prices below come from the current catalogue.`:'I searched the available catalogue, but nothing matched that exact request. Try a different category, product name or budget.';addMessage(line);showResults(products);status.textContent='Here when you need me.';if(voice)say(line);
    }catch(e){addMessage(e.message);status.textContent='Catalogue connection issue.';if(voice)say(e.message)}
  }
  form.addEventListener('submit',e=>{e.preventDefault();respond(input.value)});
  document.querySelectorAll('[data-zi-suggestion]').forEach(b=>b.addEventListener('click',()=>respond(b.dataset.ziSuggestion)));
  function stopListening(){listening=false;if(recognition){recognition.onend=null;try{recognition.stop()}catch{}recognition=null}$('#ziCompanionVoice').textContent='🎙 TALK';}
  function startListening(){const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){status.textContent='Voice input is not available in this browser. You can type to ZI here.';return}if(listening)return;recognition=new SR();recognition.lang='en-NG';recognition.continuous=false;recognition.interimResults=false;recognition.maxAlternatives=1;recognition.onstart=()=>{listening=true;status.textContent='ZI is listening. Speak naturally.';$('#ziCompanionVoice').textContent='■ STOP'};recognition.onresult=e=>{const said=e.results[0][0].transcript;stopListening();respond(said,{voice:true})};recognition.onerror=e=>{stopListening();status.textContent=e.error==='not-allowed'?'Allow microphone access to speak with ZI.':'Voice input paused. You can type to ZI instead.'};recognition.onend=()=>{if(listening){listening=false;$('#ziCompanionVoice').textContent='🎙 TALK';status.textContent='Here when you need me.'}};try{recognition.start()}catch{status.textContent='Could not start the microphone. Try again or type your request.'}}
  $('#ziCompanionVoice').addEventListener('click',()=>listening?stopListening():startListening());window.addEventListener('pagehide',stopListening);
  loadIdentity();
})();
