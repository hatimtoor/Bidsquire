
/**
 * Utility to validate URLs against allowed patterns.
 * Patterns are comma-separated in the environment variable NEXT_PUBLIC_ALLOWED_URL_PATTERNS.
 * Default pattern: https://hibid.com/lot/
 */
export const ALLOWED_PATTERNS = process.env.NEXT_PUBLIC_ALLOWED_URL_PATTERNS
  ? process.env.NEXT_PUBLIC_ALLOWED_URL_PATTERNS.split(',').map(p => p.trim())
  : ['https://hibid.com/lot/'];

export const validateUrl = (url: string): { isValid: boolean; error?: string } => {
  if (!url) {
    return { isValid: false, error: 'URL is required' };
  }

  // Check if URL matches any of the allowed patterns
  // Also accept state-based HiBid URLs like https://hibid.com/pennsylvania/lot/...
  const isHibidLot = /^https:\/\/hibid\.com\/(?:[a-z-]+\/)?lot\//.test(url);
  const isMatch = isHibidLot || ALLOWED_PATTERNS.some(pattern => url.startsWith(pattern));

  if (!isMatch) {
    return {
      isValid: false,
      error: `URL must start with one of the following: ${ALLOWED_PATTERNS.join(', ')}`
    };
  }

  return { isValid: true };
};

/**
 * Normalizes a URL by removing protocol, www, and trailing slashes.
 * Keeps query parameters unless removeQuery is true.
 * @param url The URL to normalize
 * @param removeQuery Whether to strip query parameters (default: true)
 */
export const normalizeUrl = (url: string, removeQuery: boolean = true): string => {
  try {
    const parsed = new URL(url);
    // Remove www. from hostname
    const host = parsed.hostname.replace(/^www\./, '');
    // Remove trailing slash from pathname
    const path = parsed.pathname.replace(/\/$/, '');

    // Construct base result
    let result = `${host}${path}`;

    // Add query params if not removed and they exist
    if (!removeQuery && parsed.search) {
      result += parsed.search;
    }

    return result.toLowerCase();
  } catch (e) {
    return url.toLowerCase(); // Fallback
  }
};
