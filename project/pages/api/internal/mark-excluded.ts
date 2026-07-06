// Internal endpoint: marks an auction item as auto-excluded by the category
// filter and refunds the 1 credit spent fetching it. Called by the n8n scraper
// pipeline. Auth: x-internal-secret header (same pattern as item-db/*.ts).
//
// Idempotency: n8n may retry. If the item's review_rejection_reason already
// starts with 'Auto-excluded' we skip BOTH the update and the refund and report
// alreadyExcluded, so retries can't double-credit the admin.
import type { NextApiRequest, NextApiResponse } from 'next';
import { databaseService } from '@/services/database';

const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.headers['x-internal-secret'] !== INTERNAL_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { itemId, adminId, reason } = req.body || {};
  if (!itemId || !adminId) {
    return res.status(400).json({ error: 'itemId and adminId are required' });
  }

  const client = await (databaseService as any).getClient();
  try {
    // Read current state first to detect a retry.
    const existing = await client.query(
      'SELECT review_rejection_reason FROM auction_items WHERE id = $1',
      [itemId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    const currentReason: string = existing.rows[0].review_rejection_reason || '';
    if (currentReason.startsWith('Auto-excluded')) {
      // Already processed — skip update and refund.
      return res.status(200).json({ success: true, alreadyExcluded: true });
    }

    // (a) Mark the item excluded.
    await client.query(
      `UPDATE auction_items
       SET status = 'research',
           review_status = 'rejected',
           review_rejection_reason = $1,
           ai_description = 'Skipped by category filter',
           updated_at = NOW()
       WHERE id = $2`,
      [`Auto-excluded: ${reason ?? ''}`, itemId]
    );

    // (b) Refund 1 credit — logged as a credit_transactions row.
    await databaseService.topUpCredits(
      adminId,
      1,
      'Refund: item auto-excluded by category filter'
    );

    // (c) Respond.
    return res.status(200).json({ success: true, refunded: true });
  } catch (error) {
    console.error('[internal/mark-excluded]', error);
    return res.status(500).json({
      error: 'Failed to mark item excluded',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  } finally {
    client.release();
  }
}
