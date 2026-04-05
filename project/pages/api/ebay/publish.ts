import { NextApiRequest, NextApiResponse } from 'next';
import { verifyToken } from '@/services/auth';
import { databaseService } from '@/services/database';
import { refreshAccessToken, publishOffer } from '@/services/ebay';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end();
  }

  const decoded: any = verifyToken(req);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

  const { offerId, itemId } = req.body;
  if (!offerId || !itemId) {
    return res.status(400).json({ error: 'offerId and itemId are required' });
  }

  try {
    // 1. Get eBay tokens
    const tokens = await databaseService.getEbayTokens(decoded.id);
    if (!tokens?.refreshToken) {
      return res.status(401).json({
        error: 'EBAY_NOT_CONNECTED',
        message: 'Connect your eBay account in Profile settings first.',
      });
    }

    // 2. Refresh token if needed
    let accessToken = tokens.accessToken;
    const isExpired = !tokens.expiresAt || new Date(tokens.expiresAt) <= new Date(Date.now() + 60_000);
    if (isExpired) {
      const refreshed = await refreshAccessToken(tokens.refreshToken);
      accessToken = refreshed.access_token;
      await databaseService.saveEbayTokens(decoded.id, {
        accessToken: refreshed.access_token,
        refreshToken: tokens.refreshToken,
        expiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
      });
    }

    // 3. Publish the offer (goes live on eBay)
    const result = await publishOffer(accessToken, offerId);

    // 4. Save listing ID on the item
    const item = await databaseService.getAuctionItem(itemId);
    await databaseService.updateAuctionItem(itemId, {
      finalData: {
        ...(item?.finalData || {}),
        ebayListingId: result.listingId,
        ebayListingUrl: result.ebayListingUrl,
        ebayPublishedAt: new Date().toISOString(),
        ebayPublishedBy: decoded.email,
        status: 'published',
      },
    } as any);

    return res.status(200).json({
      success: true,
      listingId: result.listingId,
      ebayListingUrl: result.ebayListingUrl,
    });
  } catch (err: any) {
    console.error('eBay publish error:', err);
    if (err.message?.includes('invalid_grant') || err.message?.includes('token')) {
      return res.status(401).json({
        error: 'EBAY_TOKEN_EXPIRED',
        message: 'Your eBay session has expired. Please reconnect in Profile settings.',
      });
    }
    return res.status(500).json({ error: err.message || 'Failed to publish eBay listing' });
  }
}
