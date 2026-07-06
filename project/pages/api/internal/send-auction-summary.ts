// Internal endpoint: builds and sends the Auction Summary email for a settled
// auction, then records it so it's only ever sent once. Auth: x-internal-secret.
//
// POST { auction_name, admin_id }.  Optional ?to=<email> overrides the recipient
// (dry-run testing only; still gated behind the internal secret).
import type { NextApiRequest, NextApiResponse } from 'next';
import { databaseService } from '@/services/database';
import { sendResendEmail } from '@/services/lead-notifications';

const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET;

const VERDICT_COLORS: Record<string, string> = {
  A: '#16a34a', // green
  B: '#2563eb', // blue
  C: '#d97706', // amber
  D: '#dc2626', // red
};

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function appOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL || 'https://app.bidsquire.com';
  try {
    return new URL(raw).origin;
  } catch {
    return 'https://app.bidsquire.com';
  }
}

function formatPrice(price: unknown): string {
  if (price === null || price === undefined || price === '') return '';
  if (typeof price === 'number') return `$${price}`;
  const str = String(price).trim();
  return str.startsWith('$') ? str : `$${str}`;
}

function verdictBadge(verdict: unknown): string {
  const key = String(verdict ?? '').toUpperCase();
  const color = VERDICT_COLORS[key];
  if (!color) return '';
  return `<span style="display:inline-block;background:${color};color:#ffffff;font-weight:700;font-size:13px;padding:2px 9px;border-radius:4px">${key}</span>`;
}

function confidenceScore(item: any): number {
  const raw = item?.final_data?.confidenceScore;
  const num = Number(raw);
  return Number.isFinite(num) ? num : NaN;
}

function buildItemHtml(item: any, origin: string): string {
  const lot = escapeHtml(item.lot_number || '—');
  const name = escapeHtml(item.item_name || 'Unnamed item');
  const estimate = escapeHtml(item.researcher_estimate || item.auction_site_estimate || '—');
  const badge = verdictBadge(item.critic_verdict);

  // Comps — top 3 from final_data.topComps
  const comps = Array.isArray(item?.final_data?.topComps)
    ? item.final_data.topComps.slice(0, 3)
    : [];
  let compsHtml = '';
  if (comps.length > 0) {
    const rows = comps
      .map((c: any) => {
        const title = escapeHtml(c?.title || 'Comparable');
        const price = formatPrice(c?.price);
        const priceStr = price ? ` — ${escapeHtml(price)}` : '';
        const link = c?.url
          ? `  <a href="${escapeHtml(c.url)}" style="color:#2563eb">(link)</a>`
          : '';
        return `<div style="margin-left:14px">• ${title}${priceStr}${link}</div>`;
      })
      .join('');
    compsHtml = `<div style="margin:6px 0"><div style="color:#374151">Comps:</div>${rows}</div>`;
  }

  // Warnings — each on its own line, amber ⚠ prefix
  const warnings = Array.isArray(item?.final_data?.warnings)
    ? item.final_data.warnings.filter((w: unknown) => w && String(w).trim())
    : [];
  const warningsHtml = warnings
    .map(
      (w: unknown) =>
        `<div style="color:#b45309;margin:3px 0">⚠ ${escapeHtml(String(w))}</div>`
    )
    .join('');

  const itemUrl = `${origin}/admin`;

  return `
    <div style="border-top:1px solid #e5e7eb;padding:16px 0">
      <div style="font-size:17px;font-weight:700;color:#111111">LOT ${lot} — ${name}</div>
      <div style="margin:6px 0;font-size:15px">Estimate: ${estimate} &nbsp;&nbsp; ${badge}</div>
      ${compsHtml}
      ${warningsHtml}
      <div style="margin-top:10px"><a href="${escapeHtml(itemUrl)}" style="color:#2563eb;font-weight:600">View in Bidsquire →</a></div>
    </div>`;
}

