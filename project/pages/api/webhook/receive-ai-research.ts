import { NextApiRequest, NextApiResponse } from 'next';
import { databaseService } from '@/services/database';

const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET || '';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  // Verify internal secret (n8n sends this header)
  if (INTERNAL_SECRET) {
    const incoming = req.headers['x-internal-secret'];
    if (incoming !== INTERNAL_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const { itemId, research, success } = req.body;

  if (!itemId || !research) {
    return res.status(400).json({ error: 'itemId and research are required' });
  }

  try {
    if (success && research) {
      await databaseService.updateAuctionItem(itemId, {
        researcherEstimate: research.researcherEstimate,
        researcherDescription: research.researcherDescription,
        priority: research.priority,
        notes: research.notes,
        referenceUrls: research.referenceUrls || [],
      } as any);
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Error applying AI research callback:', error);
    return res.status(500).json({ error: 'Failed to apply research data' });
  }
}
