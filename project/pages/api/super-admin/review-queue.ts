import { NextApiRequest, NextApiResponse } from 'next';
import { databaseService } from '@/services/database';
import { verifyToken } from '@/services/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Auth: must be a logged-in super_admin
  const decoded: any = verifyToken(req);
  if (!decoded) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (decoded.role !== 'super_admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (req.method === 'GET') {
    const stageParam = req.query.stage;
    const stage = stageParam === 'stage2' ? 'stage2' : 'stage1';

    const client = await (databaseService as any).getClient();
    try {
      const result = await client.query(
        `SELECT id, item_name, lot_number, auction_name, status, critic_verdict,
                critic_notes, researcher_estimate, ai_description, description,
                main_image_url, url_main, url, images, notes, final_data, category,
                priority, review_status, review_stage, created_at
         FROM auction_items
         WHERE review_stage = $1 AND review_status = 'pending' AND status != 'processing'
         ORDER BY auction_name ASC, lot_number ASC`,
        [stage]
      );
      return res.status(200).json({ items: result.rows, count: result.rows.length });
    } catch (error) {
      console.error('Error fetching review queue:', error);
      return res.status(500).json({
        error: 'Failed to fetch review queue',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      client.release();
    }
  } else if (req.method === 'POST') {
    const { itemId, action, rejectionReason } = req.body || {};

    if (!itemId || (action !== 'approved' && action !== 'rejected')) {
      return res.status(400).json({
        error: "itemId and action ('approved' | 'rejected') are required",
      });
    }

    const client = await (databaseService as any).getClient();
    try {
      const result = await client.query(
        `UPDATE auction_items
         SET review_status = $1,
             review_rejection_reason = $2,
             reviewed_by = $3,
             reviewed_at = NOW()
         WHERE id = $4
         RETURNING id, review_status, review_rejection_reason, reviewed_by, reviewed_at`,
        [action, action === 'rejected' ? rejectionReason || null : null, decoded.email, itemId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Item not found' });
      }

      return res.status(200).json({ success: true, item: result.rows[0] });
    } catch (error) {
      console.error('Error updating review status:', error);
      return res.status(500).json({
        error: 'Failed to update review status',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      client.release();
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
