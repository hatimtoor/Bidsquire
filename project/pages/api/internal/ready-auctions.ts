// Internal endpoint: lists auctions that are "settled" and ready for a summary
// email, for the n8n scheduler to pick up. Auth: x-internal-secret header
// (pattern per pages/api/internal/*.ts).
//
// An auction (auction_name + admin_id) is ready when ALL hold:
//   (a) it has >=1 non-processing item and a non-empty auction_name;
//   (b) the admin has no in-flight processing placeholder created in the last
//       20 min (placeholders carry NULL auction_name, so we can't attribute them
//       to an auction — a recent one for the admin blocks all their auctions);
//   (c) the newest item update is older than 15 min (the auction has gone quiet);
//   (d) no auction_email_log row already exists for it.
import type { NextApiRequest, NextApiResponse } from 'next';
import { databaseService } from '@/services/database';

const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.headers['x-internal-secret'] !== INTERNAL_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const client = await (databaseService as any).getClient();
  try {
    const result = await client.query(
      `SELECT g.auction_name, g.admin_id, u.email AS admin_email, g.item_count
       FROM (
         SELECT auction_name,
                admin_id,
                COUNT(*)::int          AS item_count,
                MAX(updated_at)        AS last_updated
         FROM auction_items
         WHERE status <> 'processing'
           AND auction_name IS NOT NULL
           AND auction_name <> ''
           AND admin_id IS NOT NULL
         GROUP BY auction_name, admin_id
       ) g
       JOIN users u ON u.id = g.admin_id
       WHERE g.last_updated < NOW() - INTERVAL '15 minutes'
         AND NOT EXISTS (
           SELECT 1 FROM auction_email_log l
           WHERE l.auction_name = g.auction_name
             AND l.admin_id::text = g.admin_id
         )
         AND NOT EXISTS (
           SELECT 1 FROM auction_items p
           WHERE p.admin_id = g.admin_id
             AND p.status = 'processing'
             AND p.created_at > NOW() - INTERVAL '20 minutes'
         )
       ORDER BY g.auction_name ASC`
    );

    return res.status(200).json({ auctions: result.rows });
  } catch (error) {
    console.error('[internal/ready-auctions]', error);
    return res.status(500).json({
      error: 'Failed to list ready auctions',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  } finally {
    client.release();
  }
}
