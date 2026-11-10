(()=>{
 const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=k=>'₦'+(Number(k||0)/100).toLocaleString('en-NG',{maximumFractionDigits:0});
 async function api(url,options={}){const r=await fetch(url,{credentials:'same-origin',headers:{'Content-Type':'application/json',...(options.headers||{})},...options});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'Something went wrong.');return d}
 function message(text){$('#notice').textContent=text}
 async function init(){
  try{const me=await api('/api/me');if(!me.user){message('Please sign in to view your private account. Taking you to the storefront…');setTimeout(()=>location.href='/',1300);return}if(['seller','admin'].includes(me.user.role)){location.href='/marketplace.html';return}
   const [profile,orders,wishlist]=await Promise.all([api('/api/customer/profile'),api('/api/orders'),api('/api/customer/wishlist')]);
   const p=profile.profile||{};$('#profileForm [name=name]').value=p.name||'';$('#profileForm [name=email]').value=p.email||'';$('#profileForm [name=phone]').value=p.phone||'';
   const list=orders.orders||[];$('#orders').innerHTML=list.length?list.slice(0,12).map(o=>`<div class="record"><div><strong>Order #${esc(o.id)}</strong><span class="muted">${new Date(o.created_at).toLocaleDateString()} · ${money(o.total_kobo)}</span></div><div style="text-align:right"><span class="status">${esc(o.status)}</span><br><span class="muted">${esc(o.payment_status||'')}</span></div></div>`).join(''):'<p class="empty">No orders yet. Your next discovery is waiting.</p>';
   const products=wishlist.products||[];$('#wishlist').innerHTML=products.length?products.slice(0,16).map(x=>`<div class="wish-item">${x.image_url?`<img src="${esc(x.image_url)}" alt="${esc(x.name)}" loading="lazy">`:''}<strong>${esc(x.name)}</strong><p class="muted">${money(x.price_kobo)}</p><a href="/#shop">Explore the shop ↗</a></div>`).join(''):'<p class="empty">Your wishlist is waiting for something rare.</p>';
   message(`Signed in as ${p.name||p.email}. Your account is up to date.`);
  }catch(e){message(e.message)}
 }
 $('#profileForm').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.currentTarget);try{const d=await api('/api/customer/profile',{method:'PATCH',body:JSON.stringify({name:f.get('name'),phone:f.get('phone')})});message('Your account details have been saved.');$('#profileForm [name=name]').value=d.profile.name}catch(err){message(err.message)}});
 $('#signout').addEventListener('click',async()=>{try{await api('/api/auth/signout',{method:'POST'});location.href='/'}catch(e){message(e.message)}});
 init();
})();
