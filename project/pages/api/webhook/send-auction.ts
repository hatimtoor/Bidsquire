// Whole-auction dispatch. Admins paste an auction-level (catalog) HiBid URL and
// this pre-flights it (scrape for lot count + credit gate) then hands off to the
// n8n Auction Dispatcher, which feeds every lot through the normal per-lot
// pipeline (send-url.ts) — so credits, duplicates, filters and webhooks all
// behave as usual, and re-dispatching a partially-run auction is safe.
//
// Auth mirrors send-url.ts exactly (trusts adminId from the body; no JWT).
import type { NextApiRequest, NextApiResponse } from 'next';
import { scrapeAuction, fireAuctionDispatcher } from '@/services/auctionDispatch';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const { auction_url, adminId, adminEmail } = req.body || {};
    if (!auction_url || typeof auction_url !== 'string') {
      return res.status(400).json({ error: 'auction_url is required' });
    }
    if (!adminId) {
      return res.status(400).json({ error: 'adminId is required' });
    }

    // (a) Scrape the catalog for the auction name + full lot count.
    const scraped = await scrapeAuction(auction_url);
    if (!scraped) {
      return res.status(422).json({ error: 'Could not read this auction page.' });
    }
    const { auctionName, totalLots } = scraped;

    const { databaseService } = await import('@/services/database');

    // (b) Pre-flight credit gate — no deduction here; send-url charges per lot as
    // the dispatcher processes each one.
    const credits = await databaseService.getUserCredits(adminId);
    const available = credits?.current_credits ?? 0;
    if (available < totalLots) {
      return res.status(403).json({
        code: 'INSUFFICIENT_CREDITS_FOR_AUCTION',
        needed: totalLots,
        available,
        message: `This auction has ${totalLots} lots but you have ${available} credits.`,
      });
    }

    // (c) Duplicate-dispatch guard: warn (but allow) if we've already emailed a
    // summary for this auction — re-dispatch is legitimate for resuming.
    let alreadyEmailed = false;
    try {
      const client = await (databaseService as any).getClient();
      try {
        const dup = await client.query(
          'SELECT 1 FROM auction_email_log WHERE auction_name = $1 AND admin_id::text = $2 LIMIT 1',
          [auctionName, adminId]
        );
        alreadyEmailed = dup.rows.length > 0;
      } finally {
        client.release();
      }
    } catch (e) {
      // Non-fatal (e.g. table not present in this environment).
      console.error('[send-auction] duplicate check failed:', e);
    }

    // (d) Fire-and-forget the dispatcher (it acks fast and keeps working in the
    // background, feeding each lot through the normal per-lot pipeline).
    await fireAuctionDispatcher({ auctionUrl: auction_url, adminId, adminEmail });

    return res.status(200).json({
      success: true,
      auction_name: auctionName,
      total_lots: totalLots,
      estimated_minutes: Math.ceil(totalLots), // dispatch pace ~1 lot/min
      ...(alreadyEmailed ? { alreadyEmailed: true } : {}),
    });
  } catch (error) {
    console.error('[send-auction] error:', error);
    return res.status(500).json({
      error: 'Failed to dispatch auction',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
