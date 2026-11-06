#!/usr/bin/env node
'use strict';

require('dotenv').config();
const { Pool } = require('pg');

async function fetchShipments(apiKey) {
  const rows = [];
  let page = 1;
  const seen = new Set();
  for (let i = 0; i < 20 && page; i++) {
    if (seen.has(page)) throw new Error('Shipbubble pagination loop detected.');
    seen.add(page);
    const response = await fetch(`https://api.shipbubble.com/v1/shipping/labels?Page=${page}&PerPage=200`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(30000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.status !== 'success') throw new Error(`Shipbubble shipment sync failed (${response.status}): ${data.message || response.statusText}`);
    const payload = data.data || {};
    rows.push(...(Array.isArray(payload.results) ? payload.results : []));
    const next = Number(payload.pagination?.next || 0);
    page = Number.isInteger(next) && next > 0 ? next : 0;
  }
  if (page) throw new Error('Shipbubble pagination exceeded the 20-page safety limit; narrow the date range in the provider dashboard or increase the reviewed limit.');
  return rows;
}

function mapOrderStatus(carrierStatus, current) {
  const status = String(carrierStatus || '').toLowerCase();
  if (['completed', 'delivered'].includes(status)) return 'delivered';
  if (status === 'cancelled') return 'cancelled';
  if (['picked_up', 'in_transit', 'dispatched', 'in_transit_to_destination'].includes(status)) return ['delivered', 'cancelled'].includes(current) ? current : 'shipped';
  return current;
}

async function syncShipments() {
  const apiKey = String(process.env.SHIPBUBBLE_API_KEY || '').trim();
  if (!apiKey) throw new Error('SHIPBUBBLE_API_KEY is required to sync courier tracking.');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });
  try {
    const active = await pool.query("SELECT id,shipping_provider_order_id,status FROM orders WHERE shipping_booking_status='booked' AND shipping_provider_order_id<>'' AND status NOT IN ('delivered','cancelled')");
    if (!active.rowCount) return { checked: 0, updated: 0, pages: 0 };
    const shipments = await fetchShipments(apiKey);
    const byId = new Map(shipments.map(item => [String(item.order_id), item]));
    let updatedCount = 0;
    for (const order of active.rows) {
      const shipment = byId.get(String(order.shipping_provider_order_id));
      if (!shipment) continue;
      const carrierStatus = String(shipment.status || '').toLowerCase();
      if (!carrierStatus) continue;
      const nextStatus = mapOrderStatus(carrierStatus, order.status);
      const tracking = String(shipment.courier?.tracking_code || '').slice(0, 120);
      const trackingUrl = String(shipment.tracking_url || '').slice(0, 1000);
      const waybill = String(shipment.waybill_document || '').slice(0, 1000);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const latest = await client.query('SELECT shipping_provider_status,status FROM orders WHERE id=$1 FOR UPDATE', [order.id]);
        if (!latest.rowCount) { await client.query('ROLLBACK'); continue; }
        const previousCarrierStatus = String(latest.rows[0].shipping_provider_status || '');
        const finalOrderStatus = mapOrderStatus(carrierStatus, latest.rows[0].status);
        await client.query(`UPDATE orders SET status=$1,shipping_provider_status=$2,shipping_last_synced_at=NOW(),
          tracking_code=COALESCE(NULLIF($3,''),tracking_code),shipping_tracking_url=COALESCE(NULLIF($4,''),shipping_tracking_url),
          shipping_waybill_url=COALESCE(NULLIF($5,''),shipping_waybill_url),
          shipping_booking_status=CASE WHEN $2='cancelled' THEN 'carrier_cancelled' ELSE shipping_booking_status END
          WHERE id=$6`, [finalOrderStatus, carrierStatus, tracking, trackingUrl, waybill, order.id]);
        if (carrierStatus !== previousCarrierStatus) {
          const eventStatus = `carrier_${carrierStatus}`;
          const eventNote = `Shipbubble update: ${carrierStatus}`;
          await client.query(`INSERT INTO order_events(order_id,status,note) SELECT $1,$2,$3
            WHERE NOT EXISTS (SELECT 1 FROM order_events WHERE order_id=$1 AND status=$2 AND note=$3)`, [order.id, eventStatus, eventNote]);
          updatedCount++;
        }
        await client.query('COMMIT');
      } catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
    }
    return { checked: active.rowCount, carrier_records: shipments.length, updated: updatedCount };
  } finally { await pool.end(); }
}

async function notifyFailure(error) {
  const endpoint = String(process.env.ALERT_WEBHOOK_URL || '').trim();
  if (!endpoint) return;
  try { await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: 'ZYVORA courier tracking sync failed', event: 'courier_tracking_sync_failed', details: { message: error.message }, at: new Date().toISOString() }), signal: AbortSignal.timeout(8000) }); }
  catch (notifyError) { console.error(`Courier sync alert failed: ${notifyError.message}`); }
}

if (require.main === module) {
  syncShipments().then(result => console.log(JSON.stringify({ level: 'info', event: 'courier_tracking_sync_complete', ...result })))
    .catch(async error => { console.error(JSON.stringify({ level: 'error', event: 'courier_tracking_sync_failed', message: error.message })); await notifyFailure(error); process.exitCode = 1; });
}

module.exports = { syncShipments, mapOrderStatus, fetchShipments };
