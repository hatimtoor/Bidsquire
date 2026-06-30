// pages/api/item-db/save-match.ts
// Handles all match lifecycle writes in one endpoint.
// n8n sends action= to tell us which stage it's writing.
import type { NextApiRequest, NextApiResponse } from 'next';
import { itemDbService } from '@/services/itemDb';

const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.headers['x-internal-secret'] !== INTERNAL_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { action, ...payload } = req.body;

    switch (action) {

      // ── Create a new match record ─────────────────────────────────────────
      case 'create': {
        const match = await itemDbService.createMatch({
          bidsquireItemId: payload.bidsquireItemId,
          bidsquireAdminId: payload.bidsquireAdminId,
          itemDbItemId: payload.itemDbItemId,
          matchType: payload.matchType,
          confidenceScore: payload.confidenceScore,
          matchMethod: payload.matchMethod,
          matchNotes: payload.matchNotes,
          searchQueryUsed: payload.searchQueryUsed,
          searchResultsCount: payload.searchResultsCount,
        });
        return res.status(200).json({ match });
      }

      // ── Save price history ────────────────────────────────────────────────
      case 'save-prices': {
        await itemDbService.savePriceHistory({
          itemDbItemId: payload.itemDbItemId,
          rawSoldPrices: payload.rawSoldPrices,
          rawListedPrices: payload.rawListedPrices,
          trimmedSoldPrices: payload.trimmedSoldPrices,
          trimmedMin: payload.trimmedMin,
          trimmedMax: payload.trimmedMax,
          trimmedMedian: payload.trimmedMedian,
          removedPrices: payload.removedPrices,
          removalReason: payload.removalReason,
          searchQueryUsed: payload.searchQueryUsed,
        });

        if (payload.referenceUrls?.length && payload.itemDbItemId) {
          await itemDbService.saveReferenceUrls(payload.itemDbItemId, payload.referenceUrls);
        }

        return res.status(200).json({ saved: 'prices' });
      }

      // ── Save appraiser result (attempt 1 or 2) ────────────────────────────
      case 'save-appraiser': {
        await itemDbService.saveAppraiserResult(
          payload.matchId,
          payload.attempt || 1,
          {
            estimateMin: payload.estimateMin,
            estimateMax: payload.estimateMax,
            description: payload.description,
            fakeRisk: payload.fakeRisk,
            fakeNotes: payload.fakeNotes,
            rawOutput: payload.rawOutput,
          }
        );
        return res.status(200).json({ saved: 'appraiser', attempt: payload.attempt });
      }

      // ── Save critic result (round 1 or 2) ────────────────────────────────
      case 'save-critic': {
        await itemDbService.saveCriticResult(
          payload.matchId,
          payload.round || 1,
          {
            passed: payload.passed,
            score: payload.score,
            failureReason: payload.failureReason,
            verdict: payload.verdict,
            verdictNotes: payload.verdictNotes,
            rawOutput: payload.rawOutput,
          }
        );
        return res.status(200).json({ 
          saved: 'critic', 
          round: payload.round, 
          passed: payload.passed,
          verdict: payload.verdict
        });
      }

      // ── Finalize and write final values ───────────────────────────────────
      case 'finalize': {
        await itemDbService.finalizeMatch(payload.matchId, {
          estimateMin: payload.estimateMin,
          estimateMax: payload.estimateMax,
          description: payload.description,
          fakeRisk: payload.fakeRisk,
          referenceUrls: payload.referenceUrls || [],
        });
        return res.status(200).json({ saved: 'finalized' });
      }

      // ── Flag for human review ─────────────────────────────────────────────
      case 'human-review': {
        await itemDbService.flagForHumanReview(payload.matchId);
        return res.status(200).json({ saved: 'human-review' });
      }

      // ── Get match by Bidsquire item ID ────────────────────────────────────
      case 'get': {
        const match = await itemDbService.getMatchByBidsquireItemId(payload.bidsquireItemId);
        return res.status(200).json({ match });
      }

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (error) {
    console.error('[item-db/save-match]', error);
    return res.status(500).json({
      error: 'Save match failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
