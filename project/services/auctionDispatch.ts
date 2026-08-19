// Shared whole-auction dispatch helpers. Used by the admin flow
// (pages/api/webhook/send-auction.ts) and the Metro Manager flow
// (pages/api/metro/auctions.ts). The n8n Auction Dispatcher feeds every lot
// through the normal per-lot pipeline (send-url), so credits/duplicates/filters
// all behave as usual and re-dispatch is safe.

const SCRAPER_URL = 'https://hibid-seven.vercel.app/api/scrape-auction';
const DISPATCHER_URL = 'https://sorcer.app.n8n.cloud/webhook/auction-dispatch';

export interface ScrapedAuction {
  auctionName: string;
  totalLots: number;
  lots: any[];
}

// Scrape a catalog page for its name + full lot count. Returns null if the page
// can't be read (caller decides how to handle — 422, or fall back to defaults).
export async function scrapeAuction(auctionUrl: string): Promise<ScrapedAuction | null> {
  let scrape: any = null;
  try {
    const res = await fetch(`${SCRAPER_URL}?url=${encodeURIComponent(auctionUrl)}`);
    if (res.ok) {
      scrape = await res.json();
    } else {
      console.error(`[auctionDispatch] scraper returned ${res.status}`);
    }
  } catch (e) {
    console.error('[auctionDispatch] scraper request failed:', e);
  }

  const auctionName: string = scrape?.auction_name;
  const totalLots: number =
    Number(scrape?.total_lots) || (Array.isArray(scrape?.lots) ? scrape.lots.length : 0);

  if (!scrape || !Array.isArray(scrape.lots) || totalLots <= 0 || !auctionName) {
    return null;
  }
  return { auctionName, totalLots, lots: scrape.lots };
}

// Fire-and-forget the n8n dispatcher (bounded to 10s; it acks fast with
// dispatch_started and keeps working in the background).
export async function fireAuctionDispatcher(payload: {
  auctionUrl: string;
  adminId: string;
  adminEmail?: string;
}): Promise<void> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    await fetch(DISPATCHER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auction_url: payload.auctionUrl,
        adminId: payload.adminId,
        adminEmail: payload.adminEmail,
      }),
      signal: controller.signal,
    })
      .then((r) => console.log(`[auctionDispatch] dispatcher acked: ${r.status}`))
      .catch((err) => console.error('[auctionDispatch] dispatcher error:', err?.message || err))
      .finally(() => clearTimeout(timeout));
  } catch (e) {
    console.error('[auctionDispatch] dispatch failed:', e);
  }
}
