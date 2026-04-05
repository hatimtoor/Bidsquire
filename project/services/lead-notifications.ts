/**
 * Lead Notification Emails
 * Sends internal alerts to paul@schmoozzer.com and hatimtoor2025@gmail.com
 * at key moments in the trial user lifecycle.
 * Uses Resend API (already configured in the onboarding app, same key).
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const FROM_EMAIL = 'bid@bidsquire.com';
const NOTIFY_EMAILS = ['paul@schmoozzer.com', 'hatimtoor2025@gmail.com'];

async function sendEmail(subject: string, html: string): Promise<void> {
  if (!RESEND_API_KEY) {
    console.warn('[Notify] RESEND_API_KEY not set — skipping email');
    return;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `Bidsquire Alerts <${FROM_EMAIL}>`,
        to: NOTIFY_EMAILS,
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[Notify] Resend error:', err);
    } else {
      console.log('[Notify] Email sent:', subject);
    }
  } catch (e) {
    console.error('[Notify] Failed to send email:', e);
  }
}

function row(label: string, value: string) {
  return `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;white-space:nowrap">${label}</td><td style="padding:4px 0;font-weight:500;color:#111">${value}</td></tr>`;
}

function card(title: string, emoji: string, tableRows: string, extra?: string) {
  return `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
      <div style="background:#0ea5e9;padding:20px 24px">
        <h1 style="margin:0;color:#fff;font-size:18px">${emoji} ${title}</h1>
      </div>
      <div style="padding:24px">
        <table style="border-collapse:collapse;width:100%">${tableRows}</table>
        ${extra || ''}
      </div>
      <div style="background:#f9fafb;padding:12px 24px;font-size:12px;color:#9ca3af">
        Bidsquire internal alert — do not reply
      </div>
    </div>`;
}

// ── Event 1: Auction URL Fetched ─────────────────────────────────────────────

export async function notifyAuctionFetched(params: {
  adminName: string;
  adminEmail: string;
  orgName?: string;
  auctionUrl: string;
  itemId: string;
}) {
  const { adminName, adminEmail, orgName, auctionUrl } = params;
  const subject = `🔍 New auction fetch — ${adminName}`;
  const html = card(
    'Trial user fetched an auction',
    '🔍',
    row('User', `${adminName} &lt;${adminEmail}&gt;`) +
    row('Org', orgName || '—') +
    row('Auction URL', `<a href="${auctionUrl}" style="color:#0ea5e9">${auctionUrl}</a>`) +
    row('Time', new Date().toLocaleString('en-GB', { timeZone: 'UTC' }) + ' UTC'),
    `<p style="margin:16px 0 0;font-size:13px;color:#6b7280">
      This user found an auction to test. Consider checking in with them to see how the bidding goes.
    </p>`
  );
  await sendEmail(subject, html);
}

// ── Event 2: Items Marked as Winning ─────────────────────────────────────────

export async function notifyItemsWon(params: {
  adminName: string;
  adminEmail: string;
  orgName?: string;
  itemName: string;
  auctionUrl?: string;
  auctionName?: string;
}) {
  const { adminName, adminEmail, orgName, itemName, auctionUrl, auctionName } = params;
  const subject = `🏆 Item marked as winning — ${adminName}`;
  const html = card(
    'Trial user won an item at auction',
    '🏆',
    row('User', `${adminName} &lt;${adminEmail}&gt;`) +
    row('Org', orgName || '—') +
    row('Item', itemName) +
    (auctionName ? row('Auction', auctionName) : '') +
    (auctionUrl ? row('URL', `<a href="${auctionUrl}" style="color:#0ea5e9">${auctionUrl}</a>`) : '') +
    row('Time', new Date().toLocaleString('en-GB', { timeZone: 'UTC' }) + ' UTC'),
    `<p style="margin:16px 0 0;font-size:13px;color:#6b7280">
      Once they collect the item, send a reminder to take great photos and upload them.
      Morning after collection is the ideal time to follow up.
    </p>`
  );
  await sendEmail(subject, html);
}

// ── Event 3: Photos Uploaded ──────────────────────────────────────────────────

export async function notifyPhotosUploaded(params: {
  adminName: string;
  adminEmail: string;
  orgName?: string;
  itemName: string;
  photoCount: number;
  auctionUrl?: string;
}) {
  const { adminName, adminEmail, orgName, itemName, photoCount, auctionUrl } = params;
  const subject = `📸 Photos uploaded — ${adminName} (${photoCount} photo${photoCount !== 1 ? 's' : ''})`;
  const html = card(
    'Trial user uploaded photos',
    '📸',
    row('User', `${adminName} &lt;${adminEmail}&gt;`) +
    row('Org', orgName || '—') +
    row('Item', itemName) +
    row('Photos uploaded', String(photoCount)) +
    (auctionUrl ? row('Auction URL', `<a href="${auctionUrl}" style="color:#0ea5e9">${auctionUrl}</a>`) : '') +
    row('Time', new Date().toLocaleString('en-GB', { timeZone: 'UTC' }) + ' UTC'),
    `<p style="margin:16px 0 0;font-size:13px;color:#6b7280">
      The item is now in research2 for final review before eBay listing.
    </p>`
  );
  await sendEmail(subject, html);
}
