// eBay OAuth 2.0 and Inventory/Offer API utilities

const EBAY_CLIENT_ID = process.env.EBAY_CLIENT_ID || '';
const EBAY_CLIENT_SECRET = process.env.EBAY_CLIENT_SECRET || '';
const EBAY_RUNAME = process.env.EBAY_RUNAME || '';
const EBAY_AUTH_URL = 'https://auth.ebay.com/oauth2/authorize';
const EBAY_TOKEN_URL = 'https://api.ebay.com/identity/v1/oauth2/token';
const EBAY_API_BASE = 'https://api.ebay.com';

// Scopes needed: sell.inventory to create draft listings
export const EBAY_SCOPE = 'https://api.ebay.com/oauth/api_scope/sell.inventory';

export function getEbayAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: EBAY_CLIENT_ID,
    redirect_uri: EBAY_RUNAME,
    response_type: 'code',
    scope: EBAY_SCOPE,
    state,
  });
  return `${EBAY_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const credentials = Buffer.from(`${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`).toString('base64');
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: EBAY_RUNAME,
  });

  const response = await fetch(EBAY_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`eBay token exchange failed: ${err}`);
  }

  return response.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const credentials = Buffer.from(`${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`).toString('base64');
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    scope: EBAY_SCOPE,
  });

  const response = await fetch(EBAY_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`eBay token refresh failed: ${err}`);
  }

  return response.json();
}

// Condition string → eBay condition ID
const CONDITION_ID_MAP: Record<string, string> = {
  'New': '1000',
  'Used': '3000',
  'For parts or not working': '7000',
};

// Parse a price string like "$50 - $80" or "$65" → number (lower bound)
export function parsePrice(priceStr: string): number {
  if (!priceStr) return 9.99;
  const nums = priceStr
    .replace(/[^0-9.]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(Number)
    .filter(n => n > 0);
  if (nums.length === 0) return 9.99;
  return Math.min(...nums);
}

export interface EbayDraftInput {
  sku: string;
  title: string;
  description: string;
  condition: string;
  listingType: 'auction' | 'fixed';
  price: number;         // fixed price OR auction starting price
  categoryId?: string;
  images?: string[];
}

export interface EbayDraftResult {
  offerId: string;
  sellerHubUrl: string;
}

export async function createEbayDraftListing(
  accessToken: string,
  input: EbayDraftInput
): Promise<EbayDraftResult> {
  const conditionId = CONDITION_ID_MAP[input.condition] || '3000';
  const sku = input.sku || `bidsquire-${Date.now()}`;

  // Step 1: Create/update inventory item
  const inventoryPayload: any = {
    availability: {
      shipToLocationAvailability: { quantity: 1 },
    },
    condition: conditionId,
    product: {
      title: input.title.slice(0, 80),
      description: input.description || input.title,
      imageUrls: (input.images || []).filter(Boolean).slice(0, 12),
    },
  };

  const inventoryRes = await fetch(
    `${EBAY_API_BASE}/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Language': 'en-US',
      },
      body: JSON.stringify(inventoryPayload),
    }
  );

  // 204 = created successfully (no body), 200 = updated
  if (!inventoryRes.ok && inventoryRes.status !== 204) {
    const err = await inventoryRes.text();
    throw new Error(`Failed to create eBay inventory item (${inventoryRes.status}): ${err}`);
  }

  // Step 2: Create offer (stays as draft until publishOffer is called)
  const priceStr = String(input.price.toFixed(2));
  const offerPayload: any = {
    sku,
    marketplaceId: 'EBAY_US',
    format: input.listingType === 'auction' ? 'AUCTION' : 'FIXED_PRICE',
    listingDescription: input.description || input.title,
    pricingSummary:
      input.listingType === 'auction'
        ? { auctionStartPrice: { value: priceStr, currency: 'USD' } }
        : { price: { value: priceStr, currency: 'USD' } },
    ...(input.categoryId ? { categoryId: input.categoryId } : {}),
  };

  const offerRes = await fetch(`${EBAY_API_BASE}/sell/inventory/v1/offer`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Content-Language': 'en-US',
    },
    body: JSON.stringify(offerPayload),
  });

  if (!offerRes.ok) {
    const err = await offerRes.text();
    throw new Error(`Failed to create eBay offer (${offerRes.status}): ${err}`);
  }

  const offerData = await offerRes.json();

  return {
    offerId: offerData.offerId,
    sellerHubUrl: 'https://www.ebay.com/sell/inventory',
  };
}

export async function publishOffer(
  accessToken: string,
  offerId: string
): Promise<{ listingId: string; ebayListingUrl: string }> {
  const res = await fetch(
    `${EBAY_API_BASE}/sell/inventory/v1/offer/${encodeURIComponent(offerId)}/publish`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Language': 'en-US',
      },
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to publish eBay offer (${res.status}): ${err}`);
  }

  const data = await res.json();
  return {
    listingId: data.listingId,
    ebayListingUrl: `https://www.ebay.com/itm/${data.listingId}`,
  };
}
