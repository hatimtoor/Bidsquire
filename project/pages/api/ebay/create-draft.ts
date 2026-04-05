import { NextApiRequest, NextApiResponse } from 'next';
import { verifyToken } from '@/services/auth';
import { databaseService } from '@/services/database';
import { refreshAccessToken, createEbayDraftListing, parsePrice } from '@/services/ebay';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end();
  }

  const decoded: any = verifyToken(req);
  if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

  const { itemId, title, description, condition, listingType, startingPrice, fixedPrice, categoryId } =
    req.body;

  if (!itemId || !title) {
    return res.status(400).json({ error: 'itemId and title are required' });
  }

  try {
    // 1. Get eBay tokens for this user
    const tokens = await databaseService.getEbayTokens(decoded.id);
    if (!tokens?.refreshToken) {
      return res.status(401).json({
        error: 'EBAY_NOT_CONNECTED',
        message: 'Connect your eBay account in Profile settings first.',
      });
    }

    // 2. Get a fresh access token (refresh if expired or near expiry)
    let accessToken = tokens.accessToken;
    const isExpired = !tokens.expiresAt || new Date(tokens.expiresAt) <= new Date(Date.now() + 60_000);
    if (isExpired) {
      const refreshed = await refreshAccessToken(tokens.refreshToken);
      accessToken = refreshed.access_token;
      // Save refreshed token
      await databaseService.saveEbayTokens(decoded.id, {
        accessToken: refreshed.access_token,
        refreshToken: tokens.refreshToken, // refresh token stays the same
        expiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
      });
    }

    // 3. Load item for SKU and images
    const item = await databaseService.getAuctionItem(itemId);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    // 4. Parse price from form input (handles "$50", "50", "50.00")
    const priceStr = listingType === 'auction' ? startingPrice : fixedPrice;
    const price = parsePrice(priceStr || item.researcherEstimate || '9.99');

    // 5. Create the draft listing
    const images = (item.photographerImages?.length
      ? item.photographerImages
      : item.images || []) as string[];

    const result = await createEbayDraftListing(accessToken, {
      sku: item.sku || `bidsquire-${itemId}`,
      title: title.slice(0, 80),
      description,
      condition,
      listingType,
      price,
      categoryId: categoryId || undefined,
      images,
    });

    // 6. Save offerId on the item so we can link back to it
    await databaseService.updateAuctionItem(itemId, {
      finalData: {
        ...(item.finalData || {}),
        ebayOfferId: result.offerId,
        ebayDraftCreatedAt: new Date().toISOString(),
        ebayDraftCreatedBy: decoded.email,
      },
    } as any);

    return res.status(200).json({
      success: true,
      offerId: result.offerId,
      sellerHubUrl: result.sellerHubUrl,
    });
  } catch (err: any) {
    console.error('eBay create-draft error:', err);
    // If the refresh token is expired/revoked, tell the user to reconnect
    if (err.message?.includes('invalid_grant') || err.message?.includes('token')) {
      return res.status(401).json({
        error: 'EBAY_TOKEN_EXPIRED',
        message: 'Your eBay session has expired. Please reconnect your account in Profile settings.',
      });
    }
    return res.status(500).json({ error: err.message || 'Failed to create eBay draft listing' });
  }
}
