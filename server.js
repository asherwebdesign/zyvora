require("dotenv").config();
const express = require("express");
const session = require("express-session");
const PgSession = require("connect-pg-simple")(session);
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const { createDatabaseConfig } = require("./database-config");

const app = express();
const PORT = process.env.PORT || 3000;
// Fail with an actionable message instead of pg silently trying localhost:5432.
const pool = new Pool(createDatabaseConfig(process.env));
pool.on("error", (error) => {
  console.error(JSON.stringify({ level: "error", event: "postgres_pool_error", message: error.message, code: error.code }));
});
app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: "same-site" } }));
app.use((req,res,next)=>{
 req.id=crypto.randomUUID(); res.setHeader("X-Request-ID",req.id);
 const started=Date.now();
 res.on("finish",()=>{ if(req.originalUrl.startsWith("/api/")) console.log(JSON.stringify({level:"info",event:"http_request",request_id:req.id,method:req.method,path:req.path,status:res.statusCode,duration_ms:Date.now()-started})); });
 next();
});
app.use(express.json({ limit: "30kb", verify: (req, res, buf) => { if (req.originalUrl === "/api/payments/webhook") req.rawBody = Buffer.from(buf); } }));
app.use(express.urlencoded({ extended: false }));
app.use(session({
  store: new PgSession({ pool, createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET || (process.env.NODE_ENV === "production" ? (() => { throw new Error("SESSION_SECRET must be configured in production."); })() : "local-development-only-change-this-secret"),
  resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 7 * 24 * 60 * 60 * 1000 }
}));
app.use(express.static(path.join(__dirname, "public")));
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 150, standardHeaders: "draft-7", legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 12, standardHeaders: "draft-7", legacyHeaders: false, message: {error:"Too many sign-in attempts. Please try again in 15 minutes."} });
app.use("/api", limiter);
app.use("/api/auth", authLimiter);
app.use("/api",(req,res,next)=>{
 if(!["POST","PUT","PATCH","DELETE"].includes(req.method) || !req.headers.origin) return next();
 const allowed=new Set([`${req.protocol}://${req.get("host")}`]);
 if(process.env.BASE_URL){ try{allowed.add(new URL(process.env.BASE_URL).origin);}catch{}}
 if(!allowed.has(req.headers.origin)) return res.status(403).json({error:"Cross-origin request blocked."});
 next();
});

const products = [
["obsidian-silk-dress","The Obsidian Silk Dress","Fashion","A fluid statement silhouette with a soft sheen and a beautifully draped finish.","Made for after-dark entrances. Elegant fit, adjustable detail and a soft-touch lining.",189000,229000,"https://images.unsplash.com/photo-1539008835657-9e8e9680c956?w=900&q=85",0,0,true],
["velvet-noir-blazer","Velvet Noir Blazer","Fashion","Sharp tailoring meets midnight softness in this confident wardrobe icon.","Structured shoulders, satin lining and a sculpted waist.",215000,249000,"https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=900&q=85",0,0,true],
["ember-glow-serum","Ember Glow Serum","Beauty","A lightweight glow serum for a luminous, hydrated-looking finish.","Silky texture. Apply a few drops to clean skin. Patch test before use.",38500,null,"https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=900&q=85",0,0,true],
["midnight-oud","Midnight Oud Eau de Parfum","Beauty","A deep, warm fragrance mood with amber-like richness and a mysterious finish.","Fragrance notes and volume should be confirmed against the final supplier listing.",92000,null,"https://images.unsplash.com/photo-1594035910387-fea47794261f?w=900&q=85",0,0,true],
["celestial-cuff","Celestial Gold Cuff","Jewellery","A sculptural gold-tone cuff that catches the light without asking permission.","Polished finish. Keep away from water, perfume and harsh chemicals.",67500,79000,"https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=900&q=85",0,0,true],
["eclipse-pendant","Eclipse Pendant Necklace","Jewellery","A minimal celestial pendant with a bold, luminous presence.","Adjustable chain. Material and plating details to be verified before sale.",54000,null,"https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=900&q=85",0,0,false],
["afterdark-tote","The Afterdark Tote","Bags","A clean, roomy silhouette designed to move from day plans to late nights.","Structured shape, inner pocket and comfortable shoulder straps.",112000,135000,"https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=900&q=85",0,0,true],
["scorpio-mini-bag","Scorpio Mini Bag","Bags","A compact statement piece with a little cosmic attitude.","Compact interior, secure closure. Dimensions to be confirmed.",98000,null,"https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?w=900&q=85",0,0,false],
["golden-hour-heels","Golden Hour Heels","Shoes","A refined heel with a confident line and an elegant evening finish.","Heel height and sizing details to be confirmed with supplier.",126000,null,"https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=900&q=85",0,0,true],
["nocturne-sneakers","Nocturne Sneakers","Shoes","An elevated everyday sneaker with a clean, versatile profile.","Comfort-focused everyday styling. Check size guide before ordering.",89000,null,"https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=900&q=85",0,0,false],
["aura-candle","Aura No. 01 Candle","Lifestyle","Set the atmosphere with a warm, softly glowing ritual for your space.","Burn within sight, away from drafts and flammable materials.",29500,null,"https://images.unsplash.com/photo-1603006905003-be475563bc59?w=900&q=85",0,0,true],
["moonstone-vase","Moonstone Sculptural Vase","Lifestyle","A sculptural accent for shelves, tables and spaces with personality.","Decorative object. Dimensions and material to be confirmed.",72000,null,"https://images.unsplash.com/photo-1578500494198-246f612d3b3d?w=900&q=85",0,0,false]
];