function buildEmailHtml(params: {
  auctionName: string;
  includedItems: any[];
  excludedCount: number;
  auctionUrl: string | null;
}): string {
  const { auctionName, includedItems, excludedCount, auctionUrl } = params;
  const origin = appOrigin();
  const generatedAt = new Date().toLocaleString('en-GB', { timeZone: 'UTC' }) + ' UTC';
  const n = includedItems.length;

  const header = `
    <div style="padding-bottom:12px">
      <div style="font-size:22px;font-weight:800;color:#111111">${escapeHtml(auctionName)}</div>
      <div style="color:#6b7280;font-size:14px;margin-top:4px">
        ${n} item${n !== 1 ? 's' : ''} summarized · Generated ${escapeHtml(generatedAt)}
      </div>
    </div>`;

  const itemsHtml = includedItems.map((it) => buildItemHtml(it, origin)).join('');

  const footerParts: string[] = [];
  if (excludedCount > 0) {
    footerParts.push(
      `<div style="margin:4px 0">${excludedCount} low-confidence/rejected item${
        excludedCount !== 1 ? 's were' : ' was'
      } held back for review. <a href="${escapeHtml(
        `${origin}/super-admin/review-queue`
      )}" style="color:#2563eb">Open the review queue →</a></div>`
    );
  }
  if (auctionUrl) {
    footerParts.push(
      `<div style="margin:4px 0"><a href="${escapeHtml(
        auctionUrl
      )}" style="color:#2563eb">View auction listing →</a></div>`
    );
  }
  const footer = footerParts.join('');

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;padding:16px;color:#111111;font-size:16px;line-height:1.5">
      ${header}
      ${itemsHtml}
      <div style="border-top:2px solid #e5e7eb;margin-top:16px;padding-top:12px;color:#6b7280;font-size:14px">
        ${footer || 'All items are included above.'}
      </div>
    </div>`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.headers['x-internal-secret'] !== INTERNAL_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { auction_name, admin_id } = req.body || {};
  if (!auction_name || !admin_id) {
    return res.status(400).json({ error: 'auction_name and admin_id are required' });
  }
  const toOverride = ((req.query.to as string) || '').trim();

  const client = await (databaseService as any).getClient();
  try {
    // (1) Idempotency — claim the send by inserting the log row first.
    const claim = await client.query(
      `INSERT INTO auction_email_log (auction_name, admin_id)
       VALUES ($1, $2)
       ON CONFLICT (auction_name, admin_id) DO NOTHING
       RETURNING id`,
      [auction_name, admin_id]
    );
    if (claim.rows.length === 0) {
      return res.status(200).json({ alreadySent: true });
    }

    // Roll back the claim if we can't actually send (so retries aren't blocked).
    const rollback = async () => {
      try {
        await client.query(
          'DELETE FROM auction_email_log WHERE auction_name = $1 AND admin_id::text = $2',
          [auction_name, admin_id]
        );
      } catch (e) {
        console.error('[send-auction-summary] rollback failed', e);
      }
    };

    // (2) Fetch items, numeric-prefix lot order.
    const itemsResult = await client.query(
      `SELECT id, lot_number, item_name, researcher_estimate, auction_site_estimate,
              critic_verdict, review_status, final_data, url, url_main
       FROM auction_items
       WHERE auction_name = $1 AND admin_id = $2 AND status <> 'processing'
       ORDER BY NULLIF(regexp_replace(lot_number, '\\D.*$', ''), '')::bigint NULLS LAST,
                lot_number ASC`,
      [auction_name, admin_id]
    );
    const items = itemsResult.rows;
    if (items.length === 0) {
      await rollback();
      return res.status(404).json({ error: 'No items found for this auction' });
    }

    // Recipient — admin's email (or dry-run override).
    let recipient = toOverride;
    if (!recipient) {
      const userResult = await client.query('SELECT email FROM users WHERE id = $1', [admin_id]);
      recipient = userResult.rows[0]?.email || '';
    }
    if (!recipient) {
      await rollback();
      return res.status(400).json({ error: 'No recipient email available for this admin' });
    }

    // (3) Partition: included = not rejected AND confidenceScore >= 0.5.
    const includedItems = items.filter(
      (it: any) => (it.review_status || '') !== 'rejected' && confidenceScore(it) >= 0.5
    );
    const sent = includedItems.length;
    const excluded = items.length - sent;

    // Representative auction URL (best-effort from the items).
    const withUrl = items.find((it: any) => it.url_main || it.url);
    const auctionUrl = withUrl ? withUrl.url_main || withUrl.url : null;

    // (4) Build + send.
    const html = buildEmailHtml({
      auctionName: auction_name,
      includedItems,
      excludedCount: excluded,
      auctionUrl,
    });
    const subject = `Auction Summary: ${auction_name} (${sent} items)`;

    const ok = await sendResendEmail({ to: recipient, subject, html });
    if (!ok) {
      await rollback();
      return res.status(502).json({ error: 'Failed to send auction summary email' });
    }

    // (5) Record how many were sent.
    await client.query(
      'UPDATE auction_email_log SET item_count = $1 WHERE auction_name = $2 AND admin_id::text = $3',
      [sent, auction_name, admin_id]
    );

    return res.status(200).json({ success: true, sent, excluded });
  } catch (error) {
    console.error('[internal/send-auction-summary]', error);
    return res.status(500).json({
      error: 'Failed to send auction summary',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  } finally {
    client.release();
  }
}