async function init() {
  // Make the first connection explicit so configuration errors are reported
  // before schema setup and before the HTTP listener starts.
  await pool.query("SELECT 1");
  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  await pool.query(schema);
  // No unverified catalogue items are inserted by default. Enable this only
  // for a temporary visual preview; production inventory must be imported
  // after supplier, price, image, weight and stock details are verified.
  if (String(process.env.SEED_SAMPLE_PRODUCTS).toLowerCase() === "true") {
    for (const p of products) {
      const seedValues = [...p.slice(0, 10), 0, p[10]];
      seedValues.push(Number(process.env.SHIPBUBBLE_DEFAULT_ITEM_WEIGHT_KG || 0.5));
      await pool.query(`INSERT INTO products(slug,name,category,description,details,price_kobo,compare_at_kobo,image_url,rating,review_count,stock,featured,weight_kg)
        VALUES($1,$2,$3,$4,$5,$6*100,$7*100,$8,$9,$10,$11,$12,$13) ON CONFLICT(slug) DO NOTHING`, seedValues);
    }
  }
  await pool.query("UPDATE products p SET rating=COALESCE((SELECT ROUND(AVG(r.rating)::numeric,1) FROM reviews r WHERE r.product_id=p.id),0),review_count=(SELECT COUNT(*) FROM reviews r WHERE r.product_id=p.id)");
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD && !process.env.ADMIN_EMAIL.endsWith(".example")) {
    const exists = await pool.query("SELECT id FROM users WHERE email=$1", [process.env.ADMIN_EMAIL.toLowerCase()]);
    if (!exists.rowCount) {
      const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
      await pool.query("INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,'admin')", ["ZYVORA Admin", process.env.ADMIN_EMAIL.toLowerCase(), hash]);
      console.log("Admin account bootstrapped. Change its password after first login.");
    }
  }
}
const safeUser = u => ({ id: u.id, name: u.name, email: u.email, role: u.role });
function requireAuth(req,res,next){ if(!req.session.user) return res.status(401).json({error:"Please sign in to continue."}); next(); }
function asyncRoute(fn){return (req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);}
async function notifyOps(event,details={}){
 const endpoint=process.env.ALERT_WEBHOOK_URL;
 if(!endpoint)return;
 try{await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:`ZYVORA ${event}`,event,details,at:new Date().toISOString()}),signal:AbortSignal.timeout(5000)});}catch(err){console.error(JSON.stringify({level:"warn",event:"ops_alert_failed",message:err.message}));}
}
async function paystackRequest(endpoint,method="GET",body){
 if(!process.env.PAYSTACK_SECRET_KEY)throw Object.assign(new Error("Paystack is not configured."),{status:503});
 const response=await fetch(`https://api.paystack.co${endpoint}`,{method,headers:{Authorization:`Bearer ${process.env.PAYSTACK_SECRET_KEY}`,"Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
 const data=await response.json().catch(()=>({}));
 if(!response.ok||!data.status)throw Object.assign(new Error(data.message||"Paystack request failed."),{status:response.status||502,provider:data});
 return data.data;
}
async function shipbubbleRequest(endpoint,method="GET",body){
 if(!process.env.SHIPBUBBLE_API_KEY)throw Object.assign(new Error("Shipbubble is not configured. Add SHIPBUBBLE_API_KEY."),{status:503});
 const response=await fetch(`https://api.shipbubble.com/v1${endpoint}`,{method,headers:{Authorization:`Bearer ${process.env.SHIPBUBBLE_API_KEY}`,"Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});
 const data=await response.json().catch(()=>({}));
 if(!response.ok||data.status!=="success")throw Object.assign(new Error(data.message||data.errors?.join("; ")||"Shipbubble request failed."),{status:response.status||502,provider:data});
 return data.data;
}
function parseCsv(text){
 const rows=[];let row=[],field="",quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'&&text[i+1]==='"'){field+='"';i++;}else if(c==='"')quoted=false;else field+=c;}else if(c==='"')quoted=true;else if(c===','){row.push(field);field="";}else if(c==='\n'){row.push(field);rows.push(row);row=[];field="";}else if(c!=='\r')field+=c;}
 row.push(field);if(row.some(v=>v!==""))rows.push(row);if(!rows.length)return [];
 const headers=rows.shift().map(x=>x.trim().toLowerCase());return rows.map(values=>Object.fromEntries(headers.map((h,i)=>[h,(values[i]||"").trim()])));
}
app.get("/api/health",(req,res)=>res.json({ok:true,service:"ZYVORA",version:require("./package.json").version,uptime_seconds:Math.floor(process.uptime())}));
app.get("/api/health/live",(req,res)=>res.json({ok:true,service:"ZYVORA"}));
app.get("/api/health/ready",asyncRoute(async(req,res)=>{await pool.query("SELECT 1");res.json({ok:true,database:"ready",uptime_seconds:Math.floor(process.uptime())});}));
app.get("/api/products",asyncRoute(async(req,res)=>{
 const {rows}=await pool.query("SELECT id,slug,name,category,description,details,price_kobo,compare_at_kobo,image_url,rating,review_count,stock,featured FROM products WHERE stock >= 0 AND approved=TRUE ORDER BY featured DESC,id ASC");
 res.json({products:rows});
}));
app.get("/api/products/search",asyncRoute(async(req,res)=>{const q=String(req.query.q||"").trim().slice(0,100),category=String(req.query.category||"").trim().slice(0,60),sort=String(req.query.sort||"featured");const order={featured:"featured DESC, created_at DESC",price_asc:"price_kobo ASC",price_desc:"price_kobo DESC",rating:"rating DESC, review_count DESC"}[sort]||"featured DESC, created_at DESC";const {rows}=await pool.query(`SELECT id,slug,name,category,description,details,price_kobo,compare_at_kobo,image_url,rating,review_count,stock,featured FROM products WHERE approved=TRUE AND stock>0 AND ($1='' OR name ILIKE '%'||$1||'%' OR description ILIKE '%'||$1||'%' OR category ILIKE '%'||$1||'%') AND ($2='' OR lower(category)=lower($2)) ORDER BY ${order} LIMIT 100`,[q,category]);res.json({products:rows});}));
app.get("/api/me",(req,res)=>res.json({user:req.session.user||null}));
app.post("/api/auth/signup",asyncRoute(async(req,res)=>{
 const name=String(req.body.name||"").trim(),email=String(req.body.email||"").trim().toLowerCase(),password=String(req.body.password||"");
 if(name.length<2||!/^\S+@\S+\.\S+$/.test(email)||password.length<10) return res.status(400).json({error:"Enter your name, a valid email and a password of at least 10 characters."});
 const hash=await bcrypt.hash(password,12);
 try{const {rows}=await pool.query("INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3) RETURNING id,name,email,role",[name,email,hash]);req.session.regenerate(err=>{if(err)return res.status(500).json({error:"Could not start session."});req.session.user=safeUser(rows[0]);res.status(201).json({user:req.session.user});});}
 catch(e){if(e.code==="23505")return res.status(409).json({error:"An account with this email already exists."});throw e;}
}));
app.post("/api/auth/signin",asyncRoute(async(req,res)=>{
 const email=String(req.body.email||"").trim().toLowerCase(),password=String(req.body.password||"");
 const {rows}=await pool.query("SELECT * FROM users WHERE email=$1",[email]);
 if(!rows[0]||!(await bcrypt.compare(password,rows[0].password_hash)))return res.status(401).json({error:"Email or password is incorrect."});
 req.session.regenerate(err=>{if(err)return res.status(500).json({error:"Could not start session."});if(rows[0].suspended)return res.status(403).json({error:"This account is suspended. Contact support."});req.session.user=safeUser(rows[0]);res.json({user:req.session.user});});
}));
app.post("/api/auth/signout",(req,res)=>req.session.destroy(()=>{res.clearCookie("connect.sid");res.json({ok:true});}));
app.get("/api/customer/profile",requireAuth,asyncRoute(async(req,res)=>{const {rows}=await pool.query("SELECT id,name,email,phone,created_at FROM users WHERE id=$1",[req.session.user.id]);res.json({profile:rows[0]||null});}));
app.patch("/api/customer/profile",requireAuth,asyncRoute(async(req,res)=>{const name=String(req.body.name||"").trim(),phone=String(req.body.phone||"").trim();if(name.length<2||name.length>100||phone.length>40)return res.status(400).json({error:"Enter a name (2–100 characters) and a valid phone number."});const {rows}=await pool.query("UPDATE users SET name=$1,phone=$2 WHERE id=$3 RETURNING id,name,email,phone,role",[name,phone,req.session.user.id]);req.session.user=safeUser(rows[0]);res.json({profile:rows[0],user:req.session.user});}));
app.get("/api/orders",requireAuth,asyncRoute(async(req,res)=>{
 const {rows}=await pool.query("SELECT id,email,customer_name,phone,shipping_address,items,subtotal_kobo,shipping_kobo,total_kobo,status,payment_status,tracking_code,shipping_provider,created_at FROM orders WHERE user_id=$1 ORDER BY created_at DESC",[req.session.user.id]);res.json({orders:rows});
}));
app.post("/api/orders/checkout",asyncRoute(async(req,res)=>{
 const {name,email,phone,address,city,state,postalCode,country,items,paymentMethod}=req.body;
 if(!name||!/^\S+@\S+\.\S+$/.test(String(email||""))||!phone||!address||!city||!state||!country||!Array.isArray(items)||!items.length) return res.status(400).json({error:"Complete all delivery details and add at least one item."});
 const ids=items.map(i=>Number(i.id)).filter(Number.isInteger);
 if(!ids.length)return res.status(400).json({error:"Your bag is empty."});
 if(paymentMethod==="cod"&&process.env.ENABLE_COD!=="true")return res.status(400).json({error:"Pay on delivery is not enabled for this store or destination."});
 if(paymentMethod!=="cod"&&!process.env.PAYSTACK_SECRET_KEY)return res.status(503).json({error:"Checkout is prepared, but the store owner must add the Paystack secret key before real payments can be accepted."});
 const {rows:dbItems}=await pool.query("SELECT id,name,category,price_kobo,stock,image_url,seller_id,weight_kg FROM products WHERE id=ANY($1::bigint[]) AND approved=TRUE",[ids]);
 let clean=[],subtotal=0;
 for(const requested of items){
  const p=dbItems.find(x=>x.id===Number(requested.id)),qty=Math.max(1,Math.min(20,Number(requested.quantity)||1));
  if(!p||p.stock<qty)return res.status(400).json({error:`${p?.name||"A product"} is unavailable in the requested quantity.`});
  clean.push({id:Number(p.id),name:p.name,category:p.category,quantity:qty,unit_price_kobo:Number(p.price_kobo),image_url:p.image_url,seller_id:p.seller_id?Number(p.seller_id):null,weight_kg:Number(p.weight_kg||process.env.SHIPBUBBLE_DEFAULT_ITEM_WEIGHT_KG||0.5)});subtotal+=Number(p.price_kobo)*qty;
 }
 const shipping=subtotal>=15000000?0:1500000,total=subtotal+shipping;
 const reference="ZYV-"+crypto.randomBytes(10).toString("hex").toUpperCase();
 const addressObj={address,city,state,postalCode:postalCode||"",country};
 const {rows}=await pool.query(`INSERT INTO orders(user_id,email,customer_name,phone,shipping_address,items,subtotal_kobo,shipping_kobo,total_kobo,payment_reference)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id,total_kobo`,[req.session.user?.id||null,email,name,phone,addressObj,JSON.stringify(clean),subtotal,shipping,total,reference]);
 if(paymentMethod==="cod"){await pool.query("UPDATE orders SET status='awaiting_cod',payment_status='pending_cod' WHERE id=$1",[rows[0].id]);return res.status(201).json({cod_order:true,orderId:rows[0].id});}
 if(!process.env.PAYSTACK_SECRET_KEY)return res.status(503).json({error:"Checkout is prepared, but the store owner must add the Paystack secret key before real payments can be accepted.",orderId:rows[0].id});
 const pay=await fetch("https://api.paystack.co/transaction/initialize",{method:"POST",headers:{"Authorization":`Bearer ${process.env.PAYSTACK_SECRET_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({email,amount:total,currency:process.env.PAYSTACK_CURRENCY||"NGN",reference,callback_url:`${process.env.BASE_URL||`http://localhost:${PORT}`}/?payment=return`})});
 const result=await pay.json();
 if(!pay.ok||!result.status)throw new Error(result.message||"Payment initialization failed.");
 res.json({authorization_url:result.data.authorization_url,reference,orderId:rows[0].id});
}));
async function createSellerCommissions(client, order) {
 const groups = new Map();
 for (const item of order.items || []) {
  const sellerId = Number(item.seller_id || 0); if (!sellerId) continue;
  const gross = Number(item.unit_price_kobo) * Number(item.quantity);
  if (!Number.isSafeInteger(gross) || gross <= 0) continue;
  const key = `${sellerId}:${String(item.category || "")}`;
  const current = groups.get(key) || { sellerId, category: String(item.category || ""), gross: 0 };
  current.gross += gross; groups.set(key, current);
 }
 for (const group of groups.values()) {
  const rules = await client.query("SELECT rate_bps FROM commission_rules WHERE active=TRUE AND ((scope='seller' AND scope_key=$1) OR (scope='category' AND lower(scope_key)=lower($2)) OR (scope='global' AND scope_key='*')) ORDER BY CASE scope WHEN 'seller' THEN 1 WHEN 'category' THEN 2 ELSE 3 END LIMIT 1", [String(group.sellerId), group.category]);
  const rateBps = Number(rules.rows[0]?.rate_bps ?? Math.round(Number(process.env.PLATFORM_COMMISSION_PERCENT || 10) * 100));
  const commission = Math.round(group.gross * rateBps / 10000);
  const sellerNet = group.gross - commission;
  const inserted = await client.query(`INSERT INTO seller_commissions(order_id,seller_id,gross_kobo,commission_rate_bps,commission_kobo,seller_net_kobo,status)
   VALUES($1,$2,$3,$4,$5,$6,'available') ON CONFLICT(order_id,seller_id) DO NOTHING RETURNING id`, [order.id, group.sellerId, group.gross, rateBps, commission, sellerNet]);
  if (inserted.rowCount) await client.query(`INSERT INTO marketplace_ledger(seller_id,order_id,entry_type,amount_kobo,reference,description)
   VALUES($1,$2,'sale_net',$3,$4,$5) ON CONFLICT(reference) DO NOTHING`, [group.sellerId, order.id, sellerNet, `sale-${order.id}-${group.sellerId}`, `Seller net after ${(rateBps/100).toFixed(2)}% ZYVORA commission`]);
 }
}

async function markOrderPaid(reference, amount, currency) {
 const client=await pool.connect();
 try {
  await client.query("BEGIN");
  const found=await client.query("SELECT id,total_kobo,items,payment_status FROM orders WHERE payment_reference=$1 FOR UPDATE",[reference]);
  const order=found.rows[0];
  if(!order)throw new Error("Order reference not found.");
  if(Number(order.total_kobo)!==Number(amount)||String(currency)!==(process.env.PAYSTACK_CURRENCY||"NGN"))throw new Error("Payment amount or currency does not match this order.");
  if(order.payment_status!=="paid"){
   for(const item of order.items||[]) {
    const reserved=await client.query("UPDATE products SET stock=stock-$1 WHERE id=$2 AND approved=TRUE AND stock >= $1 RETURNING id",[Number(item.quantity)||0,item.id]);
    if(!reserved.rowCount)throw new Error("A product in this order no longer has enough stock. Contact support before attempting another payment.");
   }
   await client.query("UPDATE orders SET payment_status='paid',status='processing' WHERE id=$1",[order.id]);
   await createSellerCommissions(client, order);
   await client.query("INSERT INTO order_events(order_id,status,note) VALUES($1,'paid','Payment verified and inventory deducted')",[order.id]);
  }
  await client.query("INSERT INTO payment_events(reference,event_type,amount_kobo,currency,payload) VALUES($1,'charge.success',$2,$3,$4::jsonb) ON CONFLICT(reference) DO NOTHING",[reference,amount,currency,JSON.stringify({order_id:order.id})]);
  await client.query("COMMIT");
  return order.id;
 } catch(error) { await client.query("ROLLBACK"); throw error; }
 finally { client.release(); }
}
app.get("/api/payments/verify/:reference",asyncRoute(async(req,res)=>{
 if(!process.env.PAYSTACK_SECRET_KEY)return res.status(503).json({error:"Payments are not configured."});
 const ref=req.params.reference,verify=await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(ref)}`,{headers:{Authorization:`Bearer ${process.env.PAYSTACK_SECRET_KEY}`}});
 const result=await verify.json();
 if(!verify.ok||!result.status||result.data.status!=="success")return res.status(400).json({error:"Payment could not be verified."});
 const orderId=await markOrderPaid(ref,result.data.amount,result.data.currency);
 res.json({ok:true,orderId});
}));
async function applyTransferWebhook(eventType,data){
 const reference=String(data?.reference||"");if(!reference)return false;
 const mapped=eventType==="transfer.success"?"paid":eventType==="transfer.failed"?"failed":eventType==="transfer.reversed"?"reversed":null;
 if(!mapped)return false;
 const client=await pool.connect();
 try{
  await client.query("BEGIN");
  const found=await client.query("SELECT * FROM seller_payout_requests WHERE transfer_reference=$1 FOR UPDATE",[reference]);
  if(!found.rows[0]){await client.query("COMMIT");return false;}
  const payout=found.rows[0],eventKey=`${eventType}:${reference}:${String(data.id||data.transfer_code||"")}`;
  const fresh=await client.query("INSERT INTO payout_provider_events(provider_event_ref,payout_id,event_type,payload) VALUES($1,$2,$3,$4::jsonb) ON CONFLICT(provider_event_ref) DO NOTHING RETURNING id",[eventKey,payout.id,eventType,JSON.stringify(data)]);
  if(!fresh.rowCount){await client.query("COMMIT");return true;}
  await client.query("UPDATE seller_payout_requests SET status=$1,provider_status=$2,transfer_code=COALESCE(NULLIF($3,''),transfer_code),updated_at=NOW() WHERE id=$4",[mapped,String(data.status||mapped),String(data.transfer_code||""),payout.id]);
  if(mapped==="paid"){
   await client.query("INSERT INTO marketplace_ledger(seller_id,entry_type,amount_kobo,reference,description) VALUES($1,'seller_payout',$2,$3,$4) ON CONFLICT(reference) DO NOTHING",[payout.seller_id,-Number(payout.amount_kobo),`payout-${payout.id}`,`Paystack transfer ${reference}`]);
  }else if(mapped==="reversed"){
   await client.query("INSERT INTO marketplace_ledger(seller_id,entry_type,amount_kobo,reference,description) VALUES($1,'payout_reversal',$2,$3,$4) ON CONFLICT(reference) DO NOTHING",[payout.seller_id,Number(payout.amount_kobo),`payout-reversal-${payout.id}`,`Paystack reversed transfer ${reference}`]);
  }
  await client.query("COMMIT");
  if(mapped!=="paid")await notifyOps(`seller payout ${mapped}`,{payout_id:payout.id,amount_kobo:payout.amount_kobo,reference});
  return true;
 }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
}
app.post("/api/payments/webhook",asyncRoute(async(req,res)=>{
 if(!process.env.PAYSTACK_SECRET_KEY)return res.sendStatus(503);
 const signature=req.headers["x-paystack-signature"],raw=req.rawBody||Buffer.from(""),expected=crypto.createHmac("sha512",process.env.PAYSTACK_SECRET_KEY).update(raw).digest("hex");
 const a=Buffer.from(String(signature||"")),b=Buffer.from(expected);
 if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return res.sendStatus(401);
 const event=JSON.parse(raw.toString());
 if(event.event==="charge.success")await markOrderPaid(event.data.reference,event.data.amount,event.data.currency);
 if(["transfer.success","transfer.failed","transfer.reversed"].includes(event.event))await applyTransferWebhook(event.event,event.data);
 res.sendStatus(200);
}));
app.post("/api/newsletter",asyncRoute(async(req,res)=>{
 const email=String(req.body.email||"").trim().toLowerCase();if(!/^\S+@\S+\.\S+$/.test(email))return res.status(400).json({error:"Enter a valid email address."});
 await pool.query("INSERT INTO newsletter_subscribers(email) VALUES($1) ON CONFLICT(email) DO NOTHING",[email]);res.json({ok:true});
}));
app.get("/api/admin/orders",requireAuth,asyncRoute(async(req,res)=>{
 if(req.session.user.role!=="admin")return res.sendStatus(403);
 const {rows}=await pool.query("SELECT * FROM orders ORDER BY created_at DESC LIMIT 200");res.json({orders:rows});
}));
app.patch("/api/admin/orders/:id",requireAuth,asyncRoute(async(req,res)=>{
 if(req.session.user.role!=="admin")return res.sendStatus(403);
 const allowed=["processing","shipped","delivered","cancelled","awaiting_cod"];
 if(!allowed.includes(req.body.status))return res.status(400).json({error:"Invalid order status."});
 const client=await pool.connect();try{await client.query("BEGIN");const updated=await client.query("UPDATE orders SET status=$1,payment_status=CASE WHEN $1='delivered' AND payment_status='pending_cod' THEN 'paid_cod' ELSE payment_status END WHERE id=$2 RETURNING id,status,payment_status,items",[req.body.status,req.params.id]);if(!updated.rows[0]){await client.query("ROLLBACK");return res.sendStatus(404);}if(req.body.status==='delivered'&&updated.rows[0].payment_status==='paid_cod'){for(const item of updated.rows[0].items||[]){const stock=await client.query("UPDATE products SET stock=stock-$1 WHERE id=$2 AND stock >= $1 RETURNING id",[Number(item.quantity)||0,item.id]);if(!stock.rowCount)throw new Error("Insufficient stock to complete this cash-on-delivery order.");}await createSellerCommissions(client,updated.rows[0]);await client.query("INSERT INTO order_events(order_id,status,note) VALUES($1,'delivered','Cash-on-delivery order delivered and inventory deducted')",[updated.rows[0].id]);}await client.query("COMMIT");res.json({id:updated.rows[0].id,status:updated.rows[0].status,payment_status:updated.rows[0].payment_status});}catch(err){await client.query("ROLLBACK");throw err;}finally{client.release();}
}));

function requireRole(role){return (req,res,next)=>{if(!req.session.user)return res.status(401).json({error:"Please sign in to continue."});if(req.session.user.role!==role)return res.status(403).json({error:"You do not have permission to access this area."});next();}}
const requireAdmin=requireRole("admin");
const requireSeller=requireRole("seller");
const uploadDir=path.join(__dirname,"public","uploads");
fs.mkdirSync(uploadDir,{recursive:true});
const imageUpload=multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024,files:1},fileFilter:(req,file,cb)=>cb(null,["image/jpeg","image/png","image/webp"].includes(file.mimetype))});
const csvUpload=multer({storage:multer.memoryStorage(),limits:{fileSize:2*1024*1024,files:1},fileFilter:(req,file,cb)=>cb(null,/\.csv$/i.test(file.originalname)||file.mimetype==='text/csv')});
function imageSignatureValid(buffer,mime){if(!buffer||buffer.length<12)return false;if(mime==='image/jpeg')return buffer[0]===0xff&&buffer[1]===0xd8&&buffer[2]===0xff;if(mime==='image/png')return buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));if(mime==='image/webp')return buffer.toString('ascii',0,4)==='RIFF'&&buffer.toString('ascii',8,12)==='WEBP';return false;}
async function uploadCloudinary(file){
 const cloud=process.env.CLOUDINARY_CLOUD_NAME,key=process.env.CLOUDINARY_API_KEY,secret=process.env.CLOUDINARY_API_SECRET;
 const timestamp=Math.floor(Date.now()/1000),folder="zyvora/sellers";
 const params=`folder=${folder}&timestamp=${timestamp}${secret}`;
 const signature=crypto.createHash("sha1").update(params).digest("hex");
 const form=new FormData();form.append("file",new Blob([file.buffer],{type:file.mimetype}),file.originalname);form.append("api_key",key);form.append("timestamp",String(timestamp));form.append("folder",folder);form.append("signature",signature);
 const response=await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`,{method:"POST",body:form});const data=await response.json();
 if(!response.ok||!data.secure_url)throw new Error(data.error?.message||"Cloud image upload failed.");return data.secure_url;
}
app.post("/api/sellers/uploads/image",requireSeller,imageUpload.single("image"),asyncRoute(async(req,res)=>{
 if(!req.file)return res.status(400).json({error:"Choose a JPG, PNG or WebP image under 5 MB."});
 if(!imageSignatureValid(req.file.buffer,req.file.mimetype))return res.status(400).json({error:"The uploaded file does not contain a valid JPEG, PNG or WebP image."});
 const cloudReady=process.env.CLOUDINARY_CLOUD_NAME&&process.env.CLOUDINARY_API_KEY&&process.env.CLOUDINARY_API_SECRET;
 if(cloudReady)return res.status(201).json({image_url:await uploadCloudinary(req.file),storage:"cloudinary"});
 if(process.env.NODE_ENV==="production")return res.status(503).json({error:"Cloud image storage is not configured. Add the Cloudinary credentials before uploading in production."});
 const ext=({"image/jpeg":".jpg","image/png":".png","image/webp":".webp"})[req.file.mimetype];const filename=`${req.session.user.id}-${Date.now()}-${crypto.randomBytes(5).toString("hex")}${ext}`;fs.writeFileSync(path.join(uploadDir,filename),req.file.buffer);res.status(201).json({image_url:`/uploads/${filename}`,storage:"local-development"});
}));
app.patch("/api/sellers/products/:id/stock",requireSeller,asyncRoute(async(req,res)=>{const stock=Number(req.body.stock);if(!Number.isInteger(stock)||stock<0||stock>100000)return res.status(400).json({error:"Stock must be a whole number from 0 to 100,000."});const {rows}=await pool.query("UPDATE products SET stock=$1,updated_at=NOW() WHERE id=$2 AND seller_id=$3 RETURNING id,stock",[stock,req.params.id,req.session.user.id]);if(!rows[0])return res.status(404).json({error:"Product not found for this seller."});res.json({product:rows[0]});}));
app.post("/api/sellers/apply",requireAuth,asyncRoute(async(req,res)=>{
 const storeName=String(req.body.storeName||"").trim(),businessType=String(req.body.businessType||"").trim(),country=String(req.body.country||"").trim(),description=String(req.body.description||"").trim();
 const contactPhone=String(req.body.contactPhone||"").trim(),website=String(req.body.website||"").trim(),socialHandle=String(req.body.socialHandle||"").trim();
 if(storeName.length<2||!businessType||!country||description.length<30||contactPhone.length<7)return res.status(400).json({error:"Add your store name, business type, country, contact phone and a description of at least 30 characters."});
 if(website && !/^https:\/\//i.test(website))return res.status(400).json({error:"Website links must begin with https://"});
 const {rows}=await pool.query(`INSERT INTO seller_applications(user_id,store_name,business_type,country,description,contact_phone,website,social_handle,status)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,'pending') ON CONFLICT(user_id) DO UPDATE SET store_name=EXCLUDED.store_name,business_type=EXCLUDED.business_type,country=EXCLUDED.country,description=EXCLUDED.description,contact_phone=EXCLUDED.contact_phone,website=EXCLUDED.website,social_handle=EXCLUDED.social_handle,rejection_reason='',status='pending' RETURNING id,status`,
 [req.session.user.id,storeName,businessType,country,description,contactPhone,website,socialHandle]);
 res.status(201).json({application:rows[0]});
}));
// Compatibility endpoint used by the seller workspace form.
app.get("/api/sellers/profile",requireSeller,asyncRoute(async(req,res)=>{const {rows}=await pool.query("SELECT store_name,description,tagline,logo_url,banner_url,theme_color FROM seller_stores WHERE user_id=$1",[req.session.user.id]);res.json({profile:rows[0]||null});}));
app.patch("/api/sellers/profile",requireSeller,asyncRoute(async(req,res)=>{const storeName=String(req.body.store_name||"").trim(),description=String(req.body.description||"").trim(),tagline=String(req.body.tagline||"").trim().slice(0,120),logo=String(req.body.logo_url||"").trim(),banner=String(req.body.banner_url||"").trim(),color=String(req.body.theme_color||"#b7ff3c");if(storeName.length<2||description.length>2000||!/^#[0-9a-fA-F]{6}$/.test(color))return res.status(400).json({error:"Enter a store name, a description under 2,000 characters and a valid theme colour."});for(const u of [logo,banner])if(u&&!(u.startsWith("https://")||/^\/uploads\/[a-zA-Z0-9._-]+$/.test(u)))return res.status(400).json({error:"Store images must use HTTPS URLs or uploaded image paths."});const {rows}=await pool.query("UPDATE seller_stores SET store_name=$1,description=$2,tagline=$3,logo_url=$4,banner_url=$5,theme_color=$6 WHERE user_id=$7 RETURNING *",[storeName,description,tagline,logo,banner,color,req.session.user.id]);if(!rows[0])return res.status(404).json({error:"Seller store was not found."});res.json({store:rows[0]});}));
// Seller order updates are restricted to orders containing this seller's products.
app.patch("/api/sellers/orders/:id",requireSeller,asyncRoute(async(req,res)=>{const status=String(req.body.status||"");if(!["processing","shipped","delivered"].includes(status))return res.status(400).json({error:"Invalid fulfilment status."});const tracking=String(req.body.tracking_code||"").trim().slice(0,120),provider=String(req.body.shipping_provider||"").trim().slice(0,120);const {rows}=await pool.query("UPDATE orders SET status=$1,tracking_code=COALESCE(NULLIF($2,''),tracking_code),shipping_provider=COALESCE(NULLIF($3,''),shipping_provider) WHERE id=$4 AND EXISTS(SELECT 1 FROM jsonb_array_elements(items) i WHERE (i->>'seller_id')::bigint=$5) RETURNING id,status,tracking_code,shipping_provider",[status,tracking,provider,req.params.id,req.session.user.id]);if(!rows[0])return res.status(404).json({error:"Order not found for this seller."});await pool.query("INSERT INTO order_events(order_id,status,note,actor_user_id) VALUES($1,$2,$3,$4)",[rows[0].id,status,["Seller updated fulfilment",provider&&`Carrier: ${provider}`,tracking&&`Tracking: ${tracking}`].filter(Boolean).join(" · "),req.session.user.id]);res.json({order:rows[0]});}));
// Seller store customisation: sellers can only edit their own store.
app.patch("/api/sellers/store",requireSeller,asyncRoute(async(req,res)=>{
 const storeName=String(req.body.store_name||"").trim(),description=String(req.body.description||"").trim();
 const tagline=String(req.body.tagline||"").trim().slice(0,120),logo=String(req.body.logo_url||"").trim(),banner=String(req.body.banner_url||"").trim(),color=String(req.body.theme_color||"#b7ff3c");
 if(storeName.length<2||description.length>2000||!/^#[0-9a-fA-F]{6}$/.test(color))return res.status(400).json({error:"Enter a store name, a description under 2,000 characters and a valid theme colour."});
 for(const u of [logo,banner])if(u&&!(u.startsWith("https://")||/^\/uploads\/[a-zA-Z0-9._-]+$/.test(u)))return res.status(400).json({error:"Store images must use HTTPS URLs or uploaded image paths."});
 const {rows}=await pool.query(`UPDATE seller_stores SET store_name=$1,description=$2,tagline=$3,logo_url=$4,banner_url=$5,theme_color=$6 WHERE user_id=$7 RETURNING *`,[storeName,description,tagline,logo,banner,color,req.session.user.id]);
 if(!rows[0])return res.status(404).json({error:"Seller store was not found."});res.json({store:rows[0]});
}));
// Seller order view is scoped to items belonging to the signed-in seller.
app.get("/api/sellers/orders",requireSeller,asyncRoute(async(req,res)=>{
 const {rows}=await pool.query(`SELECT o.id,o.customer_name,o.email,o.phone,o.status,o.payment_status,o.shipping_address,o.tracking_code,o.shipping_provider,o.created_at,
  COALESCE(jsonb_agg(item) FILTER (WHERE item IS NOT NULL),'[]'::jsonb) AS items,
  COALESCE(SUM((item->>'unit_price_kobo')::bigint*(item->>'quantity')::int),0)::bigint AS seller_gross_kobo
  FROM orders o CROSS JOIN LATERAL jsonb_array_elements(o.items) item
  WHERE (item->>'seller_id')::bigint=$1 GROUP BY o.id ORDER BY o.created_at DESC LIMIT 300`,[req.session.user.id]);res.json({orders:rows});
}));
app.get("/api/sellers/payouts",requireSeller,asyncRoute(async(req,res)=>{const {rows}=await pool.query("SELECT id,amount_kobo,bank_name,account_name,account_number_last4,status,admin_note,provider_status,created_at,updated_at FROM seller_payout_requests WHERE seller_id=$1 ORDER BY created_at DESC",[req.session.user.id]);res.json({payouts:rows});}));
// Customer cart is persisted server-side and always revalidates product availability.
app.get("/api/customer/cart",requireAuth,asyncRoute(async(req,res)=>{const {rows}=await pool.query(`SELECT c.product_id,c.quantity,p.name,p.price_kobo,p.image_url,p.stock,p.approved FROM customer_cart_items c JOIN products p ON p.id=c.product_id WHERE c.user_id=$1 ORDER BY c.updated_at DESC`,[req.session.user.id]);res.json({items:rows});}));
app.put("/api/customer/cart/:productId",requireAuth,asyncRoute(async(req,res)=>{const quantity=Number(req.body.quantity),productId=Number(req.params.productId);if(!Number.isSafeInteger(productId)||!Number.isInteger(quantity)||quantity<1||quantity>20)return res.status(400).json({error:"Choose a quantity between 1 and 20."});const p=await pool.query("SELECT id,stock,approved FROM products WHERE id=$1",[productId]);if(!p.rows[0]||!p.rows[0].approved||p.rows[0].stock<quantity)return res.status(400).json({error:"This product is unavailable in that quantity."});await pool.query(`INSERT INTO customer_cart_items(user_id,product_id,quantity) VALUES($1,$2,$3) ON CONFLICT(user_id,product_id) DO UPDATE SET quantity=EXCLUDED.quantity,updated_at=NOW()`,[req.session.user.id,productId,quantity]);res.json({ok:true});}));
app.delete("/api/customer/cart/:productId",requireAuth,asyncRoute(async(req,res)=>{await pool.query("DELETE FROM customer_cart_items WHERE user_id=$1 AND product_id=$2",[req.session.user.id,req.params.productId]);res.json({ok:true});}));
app.delete("/api/customer/cart",requireAuth,asyncRoute(async(req,res)=>{await pool.query("DELETE FROM customer_cart_items WHERE user_id=$1",[req.session.user.id]);res.json({ok:true});}));

app.get("/api/sellers/me",requireRole("seller"),asyncRoute(async(req,res)=>{
 const store=await pool.query("SELECT * FROM seller_stores WHERE user_id=$1",[req.session.user.id]);
 const items=await pool.query("SELECT * FROM products WHERE seller_id=$1 ORDER BY created_at DESC",[req.session.user.id]).catch(()=>({rows:[]}));
 const earnings=await pool.query(`SELECT COALESCE(SUM(gross_kobo),0)::bigint AS gross_kobo,COALESCE(SUM(commission_kobo),0)::bigint AS commission_kobo,COALESCE(SUM(seller_net_kobo),0)::bigint AS net_kobo,COUNT(*)::int AS orders FROM seller_commissions WHERE seller_id=$1`,[req.session.user.id]);
 const ledger=await pool.query(`SELECT sc.*,o.created_at AS order_date FROM seller_commissions sc JOIN orders o ON o.id=sc.order_id WHERE sc.seller_id=$1 ORDER BY sc.created_at DESC LIMIT 50`,[req.session.user.id]);
 res.json({store:store.rows[0]||null,products:items.rows,earnings:earnings.rows[0],commissionLedger:ledger.rows,commissionPercent:Number(process.env.PLATFORM_COMMISSION_PERCENT||10)});
}));
app.post("/api/sellers/products",requireRole("seller"),asyncRoute(async(req,res)=>{
 const {name,category,description,details,price,image_url,stock,weight_kg}=req.body;
 const cleanName=String(name||"").trim(),cleanCategory=String(category||"").trim(),cleanDescription=String(description||"").trim(),url=String(image_url||"").trim(),priceNum=Number(price),stockNum=Math.max(0,Math.min(100000,Number(stock)||0)),weight=Number(weight_kg||process.env.SHIPBUBBLE_DEFAULT_ITEM_WEIGHT_KG||0.5);
 if(cleanName.length<3||cleanDescription.length<20||!cleanCategory||!Number.isFinite(priceNum)||priceNum<100||!Number.isFinite(weight)||weight<=0||weight>500||!(/^https:\/\//i.test(url)||/^\/uploads\/[a-zA-Z0-9._-]+$/.test(url)))return res.status(400).json({error:"Enter product details and upload an image or provide a secure HTTPS image URL."});
 const slug=cleanName.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")+"-"+crypto.randomBytes(3).toString("hex");
 const {rows}=await pool.query(`INSERT INTO products(slug,name,category,description,details,price_kobo,image_url,stock,featured,seller_id,approved,weight_kg) VALUES($1,$2,$3,$4,$5,$6,$7,$8,FALSE,$9,FALSE,$10) RETURNING *`,[slug,cleanName,cleanCategory,cleanDescription,String(details||""),Math.round(priceNum*100),url,stockNum,req.session.user.id,weight]);
 res.status(201).json({product:rows[0]});
}));
app.get("/api/sellers/application",requireAuth,asyncRoute(async(req,res)=>{const {rows}=await pool.query("SELECT id,store_name,business_type,country,description,contact_phone,website,social_handle,rejection_reason,status,created_at FROM seller_applications WHERE user_id=$1",[req.session.user.id]);res.json({application:rows[0]||null});}));
app.get("/api/admin/overview",requireAuth,asyncRoute(async(req,res)=>{if(req.session.user.role!=="admin")return res.sendStatus(403);const [sellers,products,orders,customers,pending]=await Promise.all([pool.query("SELECT COUNT(*)::int AS total FROM seller_applications WHERE status='approved'"),pool.query("SELECT COUNT(*)::int AS total FROM products"),pool.query("SELECT COUNT(*)::int AS total FROM orders"),pool.query("SELECT COUNT(*)::int AS total FROM users WHERE role='customer'"),pool.query("SELECT COUNT(*)::int AS total FROM seller_applications WHERE status='pending'")]);res.json({stats:{approvedSellers:sellers.rows[0].total,products:products.rows[0].total,orders:orders.rows[0].total,customers:customers.rows[0].total,pendingApplications:pending.rows[0].total}});}));
app.get("/api/admin/seller-applications",requireAuth,asyncRoute(async(req,res)=>{if(req.session.user.role!=="admin")return res.sendStatus(403);const {rows}=await pool.query(`SELECT a.*,u.name,u.email FROM seller_applications a JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC`);res.json({applications:rows});}));
app.patch("/api/admin/seller-applications/:id",requireAuth,asyncRoute(async(req,res)=>{
 if(req.session.user.role!=="admin")return res.sendStatus(403);const status=String(req.body.status||"");if(!["approved","rejected"].includes(status))return res.status(400).json({error:"Choose approved or rejected."});
 const reason=String(req.body.reason||"").trim();
 const {rows}=await pool.query("UPDATE seller_applications SET status=$1,rejection_reason=$2 WHERE id=$3 RETURNING *",[status,status==="rejected"?reason:"",req.params.id]);if(!rows[0])return res.sendStatus(404);
 if(status==="approved"){await pool.query("UPDATE users SET role='seller' WHERE id=$1",[rows[0].user_id]);await pool.query("INSERT INTO seller_stores(user_id,store_name,description) VALUES($1,$2,$3) ON CONFLICT(user_id) DO UPDATE SET store_name=EXCLUDED.store_name,description=EXCLUDED.description",[rows[0].user_id,rows[0].store_name,rows[0].description]);}
 await audit(req.session.user.id,`seller_application_${status}` ,"seller_application",rows[0].id,{user_id:rows[0].user_id});
 res.json({application:rows[0]});
}));
app.get("/api/admin/commissions",requireAuth,asyncRoute(async(req,res)=>{if(req.session.user.role!=="admin")return res.sendStatus(403);const {rows}=await pool.query(`SELECT sc.*,u.name AS seller_name,u.email AS seller_email,o.created_at AS order_date FROM seller_commissions sc JOIN users u ON u.id=sc.seller_id JOIN orders o ON o.id=sc.order_id ORDER BY sc.created_at DESC LIMIT 300`);const totals=await pool.query(`SELECT COALESCE(SUM(commission_kobo),0)::bigint AS platform_commission_kobo,COALESCE(SUM(seller_net_kobo),0)::bigint AS seller_net_kobo,COUNT(*)::int AS entries FROM seller_commissions`);res.json({ledger:rows,totals:totals.rows[0],commissionPercent:Number(process.env.PLATFORM_COMMISSION_PERCENT||10)});}));
app.get("/api/admin/products",requireAuth,asyncRoute(async(req,res)=>{if(req.session.user.role!=="admin")return res.sendStatus(403);const {rows}=await pool.query("SELECT * FROM products ORDER BY created_at DESC");res.json({products:rows});}));
app.post("/api/admin/products",requireAuth,asyncRoute(async(req,res)=>{
 if(req.session.user.role!=="admin")return res.sendStatus(403);const {name,category,description,details,price,image_url,stock,featured,weight_kg}=req.body;const n=String(name||"").trim(),c=String(category||"").trim(),d=String(description||"").trim(),u=String(image_url||"").trim(),v=Number(price);
 if(n.length<3||!c||d.length<15||!Number.isFinite(v)||v<100||!/^https:\/\//i.test(u))return res.status(400).json({error:"Complete product details and provide an HTTPS image URL."});
 const slug=n.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")+"-"+crypto.randomBytes(3).toString("hex");const {rows}=await pool.query("INSERT INTO products(slug,name,category,description,details,price_kobo,image_url,stock,featured,weight_kg) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *",[slug,n,c,d,String(details||""),Math.round(v*100),u,Math.max(0,Number(stock)||0),!!featured,Math.min(500,Math.max(0.001,Number(weight_kg||0.5)))]);res.status(201).json({product:rows[0]});
}));
app.post('/api/admin/products/import',requireAdmin,csvUpload.single('file'),asyncRoute(async(req,res)=>{
 if(!req.file)return res.status(400).json({error:'Choose a .csv file under 2 MB.'});
 const rows=parseCsv(req.file.buffer.toString('utf8').replace(/^\uFEFF/,''));if(!rows.length)return res.status(400).json({error:'The CSV contains no product rows.'});if(rows.length>500)return res.status(400).json({error:'Import a maximum of 500 products per file.'});
 const summary={created:0,updated:0,skipped:[]};
 for(let index=0;index<rows.length;index++){
  const r=rows[index],name=String(r.name||'').trim(),category=String(r.category||'').trim(),description=String(r.description||'').trim(),image=String(r.image_url||'').trim(),price=Number(r.price_ngn),stock=Number(r.stock??0),weight=Number(r.weight_kg||process.env.SHIPBUBBLE_DEFAULT_ITEM_WEIGHT_KG||0.5);
  if(name.length<3||category.length<2||description.length<15||!/^https:\/\//i.test(image)||!Number.isFinite(price)||price<100||!Number.isInteger(stock)||stock<0||stock>100000||!Number.isFinite(weight)||weight<=0||weight>500){summary.skipped.push({row:index+2,reason:'Invalid name, category, description, HTTPS image URL, price, stock or weight.'});continue;}
  const base=String(r.slug||name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')).toLowerCase().replace(/[^a-z0-9-]/g,'').slice(0,90);if(!base){summary.skipped.push({row:index+2,reason:'Could not create a product slug.'});continue;}
  const {rows:upserted}=await pool.query(`INSERT INTO products(slug,name,category,description,details,price_kobo,image_url,stock,featured,approved,weight_kg) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,TRUE,$10) ON CONFLICT(slug) DO UPDATE SET name=EXCLUDED.name,category=EXCLUDED.category,description=EXCLUDED.description,details=EXCLUDED.details,price_kobo=EXCLUDED.price_kobo,image_url=EXCLUDED.image_url,stock=EXCLUDED.stock,featured=EXCLUDED.featured,approved=TRUE,weight_kg=EXCLUDED.weight_kg,updated_at=NOW() RETURNING (xmax=0) AS inserted`,[base,name,category,description,String(r.details||''),Math.round(price*100),image,stock,/^(true|1|yes)$/i.test(String(r.featured||'')),weight]);
  if(upserted[0]?.inserted)summary.created++;else summary.updated++;
 }
 await audit(req.session.user.id,'bulk_product_import','product_catalogue','csv_import',summary);res.json({ok:true,...summary});
}));
app.patch("/api/admin/products/:id",requireAuth,asyncRoute(async(req,res)=>{if(req.session.user.role!=="admin")return res.sendStatus(403);const {stock,featured}=req.body;const {rows}=await pool.query("UPDATE products SET stock=COALESCE($1,stock),featured=COALESCE($2,featured),approved=COALESCE($3,approved) WHERE id=$4 RETURNING id,stock,featured,approved",[stock===undefined?null:Math.max(0,Number(stock)||0),featured===undefined?null:!!featured,req.body.approved===undefined?null:!!req.body.approved,req.params.id]);if(!rows[0])return res.sendStatus(404);res.json({product:rows[0]});}));
app.get("/api/products/:id/reviews",asyncRoute(async(req,res)=>{const {rows}=await pool.query("SELECT r.id,r.rating,r.body,r.created_at,u.name FROM reviews r JOIN users u ON u.id=r.user_id WHERE r.product_id=$1 ORDER BY r.created_at DESC LIMIT 30",[req.params.id]);res.json({reviews:rows});}));
app.post("/api/reviews",requireAuth,asyncRoute(async(req,res)=>{const productId=Number(req.body.productId),rating=Number(req.body.rating),body=String(req.body.body||"").trim();if(!Number.isInteger(productId)||rating<1||rating>5||body.length<10)return res.status(400).json({error:"Choose a 1–5 star rating and write at least 10 characters."});const bought=await pool.query("SELECT id FROM orders WHERE user_id=$1 AND (payment_status IN ('paid','paid_cod') OR (payment_status='pending_cod' AND status='delivered')) AND items @> $2::jsonb LIMIT 1",[req.session.user.id,JSON.stringify([{id:productId}])]);if(!bought.rowCount)return res.status(403).json({error:"Reviews are available to customers with a completed purchase of this product."});const {rows}=await pool.query("INSERT INTO reviews(product_id,user_id,rating,body) VALUES($1,$2,$3,$4) ON CONFLICT(product_id,user_id) DO UPDATE SET rating=EXCLUDED.rating,body=EXCLUDED.body RETURNING *",[productId,req.session.user.id,rating,body]);await pool.query("UPDATE products SET rating=(SELECT ROUND(AVG(rating)::numeric,1) FROM reviews WHERE product_id=$1),review_count=(SELECT COUNT(*) FROM reviews WHERE product_id=$1) WHERE id=$1",[productId]);res.status(201).json({review:rows[0]});}));


// ---- Marketplace operations, customer tools, commission policy and audit APIs ----
async function audit(adminId,action,type,id,details={}){await pool.query("INSERT INTO admin_audit_log(admin_id,action,target_type,target_id,details) VALUES($1,$2,$3,$4,$5)",[adminId,action,type,String(id||""),JSON.stringify(details)]);}
async function getCommissionRate(sellerId,category){
 const {rows}=await pool.query("SELECT rate_bps FROM commission_rules WHERE active=TRUE AND ((scope='seller' AND scope_key=$1) OR (scope='category' AND lower(scope_key)=lower($2)) OR (scope='global' AND scope_key='*')) ORDER BY CASE scope WHEN 'seller' THEN 1 WHEN 'category' THEN 2 ELSE 3 END LIMIT 1",[String(sellerId),String(category||"")]);
 return Number(rows[0]?.rate_bps ?? 1000);
}
app.get('/api/sellers/payout-banks',requireSeller,asyncRoute(async(req,res)=>{if(!process.env.PAYSTACK_SECRET_KEY)return res.json({configured:false,banks:[]});const data=await paystackRequest('/bank?currency=NGN&perPage=200');res.json({configured:true,banks:(data||[]).map(b=>({name:b.name,code:String(b.code),active:b.active!==false})).filter(b=>b.active)});}));
app.get('/api/sellers/payout-account/resolve',requireSeller,asyncRoute(async(req,res)=>{const number=String(req.query.account_number||'').replace(/\D/g,''),bankCode=String(req.query.bank_code||'').trim();if(!/^\d{10}$/.test(number)||!bankCode)return res.status(400).json({error:'Enter a 10-digit account number and select a bank.'});const data=await paystackRequest(`/bank/resolve?account_number=${encodeURIComponent(number)}&bank_code=${encodeURIComponent(bankCode)}`);res.json({account_name:data.account_name,account_number:data.account_number,bank_id:data.bank_id});}));
app.post('/api/sellers/payouts',requireSeller,asyncRoute(async(req,res)=>{
 const amount=Math.round(Number(req.body.amount_ngn)*100),bank=String(req.body.bank_name||'').trim(),bankCode=String(req.body.bank_code||'').trim(),number=String(req.body.account_number||'').replace(/\D/g,'');
 if(!Number.isSafeInteger(amount)||amount<100000||bank.length<2||!bankCode||!/^\d{10}$/.test(number))return res.status(400).json({error:'Enter a payout amount of at least ₦1,000, choose a bank and enter a valid 10-digit account number.'});
 const resolved=await paystackRequest(`/bank/resolve?account_number=${encodeURIComponent(number)}&bank_code=${encodeURIComponent(bankCode)}`);
 const recipient=await paystackRequest('/transferrecipient','POST',{type:'nuban',name:String(resolved.account_name||req.body.account_name||'').trim(),account_number:number,bank_code:bankCode,currency:'NGN',description:`ZYVORA seller ${req.session.user.id}`});
 if(!recipient.recipient_code)throw new Error('Paystack did not return a transfer recipient code.');
 const client=await pool.connect();
 try{
  await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock($1::bigint)',[req.session.user.id]);
  const bal=await client.query("SELECT COALESCE(SUM(seller_net_kobo),0)-COALESCE((SELECT SUM(amount_kobo) FROM seller_payout_requests WHERE seller_id=$1 AND status IN ('requested','approved','transferring','otp_required','paid')),0) AS available FROM seller_commissions WHERE seller_id=$1 AND status IN ('pending','available')",[req.session.user.id]);
  if(amount>Number(bal.rows[0].available||0)){await client.query('ROLLBACK');return res.status(400).json({error:'Requested amount exceeds your available balance.'});}
  const {rows}=await client.query('INSERT INTO seller_payout_requests(seller_id,amount_kobo,bank_name,bank_code,account_name,account_number_last4,recipient_code) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,status,amount_kobo,bank_name,account_name,account_number_last4,created_at',[req.session.user.id,amount,bank,bankCode,String(resolved.account_name||req.body.account_name||'').trim(),number.slice(-4),recipient.recipient_code]);
  await client.query('COMMIT');res.status(201).json({payout:rows[0],message:'Bank account verified and transfer recipient registered. The payout now awaits administrator approval.'});
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}));
app.get('/api/sellers/sales',requireSeller,asyncRoute(async(req,res)=>{const {rows}=await pool.query('SELECT sc.*,o.created_at,o.status AS order_status FROM seller_commissions sc JOIN orders o ON o.id=sc.order_id WHERE sc.seller_id=$1 ORDER BY o.created_at DESC LIMIT 500',[req.session.user.id]);res.json({sales:rows});}));
app.get('/api/customer/profile',requireAuth,asyncRoute(async(req,res)=>{const {rows}=await pool.query('SELECT id,name,email,phone,created_at FROM users WHERE id=$1',[req.session.user.id]);res.json({profile:rows[0]});}));
app.patch('/api/customer/profile',requireAuth,asyncRoute(async(req,res)=>{const name=String(req.body.name||'').trim(),phone=String(req.body.phone||'').trim();if(name.length<2||phone.length>30)return res.status(400).json({error:'Enter a valid name and phone number.'});const {rows}=await pool.query('UPDATE users SET name=$1,phone=$2 WHERE id=$3 RETURNING id,name,email,phone',[name,phone,req.session.user.id]);req.session.user.name=name;res.json({profile:rows[0]});}));
app.get('/api/customer/wishlist',requireAuth,asyncRoute(async(req,res)=>{const {rows}=await pool.query('SELECT p.* FROM customer_wishlist w JOIN products p ON p.id=w.product_id WHERE w.user_id=$1 ORDER BY w.created_at DESC',[req.session.user.id]);res.json({products:rows});}));
app.post('/api/customer/wishlist/:productId',requireAuth,asyncRoute(async(req,res)=>{await pool.query('INSERT INTO customer_wishlist(user_id,product_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[req.session.user.id,req.params.productId]);res.json({ok:true});}));
app.delete('/api/customer/wishlist/:productId',requireAuth,asyncRoute(async(req,res)=>{await pool.query('DELETE FROM customer_wishlist WHERE user_id=$1 AND product_id=$2',[req.session.user.id,req.params.productId]);res.json({ok:true});}));
app.get('/api/orders/:id/tracking',requireAuth,asyncRoute(async(req,res)=>{const {rows}=await pool.query('SELECT id,status,tracking_code,shipping_provider,shipping_provider_status,shipping_last_synced_at,shipping_tracking_url,shipping_waybill_url,created_at FROM orders WHERE id=$1 AND user_id=$2',[req.params.id,req.session.user.id]);if(!rows[0])return res.status(404).json({error:'Order not found.'});const events=await pool.query('SELECT status,note,created_at FROM order_events WHERE order_id=$1 ORDER BY created_at',[req.params.id]);res.json({order:rows[0],events:events.rows});}));
app.post('/api/support/tickets',asyncRoute(async(req,res)=>{const email=String(req.body.email||req.session.user?.email||'').trim().toLowerCase(),subject=String(req.body.subject||'').trim(),message=String(req.body.message||'').trim();if(!/^\S+@\S+\.\S+$/.test(email)||subject.length<3||message.length<10)return res.status(400).json({error:'Enter a valid email, subject and message.'});const {rows}=await pool.query('INSERT INTO support_tickets(user_id,email,subject,message) VALUES($1,$2,$3,$4) RETURNING id,status,created_at',[req.session.user?.id||null,email,subject,message]);res.status(201).json({ticket:rows[0]});}));
// Customer delivery addresses and return/exchange requests.
app.get('/api/customer/addresses',requireAuth,asyncRoute(async(req,res)=>{const {rows}=await pool.query('SELECT id,label,recipient_name,phone,address_line,city,state,postal_code,country,is_default,created_at FROM customer_addresses WHERE user_id=$1 ORDER BY is_default DESC,created_at DESC',[req.session.user.id]);res.json({addresses:rows});}));
app.post('/api/customer/addresses',requireAuth,asyncRoute(async(req,res)=>{const b=req.body,label=String(b.label||'Home').trim().slice(0,40),name=String(b.recipient_name||'').trim(),phone=String(b.phone||'').trim(),line=String(b.address_line||'').trim(),city=String(b.city||'').trim(),state=String(b.state||'').trim(),country=String(b.country||'').trim(),postal=String(b.postal_code||'').trim().slice(0,20),isDefault=!!b.is_default;if(name.length<2||phone.length<7||line.length<5||city.length<2||state.length<2||country.length<2)return res.status(400).json({error:'Complete recipient, phone, street address, city, state and country.'});const client=await pool.connect();try{await client.query('BEGIN');if(isDefault)await client.query('UPDATE customer_addresses SET is_default=FALSE WHERE user_id=$1',[req.session.user.id]);const {rows}=await client.query('INSERT INTO customer_addresses(user_id,label,recipient_name,phone,address_line,city,state,postal_code,country,is_default) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',[req.session.user.id,label,name,phone,line,city,state,postal,country,isDefault]);await client.query('COMMIT');res.status(201).json({address:rows[0]});}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}}));
app.delete('/api/customer/addresses/:id',requireAuth,asyncRoute(async(req,res)=>{const {rowCount}=await pool.query('DELETE FROM customer_addresses WHERE id=$1 AND user_id=$2',[req.params.id,req.session.user.id]);if(!rowCount)return res.sendStatus(404);res.json({ok:true});}));
app.post('/api/orders/:id/returns',requireAuth,asyncRoute(async(req,res)=>{const order=await pool.query("SELECT id,status,payment_status,items FROM orders WHERE id=$1 AND user_id=$2",[req.params.id,req.session.user.id]);if(!order.rows[0])return res.sendStatus(404);if(!['paid','paid_cod'].includes(order.rows[0].payment_status))return res.status(400).json({error:'Only paid orders can be returned.'});const reason=String(req.body.reason||'').trim(),kind=String(req.body.kind||'return');if(!['return','exchange'].includes(kind)||reason.length<10||reason.length>1500)return res.status(400).json({error:'Choose return or exchange and provide at least 10 characters explaining the request.'});const {rows}=await pool.query('INSERT INTO return_requests(order_id,user_id,kind,reason) VALUES($1,$2,$3,$4) ON CONFLICT(order_id,user_id) DO UPDATE SET kind=EXCLUDED.kind,reason=EXCLUDED.reason,status=CASE WHEN return_requests.status IN (\'rejected\',\'closed\') THEN \'requested\' ELSE return_requests.status END,updated_at=NOW() RETURNING *',[req.params.id,req.session.user.id,kind,reason]);res.status(201).json({request:rows[0]});}));
app.get('/api/customer/returns',requireAuth,asyncRoute(async(req,res)=>{const {rows}=await pool.query('SELECT r.*,o.created_at AS order_date FROM return_requests r JOIN orders o ON o.id=r.order_id WHERE r.user_id=$1 ORDER BY r.created_at DESC',[req.session.user.id]);res.json({requests:rows});}));
app.get('/api/admin/returns',requireAdmin,asyncRoute(async(req,res)=>{const {rows}=await pool.query('SELECT r.*,o.email,o.total_kobo FROM return_requests r JOIN orders o ON o.id=r.order_id ORDER BY r.created_at DESC LIMIT 300');res.json({requests:rows});}));
app.patch('/api/admin/returns/:id',requireAdmin,asyncRoute(async(req,res)=>{const status=String(req.body.status||'');if(!['approved','rejected','received','refunded','exchanged','closed'].includes(status))return res.status(400).json({error:'Invalid return status.'});const {rows}=await pool.query('UPDATE return_requests SET status=$1,admin_note=$2,updated_at=NOW() WHERE id=$3 RETURNING *',[status,String(req.body.admin_note||'').slice(0,500),req.params.id]);if(!rows[0])return res.sendStatus(404);await audit(req.session.user.id,'return_'+status,'return_request',req.params.id);res.json({request:rows[0],note:'This updates the request record only; any money refund must be processed separately through the payment provider.'});}));
app.get('/api/admin/commission-rules',requireAdmin,asyncRoute(async(req,res)=>{const {rows}=await pool.query('SELECT * FROM commission_rules ORDER BY scope,scope_key');res.json({rules:rows});}));
app.put('/api/admin/commission-rules',requireAdmin,asyncRoute(async(req,res)=>{const scope=String(req.body.scope||''),key=String(req.body.scope_key||'*').trim(),rate=Math.round(Number(req.body.rate_percent)*100);if(!['global','seller','category'].includes(scope)||!key||!Number.isInteger(rate)||rate<0||rate>5000)return res.status(400).json({error:'Commission must be between 0% and 50%; choose global, seller or category scope.'});const {rows}=await pool.query('INSERT INTO commission_rules(scope,scope_key,rate_bps) VALUES($1,$2,$3) ON CONFLICT(scope,scope_key) DO UPDATE SET rate_bps=EXCLUDED.rate_bps,active=TRUE,updated_at=NOW() RETURNING *',[scope,key,rate]);await audit(req.session.user.id,'commission_rule_updated','commission_rule',rows[0].id,rows[0]);res.json({rule:rows[0]});}));
app.get('/api/admin/payouts',requireAdmin,asyncRoute(async(req,res)=>{const {rows}=await pool.query('SELECT p.id,p.seller_id,p.amount_kobo,p.bank_name,p.account_name,p.account_number_last4,p.status,p.admin_note,p.provider_status,p.transfer_reference,p.transfer_code,p.created_at,p.updated_at,u.name AS seller_name,u.email FROM seller_payout_requests p JOIN users u ON u.id=p.seller_id ORDER BY p.created_at DESC');res.json({payouts:rows});}));
app.patch('/api/admin/payouts/:id',requireAdmin,asyncRoute(async(req,res)=>{const status=String(req.body.status||''),note=String(req.body.admin_note||'').slice(0,500);if(!['approved','rejected'].includes(status))return res.status(400).json({error:'Choose approve or reject. Funds can only be marked paid after Paystack confirms the transfer.'});const {rows}=await pool.query("UPDATE seller_payout_requests SET status=$1,admin_note=$2,updated_at=NOW() WHERE id=$3 AND status='requested' RETURNING *",[status,note,req.params.id]);if(!rows[0])return res.status(404).json({error:'Payout request not found or already reviewed.'});await audit(req.session.user.id,'payout_'+status,'payout',rows[0].id,{amount_kobo:rows[0].amount_kobo});res.json({payout:rows[0],message:status==='approved'?'Approved. Use Send transfer to initiate the Paystack transfer.':'Payout request rejected.'});}));
app.post('/api/admin/payouts/:id/transfer',requireAdmin,asyncRoute(async(req,res)=>{
 const client=await pool.connect();let payout,reference;
 try{await client.query('BEGIN');const found=await client.query('SELECT * FROM seller_payout_requests WHERE id=$1 FOR UPDATE',[req.params.id]);payout=found.rows[0];if(!payout){await client.query('ROLLBACK');return res.sendStatus(404);}if(payout.status==='paid'){await client.query('ROLLBACK');return res.status(409).json({error:'This payout has already been confirmed as paid.'});}if(payout.status==='otp_required'){await client.query('ROLLBACK');return res.status(409).json({error:'This payout is waiting for an OTP. Use the OTP form instead of sending it again.'});}if(payout.status==='transferring'&&payout.transfer_reference){reference=payout.transfer_reference;await client.query('COMMIT');}else{if(payout.status!=='approved'){await client.query('ROLLBACK');return res.status(409).json({error:'Only an approved payout can be sent. Failed payouts require a new seller request.'});}if(!payout.recipient_code){await client.query('ROLLBACK');return res.status(409).json({error:'This request has no verified Paystack recipient. Ask the seller to resubmit bank details.'});}reference=payout.transfer_reference||`zyp-${payout.id}-${crypto.randomBytes(12).toString('hex')}`;await client.query("UPDATE seller_payout_requests SET status='transferring',transfer_reference=$1,updated_at=NOW() WHERE id=$2",[reference,payout.id]);await client.query('COMMIT');}}
 catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 try{
  if(payout.status==='transferring'&&payout.transfer_reference){
   const result=await paystackRequest(`/transfer/verify/${encodeURIComponent(reference)}`);
   const mapped=result.status==='success'?'transfer.success':result.status==='failed'?'transfer.failed':result.status==='reversed'?'transfer.reversed':null;
   if(mapped)await applyTransferWebhook(mapped,result);
   return res.json({ok:true,status:result.status,transfer_reference:reference,message:'Existing transfer checked. No second transfer was sent.'});
  }
  const transfer=await paystackRequest('/transfer','POST',{source:'balance',amount:Number(payout.amount_kobo),recipient:payout.recipient_code,reference,reason:`ZYVORA seller payout #${payout.id}`,currency:process.env.PAYSTACK_CURRENCY||'NGN'});
  const status=String(transfer.status||'pending');const next=status==='otp'?'otp_required':'transferring';
  await pool.query("UPDATE seller_payout_requests SET status=$1,provider_status=$2,transfer_code=COALESCE(NULLIF($3,''),transfer_code),updated_at=NOW() WHERE id=$4",[next,status,String(transfer.transfer_code||''),payout.id]);
  await audit(req.session.user.id,'payout_transfer_initiated','payout',payout.id,{reference,provider_status:status});
  res.json({ok:true,status:next,provider_status:status,transfer_reference:reference,transfer_code:transfer.transfer_code||null,message:status==='otp'?'Paystack requires an OTP. Enter the code sent to the business owner.':'Transfer submitted. Final payment status will be confirmed by Paystack webhook or verification.'});
 }catch(error){
  const definiteRejection=(error.provider?.status===false)||(Number(error.status)>=400&&Number(error.status)<500&&![408,409,429].includes(Number(error.status)));
  if(definiteRejection)await pool.query("UPDATE seller_payout_requests SET status='failed',provider_status=$1,admin_note=$2,updated_at=NOW() WHERE id=$3 AND status='transferring'",[`request_rejected_${error.status}`,String(error.message||'Provider rejected transfer').slice(0,500),payout.id]);
  await notifyOps('seller payout transfer request failed',{payout_id:payout.id,reference,http_status:error.status||null,definite_rejection:definiteRejection,error:error.message});
  throw error;
 }
}));
app.post('/api/admin/payouts/:id/transfer/finalize',requireAdmin,asyncRoute(async(req,res)=>{const otp=String(req.body.otp||'').replace(/\s/g,'');if(!/^\d{4,10}$/.test(otp))return res.status(400).json({error:'Enter the valid OTP sent by Paystack.'});const found=await pool.query("SELECT id,transfer_code,status FROM seller_payout_requests WHERE id=$1",[req.params.id]);const payout=found.rows[0];if(!payout||payout.status!=='otp_required'||!payout.transfer_code)return res.status(409).json({error:'This payout is not waiting for an OTP.'});const finalized=await paystackRequest('/transfer/finalize_transfer','POST',{transfer_code:payout.transfer_code,otp});await pool.query("UPDATE seller_payout_requests SET status='transferring',provider_status=$1,updated_at=NOW() WHERE id=$2",[String(finalized.status||'pending'),payout.id]);await audit(req.session.user.id,'payout_transfer_otp_finalized','payout',payout.id);res.json({ok:true,status:'transferring',provider_status:finalized.status||'pending',message:'OTP accepted. Awaiting final Paystack transfer confirmation.'});}));
app.post('/api/admin/payouts/:id/verify',requireAdmin,asyncRoute(async(req,res)=>{const found=await pool.query('SELECT transfer_reference FROM seller_payout_requests WHERE id=$1',[req.params.id]);if(!found.rows[0]?.transfer_reference)return res.status(409).json({error:'No Paystack transfer reference exists for this payout.'});const result=await paystackRequest(`/transfer/verify/${encodeURIComponent(found.rows[0].transfer_reference)}`);const mapped=result.status==='success'?'transfer.success':result.status==='failed'?'transfer.failed':result.status==='reversed'?'transfer.reversed':null;if(mapped)await applyTransferWebhook(mapped,result);res.json({transfer:result,status:result.status,message:'Paystack transfer status retrieved.'});}));
app.get('/api/admin/sellers',requireAdmin,asyncRoute(async(req,res)=>{const {rows}=await pool.query(`SELECT u.id,u.name,u.email,u.suspended,s.store_name,s.description,s.status AS store_status,s.created_at FROM users u LEFT JOIN seller_stores s ON s.user_id=u.id WHERE u.role='seller' ORDER BY u.created_at DESC`);res.json({sellers:rows});}));
app.patch('/api/admin/orders/:id/tracking',requireAdmin,asyncRoute(async(req,res)=>{const code=String(req.body.tracking_code||'').trim().slice(0,100),provider=String(req.body.shipping_provider||'').trim().slice(0,100);if(!code||!provider)return res.status(400).json({error:'Enter a tracking code and delivery provider.'});const {rows}=await pool.query('UPDATE orders SET tracking_code=$1,shipping_provider=$2 WHERE id=$3 RETURNING id,tracking_code,shipping_provider',[code,provider,req.params.id]);if(!rows[0])return res.sendStatus(404);await pool.query('INSERT INTO order_events(order_id,status,note,actor_user_id) VALUES($1,$2,$3,$4)',[req.params.id,'tracking_updated',`${provider}: ${code}`,req.session.user.id]);await audit(req.session.user.id,'order_tracking_updated','order',req.params.id,{provider,code});res.json({order:rows[0]});}));
app.get('/api/admin/support/tickets',requireAdmin,asyncRoute(async(req,res)=>{const {rows}=await pool.query('SELECT * FROM support_tickets ORDER BY created_at DESC LIMIT 300');res.json({tickets:rows});}));
app.patch('/api/admin/support/tickets/:id',requireAdmin,asyncRoute(async(req,res)=>{const status=String(req.body.status||'');if(!['open','in_progress','resolved','closed'].includes(status))return res.status(400).json({error:'Invalid ticket status.'});const {rows}=await pool.query('UPDATE support_tickets SET status=$1 WHERE id=$2 RETURNING *',[status,req.params.id]);if(!rows[0])return res.sendStatus(404);await audit(req.session.user.id,'support_ticket_'+status,'support_ticket',req.params.id);res.json({ticket:rows[0]});}));
app.get('/api/admin/customers',requireAdmin,asyncRoute(async(req,res)=>{const {rows}=await pool.query("SELECT id,name,email,phone,created_at,suspended FROM users WHERE role='customer' ORDER BY created_at DESC LIMIT 500");res.json({customers:rows});}));
app.patch('/api/admin/users/:id/status',requireAdmin,asyncRoute(async(req,res)=>{const suspended=!!req.body.suspended;const {rows}=await pool.query("UPDATE users SET suspended=$1 WHERE id=$2 AND role<>'admin' RETURNING id,name,email,role,suspended",[suspended,req.params.id]);if(!rows[0])return res.status(404).json({error:'User not found.'});await audit(req.session.user.id,suspended?'user_suspended':'user_reinstated','user',req.params.id);res.json({user:rows[0]});}));
app.get('/api/admin/audit',requireAdmin,asyncRoute(async(req,res)=>{const {rows}=await pool.query('SELECT a.*,u.email AS admin_email FROM admin_audit_log a LEFT JOIN users u ON u.id=a.admin_id ORDER BY a.created_at DESC LIMIT 300');res.json({events:rows});}));
app.post('/api/admin/refunds/:orderId/record',requireAdmin,asyncRoute(async(req,res)=>{
 const refund=Math.round(Number(req.body.amount_ngn)*100);
 if(!Number.isSafeInteger(refund)||refund<=0)return res.status(400).json({error:'Enter a valid refund amount.'});
 if(!process.env.PAYSTACK_SECRET_KEY)return res.status(503).json({error:'Paystack is not configured. No refund was sent or recorded.'});
 const client=await pool.connect();let transactionOpen=false;
 try{
  await client.query('BEGIN');transactionOpen=true;
  const o=await client.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE',[req.params.orderId]);
  if(!o.rows[0]){await client.query('ROLLBACK');transactionOpen=false;return res.sendStatus(404);}
  const order=o.rows[0],already=Number(order.refunded_kobo||0);
  if(order.payment_status!=='paid') {await client.query('ROLLBACK');transactionOpen=false;return res.status(409).json({error:'Only successfully paid Paystack orders can be refunded through this action.'});}
  if(already+refund>Number(order.total_kobo)){await client.query('ROLLBACK');transactionOpen=false;return res.status(400).json({error:'Refund exceeds the remaining order value.'});}
  // Keep the order row locked while the provider is called so concurrent admin refunds cannot exceed the balance.
  const providerResponse=await fetch('https://api.paystack.co/refund',{method:'POST',headers:{Authorization:`Bearer ${process.env.PAYSTACK_SECRET_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({transaction:order.payment_reference,amount:refund,merchant_note:`ZYVORA refund for order ${order.id}`}),signal:AbortSignal.timeout(20000)});
  const provider=await providerResponse.json();
  if(!providerResponse.ok||!provider.status){await client.query('ROLLBACK');transactionOpen=false;return res.status(502).json({error:provider.message||'Paystack did not accept the refund. No marketplace refund was recorded.'});}
  await client.query(`UPDATE orders SET refunded_kobo=refunded_kobo+$1,status=CASE WHEN refunded_kobo+$1>=total_kobo THEN 'refunded' ELSE status END WHERE id=$2`,[refund,order.id]);
  const commissions=await client.query('SELECT * FROM seller_commissions WHERE order_id=$1 FOR UPDATE',[order.id]);
  const itemRefund=Math.min(refund,Math.max(0,Number(order.subtotal_kobo)-Number(order.discount_kobo||0)));
  let allocated=0;
  for(let i=0;i<commissions.rows.length;i++){
   const c=commissions.rows[i],remainingGross=Math.max(0,Number(c.gross_kobo)-Number(c.refunded_gross_kobo));
   const proportional=i===commissions.rows.length-1?Math.min(remainingGross,Math.max(0,itemRefund-allocated)):Math.min(remainingGross,Math.round(itemRefund*Number(c.gross_kobo)/Math.max(1,Number(order.subtotal_kobo))));
   allocated+=proportional;const rev=Math.round(proportional*Number(c.commission_rate_bps)/10000),sellerDebit=proportional-rev;
   await client.query(`UPDATE seller_commissions SET refunded_gross_kobo=refunded_gross_kobo+$1,refunded_commission_kobo=refunded_commission_kobo+$2,seller_net_kobo=GREATEST(0,seller_net_kobo-$3),status=CASE WHEN refunded_gross_kobo+$1>=gross_kobo THEN 'refunded' ELSE status END,updated_at=NOW() WHERE id=$4`,[proportional,rev,sellerDebit,c.id]);
   if(sellerDebit>0)await client.query(`INSERT INTO marketplace_ledger(seller_id,order_id,entry_type,amount_kobo,reference,description) VALUES($1,$2,'refund_adjustment',$3,$4,$5) ON CONFLICT(reference) DO NOTHING`,[c.seller_id,order.id,-sellerDebit,`refund-${provider.data?.id||provider.data?.reference||order.id}-${c.seller_id}`,'Seller share adjustment after Paystack refund']);
  }
  await client.query(`INSERT INTO order_events(order_id,status,note,actor_user_id) VALUES($1,'refund_requested',$2,$3)`,[order.id,`Paystack refund accepted: ${provider.data?.id||provider.data?.reference||'reference pending'}; amount ${refund} kobo`,req.session.user.id]);
  await audit(req.session.user.id,'paystack_refund_submitted','order',order.id,{refund_kobo:refund,paystack_refund_id:provider.data?.id||null});
  await client.query('COMMIT');transactionOpen=false;
  res.json({ok:true,refund_kobo:refund,paystack_refund:provider.data,status:provider.data?.status||'pending',note:'Paystack accepted the refund request. Final settlement timing is controlled by Paystack.'});
 }catch(e){if(transactionOpen)await client.query('ROLLBACK');throw e;}finally{client.release();}
}));
app.get('/api/admin/shipping',requireAdmin,asyncRoute(async(req,res)=>{const {rows}=await pool.query('SELECT id,status,shipping_kobo,shipping_address,tracking_code,shipping_provider,shipping_provider_order_id,shipping_tracking_url,shipping_waybill_url,shipping_booking_status,shipping_provider_status,shipping_last_synced_at,shipping_rate_options,created_at FROM orders ORDER BY created_at DESC LIMIT 300');res.json({orders:rows});}));

// Shipbubble delivery operations; quotes and labels are only created after an admin action.
app.post('/api/admin/orders/:id/shipping/rates',requireAdmin,asyncRoute(async(req,res)=>{
 const senderCode=Number(process.env.SHIPBUBBLE_SENDER_ADDRESS_CODE),categoryId=Number(process.env.SHIPBUBBLE_CATEGORY_ID),defaultWeight=Number(process.env.SHIPBUBBLE_DEFAULT_ITEM_WEIGHT_KG||0.5);
 if(!Number.isSafeInteger(senderCode)||senderCode<=0||!Number.isInteger(categoryId)||categoryId<=0)return res.status(503).json({error:'Configure Shipbubble API key, sender address code and package category before requesting rates.'});
 const found=await pool.query('SELECT * FROM orders WHERE id=$1',[req.params.id]);const order=found.rows[0];if(!order)return res.sendStatus(404);
 const address=typeof order.shipping_address==='string'?JSON.parse(order.shipping_address):order.shipping_address;
 const validated=await shipbubbleRequest('/shipping/address/validate','POST',{name:order.customer_name,email:order.email,phone:order.phone,address:[address.address,address.city,address.state,address.postalCode,address.country].filter(Boolean).join(', ')});
 if(!validated.address_code)return res.status(502).json({error:'Shipbubble did not return a validated delivery address.'});
 const items=(order.items||[]).map(i=>({name:String(i.name).slice(0,120),description:String(i.category||'ZYVORA product').slice(0,180),unit_weight:String(Number(i.weight_kg||defaultWeight)),unit_amount:String(Math.round(Number(i.unit_price_kobo)/100)),quantity:String(Number(i.quantity))}));
 const pickupDate=String(req.body.pickup_date||new Date(Date.now()+86400000).toISOString().slice(0,10));
 const dimension={length:Number(process.env.SHIPBUBBLE_PACKAGE_LENGTH_CM),width:Number(process.env.SHIPBUBBLE_PACKAGE_WIDTH_CM),height:Number(process.env.SHIPBUBBLE_PACKAGE_HEIGHT_CM)};
 const today=new Date();today.setUTCHours(0,0,0,0);const requestedPickup=new Date(`${pickupDate}T00:00:00Z`);const maxPickup=new Date(today.getTime()+7*86400000);if(!/^\d{4}-\d{2}-\d{2}$/.test(pickupDate)||Number.isNaN(requestedPickup.getTime())||requestedPickup<today||requestedPickup>maxPickup||Object.values(dimension).some(n=>!Number.isFinite(n)||n<=0))return res.status(400).json({error:'Configure package dimensions in centimetres and choose a pickup date within the next seven days.'});
 const rates=await shipbubbleRequest('/shipping/fetch_rates','POST',{sender_address_code:Number(senderCode),reciever_address_code:Number(validated.address_code),pickup_date:pickupDate,category_id:categoryId,package_items:items,package_dimension:dimension,service_type:'pickup'});
 if(!rates.request_token||!Array.isArray(rates.couriers))return res.status(502).json({error:'Shipbubble did not return courier rate options.'});
 await pool.query('UPDATE orders SET shipping_recipient_address_code=$1,shipping_request_token=$2,shipping_rate_options=$3::jsonb WHERE id=$4',[String(validated.address_code),rates.request_token,JSON.stringify(rates.couriers),order.id]);
 res.json({request_token:rates.request_token,couriers:rates.couriers,checkout_shipping_kobo:Number(order.shipping_kobo),notice:'These are live carrier estimates. Compare the carrier total with the delivery fee already charged before booking.'});
}));
app.post('/api/admin/orders/:id/shipping/book',requireAdmin,asyncRoute(async(req,res)=>{
 const client=await pool.connect();let order,option;
 try{await client.query('BEGIN');const found=await client.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE',[req.params.id]);order=found.rows[0];if(!order){await client.query('ROLLBACK');return res.sendStatus(404);}if(order.shipping_provider_order_id||['submitting','booked','pending_review'].includes(order.shipping_booking_status)){await client.query('ROLLBACK');return res.status(409).json({error:'A shipment is already booked or its booking result needs reconciliation. Check the carrier dashboard before retrying.'});}const options=order.shipping_rate_options||[];option=options.find(x=>String(x.courier_id)===String(req.body.courier_id)&&String(x.service_code)===String(req.body.service_code));if(!order.shipping_request_token||!option){await client.query('ROLLBACK');return res.status(400).json({error:'Request fresh rates and choose a courier option returned by Shipbubble.'});}await client.query("UPDATE orders SET shipping_booking_status='submitting',shipping_booking_courier_id=$1,shipping_booking_service_code=$2 WHERE id=$3",[String(option.courier_id),String(option.service_code),order.id]);await client.query('COMMIT');}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 const payload={request_token:order.shipping_request_token,service_code:option.service_code,courier_id:option.courier_id};if(req.body.insurance_code)payload.insurance_code=String(req.body.insurance_code);if(order.payment_status==='pending_cod')payload.is_cod_label=true;
 let label;try{label=await shipbubbleRequest('/shipping/labels','POST',payload);}catch(error){const definiteRejection=[400,401,403,404,422].includes(Number(error.status));await pool.query("UPDATE orders SET shipping_booking_status=$1 WHERE id=$2",[definiteRejection?'failed':'pending_review',order.id]);await notifyOps(definiteRejection?'courier booking rejected':'courier booking needs reconciliation',{order_id:order.id,http_status:error.status||null,error:error.message});if(definiteRejection)throw Object.assign(new Error(`Shipbubble rejected the booking (${error.status}). Correct the request or configuration, then request a new label.`),{status:error.status});throw Object.assign(new Error('The carrier booking response was not confirmed. Check Shipbubble before attempting another label.'),{status:502});}const d=label||{},courier=d.courier||{};
 const trackingCode=String(courier.tracking_code||d.tracking_code||d.order_id||'').slice(0,120),trackingUrl=String(d.tracking_url||'').slice(0,1000),waybill=String(d.waybill_document||'').slice(0,1000);
 const {rows}=await pool.query("UPDATE orders SET shipping_provider=$1,tracking_code=$2,shipping_provider_order_id=$3,shipping_tracking_url=$4,shipping_waybill_url=$5,shipping_provider_status=$6,shipping_last_synced_at=NOW(),shipping_booking_status='booked' WHERE id=$7 RETURNING id,status,shipping_provider,tracking_code,shipping_provider_order_id,shipping_provider_status,shipping_last_synced_at,shipping_tracking_url,shipping_waybill_url",[String(courier.name||option.courier_name||'Shipbubble'),trackingCode,String(d.order_id||''),trackingUrl,waybill,String(d.status||'pending'),order.id]);
 await pool.query("INSERT INTO order_events(order_id,status,note,actor_user_id) VALUES($1,'shipment_booked',$2,$3)",[order.id,`Shipbubble booking ${d.order_id||''}; ${trackingCode}`.trim(),req.session.user.id]);await audit(req.session.user.id,'shipping_label_created','order',order.id,{provider_order_id:d.order_id,tracking_code:trackingCode});res.status(201).json({order:rows[0],label:d});
}));
app.post('/api/admin/orders/:id/shipping/refresh',requireAdmin,asyncRoute(async(req,res)=>{
 const found=await pool.query('SELECT id,shipping_provider_order_id,status,shipping_provider_status FROM orders WHERE id=$1',[req.params.id]);const order=found.rows[0];if(!order)return res.sendStatus(404);if(!order.shipping_provider_order_id)return res.status(409).json({error:'This order has no Shipbubble booking.'});
 const data=await shipbubbleRequest('/shipping/labels');const shipment=(data.results||[]).find(x=>String(x.order_id)===String(order.shipping_provider_order_id));if(!shipment)return res.status(404).json({error:'Shipment was not found in the first page of Shipbubble results. Use the saved tracking link or check the Shipbubble dashboard.'});
 const status=String(shipment.status||'').toLowerCase(),mapped=['completed','delivered'].includes(status)?'delivered':status==='cancelled'?'cancelled':['picked_up','in_transit','dispatched','in_transit_to_destination'].includes(status)?'shipped':order.status,tracking=shipment.courier?.tracking_code||'';
 const updated=await pool.query("UPDATE orders SET status=$1,shipping_provider_status=$6,shipping_last_synced_at=NOW(),tracking_code=COALESCE(NULLIF($2,''),tracking_code),shipping_tracking_url=COALESCE(NULLIF($3,''),shipping_tracking_url),shipping_waybill_url=COALESCE(NULLIF($4,''),shipping_waybill_url),shipping_booking_status=CASE WHEN $6='cancelled' THEN 'carrier_cancelled' ELSE shipping_booking_status END WHERE id=$5 RETURNING id,status,tracking_code,shipping_tracking_url,shipping_waybill_url",[mapped,tracking,shipment.tracking_url||'',shipment.waybill_document||'',order.id,status]);
 if(status!==String(order.shipping_provider_status||''))await pool.query('INSERT INTO order_events(order_id,status,note,actor_user_id) VALUES($1,$2,$3,$4)',[order.id,`carrier_${status}`,`Shipbubble status: ${status}`,req.session.user.id]);res.json({order:updated.rows[0],shipment});
}));

app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.use((err,req,res,next)=>{const status=Number(err.status)||500;console.error(JSON.stringify({level:"error",event:"request_error",request_id:req.id,method:req.method,path:req.path,status,message:err.message,code:err.code}));if(status>=500)notifyOps("server error",{request_id:req.id,path:req.path,method:req.method,message:err.message});res.status(status).json({error:status>=500&&process.env.NODE_ENV==="production"?"Something went wrong. Please try again.":err.message,request_id:req.id});});
process.on('unhandledRejection',reason=>{console.error(JSON.stringify({level:'fatal',event:'unhandled_rejection',message:String(reason?.message||reason)}));notifyOps('unhandled rejection',{message:String(reason?.message||reason)});});
process.on('uncaughtException',error=>{console.error(JSON.stringify({level:'fatal',event:'uncaught_exception',message:error.message,stack:error.stack}));notifyOps('uncaught exception',{message:error.message}).finally(()=>process.exit(1));});
let httpServer;
let isShuttingDown = false;
async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(JSON.stringify({ level: "info", event: "shutdown_started", signal }));
  const timeout = setTimeout(() => process.exit(1), 10_000);
  timeout.unref();
  try {
    if (httpServer) await new Promise((resolve) => httpServer.close(resolve));
    await pool.end();
    clearTimeout(timeout);
    process.exit(0);
  } catch (error) {
    console.error(JSON.stringify({ level: "error", event: "shutdown_failed", message: error.message }));
    process.exit(1);
  }
}
process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));

init()
  .then(() => {
    httpServer = app.listen(PORT, () => console.log(`ZYVORA running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("ZYVORA startup failed:", err.message);
    if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND" || err.code === "ETIMEDOUT") {
      console.error("Database connection check: confirm DATABASE_URL host, port, database name, username and password. Never use your PC's localhost URL on Render.");
    }
    process.exit(1);
  });
