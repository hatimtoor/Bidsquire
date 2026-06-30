// services/itemDb.ts
// Server-side only — import only in API routes
import { Pool } from 'pg';

const isBrowser = typeof window !== 'undefined';

const itemDbConfig = {
  connectionString: process.env.ITEM_DB_URL,
  ssl: false,
};

class ItemDbService {
  private pool: Pool | null = null;
  private initializationPromise: Promise<void> | null = null;

  constructor() {
    if (!isBrowser) {
      this.initializationPromise = this.initializeDatabase();
    }
  }

  private async initializeDatabase() {
    try {
      this.pool = new Pool(itemDbConfig);
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      console.log('✅ item_db connected');
    } catch (error) {
      console.error('❌ item_db connection failed:', error);
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initializationPromise) {
      await this.initializationPromise;
    }
  }

  private async query(sql: string, params: any[] = []) {
    await this.ensureInitialized();
    if (!this.pool) throw new Error('item_db pool not initialized');
    return this.pool.query(sql, params);
  }

  // ── Search ──────────────────────────────────────────────────────────────

  async searchByText(searchTerm: string, category?: string, limit = 10) {
    let sql = `
      SELECT
        id, title, category, brand, fake_risk_level,
        is_exact_matchable, last_sold_min, last_sold_max,
        last_sold_median, price_sample_size, times_seen,
        primary_image_url, image_urls, reference_urls,
        similarity(title, $1) AS title_score
      FROM item_db_items
      WHERE title % $1
    `;
    const params: any[] = [searchTerm];

    if (category) {
      params.push(category);
      sql += ` AND category ILIKE $${params.length}`;
    }

    sql += ` ORDER BY title_score DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await this.query(sql, params);
    return result.rows;
  }

  async searchByCategory(category: string, limit = 20) {
    const result = await this.query(
      `SELECT id, title, category, brand, fake_risk_level,
              last_sold_min, last_sold_max, times_seen, primary_image_url
       FROM item_db_items
       WHERE category ILIKE $1
       ORDER BY times_seen DESC
       LIMIT $2`,
      [`%${category}%`, limit]
    );
    return result.rows;
  }

  // ── Upsert item ──────────────────────────────────────────────────────────

  async upsertItem(data: {
    title: string;
    category?: string;
    description?: string;
    brand?: string;
    makersMarks?: string;
    isExactMatchable?: boolean;
    fakeRiskLevel?: 'none' | 'low' | 'medium' | 'high';
    fakeRiskNotes?: string;
  }) {
    // Check if a very similar item already exists
    const existing = await this.searchByText(data.title, data.category, 1);
    if (existing.length > 0 && existing[0].title_score > 0.8) {
      // Update times_seen and last_seen
      await this.query(
        `UPDATE item_db_items
         SET times_seen = times_seen + 1, last_seen_at = NOW()
         WHERE id = $1`,
        [existing[0].id]
      );
      return { ...existing[0], was_existing: true };
    }

    // Insert new item
    const result = await this.query(
      `INSERT INTO item_db_items
         (title, category, description, brand, makers_mark,
          is_exact_matchable, fake_risk_level, fake_risk_notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        data.title,
        data.category || null,
        data.description || null,
        data.brand || null,
        data.makersMarks || null,
        data.isExactMatchable !== false,
        data.fakeRiskLevel || 'none',
        data.fakeRiskNotes || null,
      ]
    );
    return { ...result.rows[0], was_existing: false };
  }

  // ── Images ───────────────────────────────────────────────────────────────

  async saveImage(data: {
    itemDbItemId: string;
    sourceUrl: string;
    sourcePlatform?: string;
    r2Key: string;
    r2Url: string;
    fileSizeBytes?: number;
    mimeType?: string;
    isPrimary?: boolean;
  }) {
    const result = await this.query(
      `INSERT INTO item_db_images
         (item_db_item_id, source_url, source_platform, r2_key, r2_url,
          file_size_bytes, mime_type, is_primary, download_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'ok')
       ON CONFLICT (r2_key) DO NOTHING
       RETURNING *`,
      [
        data.itemDbItemId,
        data.sourceUrl,
        data.sourcePlatform || 'hibid',
        data.r2Key,
        data.r2Url,
        data.fileSizeBytes || null,
        data.mimeType || 'image/jpeg',
        data.isPrimary || false,
      ]
    );

    // Update image_urls array and primary_image_url on the item
    if (data.isPrimary) {
      await this.query(
        `UPDATE item_db_items SET primary_image_url = $1 WHERE id = $2`,
        [data.r2Url, data.itemDbItemId]
      );
    }
    await this.query(
      `UPDATE item_db_items
       SET image_urls = array_append(image_urls, $1)
       WHERE id = $2 AND NOT ($1 = ANY(image_urls))`,
      [data.r2Url, data.itemDbItemId]
    );

    return result.rows[0];
  }

  async logImageFailure(data: {
    itemDbItemId: string;
    sourceUrl: string;
    error: string;
  }) {
    await this.query(
      `INSERT INTO item_db_images
         (item_db_item_id, source_url, r2_key, r2_url, download_status, download_error)
       VALUES ($1,$2,'failed','failed','failed',$3)`,
      [data.itemDbItemId, data.sourceUrl, data.error]
    );
  }

  // ── Price history ─────────────────────────────────────────────────────────

  async savePriceHistory(data: {
    itemDbItemId: string;
    rawSoldPrices: number[];
    rawListedPrices?: number[];
    trimmedSoldPrices: number[];
    trimmedMin: number;
    trimmedMax: number;
    trimmedMedian: number;
    removedPrices?: number[];
    removalReason?: string;
    searchQueryUsed?: string;
    source?: string;
  }) {
    // Save history row
    await this.query(
      `INSERT INTO item_db_price_history
         (item_db_item_id, raw_sold_prices, raw_listed_prices,
          trimmed_sold_prices, trimmed_min, trimmed_max, trimmed_median,
          sample_size, removed_prices, removal_reason, search_query_used, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        data.itemDbItemId,
        data.rawSoldPrices,
        data.rawListedPrices || [],
        data.trimmedSoldPrices,
        data.trimmedMin,
        data.trimmedMax,
        data.trimmedMedian,
        data.trimmedSoldPrices.length,
        data.removedPrices || [],
        data.removalReason || null,
        data.searchQueryUsed || null,
        data.source || 'ebay',
      ]
    );

    // Update the live price fields on the item
    await this.query(
      `UPDATE item_db_items
       SET last_sold_min = $1,
           last_sold_max = $2,
           last_sold_median = $3,
           price_sample_size = $4,
           price_data_updated_at = NOW()
       WHERE id = $5`,
      [
        data.trimmedMin,
        data.trimmedMax,
        data.trimmedMedian,
        data.trimmedSoldPrices.length,
        data.itemDbItemId,
      ]
    );
  }

  // ── Matches ───────────────────────────────────────────────────────────────

  async createMatch(data: {
    bidsquireItemId: string;
    bidsquireAdminId: string;
    itemDbItemId?: string;
    matchType: 'exact' | 'category' | 'none';
    confidenceScore?: number;
    matchMethod?: string;
    matchNotes?: string;
    searchQueryUsed?: string;
    searchResultsCount?: number;
  }) {
    const result = await this.query(
      `INSERT INTO item_db_matches
         (bidsquire_item_id, bidsquire_admin_id, item_db_item_id,
          match_type, confidence_score, match_method, match_notes,
          search_query_used, search_results_count, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'matched')
       RETURNING *`,
      [
        data.bidsquireItemId,
        data.bidsquireAdminId,
        data.itemDbItemId || null,
        data.matchType,
        data.confidenceScore || null,
        data.matchMethod || null,
        data.matchNotes || null,
        data.searchQueryUsed || null,
        data.searchResultsCount || null,
      ]
    );
    return result.rows[0];
  }

  async saveAppraiserResult(matchId: string, attempt: 1 | 2, data: {
    estimateMin: number;
    estimateMax: number;
    description: string;
    fakeRisk?: 'none' | 'low' | 'medium' | 'high';
    fakeNotes?: string;
    rawOutput?: any;
  }) {
    if (attempt === 1) {
      await this.query(
        `UPDATE item_db_matches
         SET appraiser_estimate_min = $1,
             appraiser_estimate_max = $2,
             appraiser_description = $3,
             appraiser_fake_risk = $4,
             appraiser_fake_notes = $5,
             appraiser_raw_output = $6,
             status = 'appraised'
         WHERE id = $7`,
        [
          data.estimateMin, data.estimateMax, data.description,
          data.fakeRisk || 'none', data.fakeNotes || null,
          JSON.stringify(data.rawOutput || {}), matchId,
        ]
      );
    } else {
      await this.query(
        `UPDATE item_db_matches
         SET appraiser_2_estimate_min = $1,
             appraiser_2_estimate_max = $2,
             appraiser_2_description = $3,
             appraiser_2_raw_output = $4
         WHERE id = $5`,
        [
          data.estimateMin, data.estimateMax, data.description,
          JSON.stringify(data.rawOutput || {}), matchId,
        ]
      );
    }
  }

  async saveCriticResult(matchId: string, round: 1 | 2, data: {
    passed: boolean;
    score?: number;
    failureReason?: string;
    verdict?: string;
    verdictNotes?: string;
    rawOutput?: any;
  }) {
    let statusUpdate: string;
    if (data.passed) {
      statusUpdate = 'critic_passed';
    } else if (round === 1) {
      statusUpdate = 'critic_failed_once';
    } else {
      statusUpdate = 'critic_failed_twice';
    }

    if (round === 1) {
      await this.query(
        `UPDATE item_db_matches
         SET critic_1_passed = $1,
             critic_1_score = $2,
             critic_1_failure_reason = $3,
             critic_1_raw_output = $4,
             status = $5,
             critic_verdict = $6,
             critic_verdict_notes = $7
         WHERE id = $8`,
        [
          data.passed, data.score || null, data.failureReason || null,
          JSON.stringify(data.rawOutput || {}), statusUpdate,
          data.verdict || null, data.verdictNotes || null, matchId,
        ]
      );
    } else {
      await this.query(
        `UPDATE item_db_matches
         SET critic_2_passed = $1,
             critic_2_score = $2,
             critic_2_failure_reason = $3,
             critic_2_raw_output = $4,
             status = $5,
             critic_verdict = $6,
             critic_verdict_notes = $7
         WHERE id = $8`,
        [
          data.passed, data.score || null, data.failureReason || null,
          JSON.stringify(data.rawOutput || {}), statusUpdate,
          data.verdict || null, data.verdictNotes || null, matchId,
        ]
      );
    }
  }

  async finalizeMatch(matchId: string, data: {
    estimateMin: number;
    estimateMax: number;
    description: string;
    fakeRisk: string;
    referenceUrls: string[];
  }) {
    await this.query(
      `UPDATE item_db_matches
       SET final_estimate_min = $1,
           final_estimate_max = $2,
           final_description = $3,
           final_fake_risk = $4,
           final_reference_urls = $5,
           status = 'critic_passed'
       WHERE id = $6`,
      [
        data.estimateMin, data.estimateMax, data.description,
        data.fakeRisk, data.referenceUrls, matchId,
      ]
    );
  }

  async flagForHumanReview(matchId: string) {
    await this.query(
      `UPDATE item_db_matches SET status = 'human_review' WHERE id = $1`,
      [matchId]
    );
  }

  async getMatchByBidsquireItemId(bidsquireItemId: string) {
    const result = await this.query(
      `SELECT m.*, i.title AS item_db_title, i.category,
              i.last_sold_min, i.last_sold_max, i.fake_risk_level,
              i.image_urls AS item_image_urls
       FROM item_db_matches m
       LEFT JOIN item_db_items i ON i.id = m.item_db_item_id
       WHERE m.bidsquire_item_id = $1
       ORDER BY m.created_at DESC
       LIMIT 1`,
      [bidsquireItemId]
    );
    return result.rows[0] || null;
  }

  // ── Reference URLs ────────────────────────────────────────────────────────

  async saveReferenceUrls(itemDbItemId: string, urls: Array<{
    url: string;
    platform?: string;
    title?: string;
    soldPrice?: number;
    condition?: string;
    soldAt?: string;
  }>) {
    for (const u of urls.slice(0, 6)) {
      await this.query(
        `INSERT INTO item_db_reference_urls
           (item_db_item_id, url, platform, title, sold_price, condition, sold_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT DO NOTHING`,
        [
          itemDbItemId, u.url, u.platform || 'ebay',
          u.title || null, u.soldPrice || null,
          u.condition || null, u.soldAt || null,
        ]
      );
    }
    // Denormalise to array on item for fast reads
    const urlStrings = urls.slice(0, 6).map(u => u.url);
    await this.query(
      `UPDATE item_db_items SET reference_urls = $1 WHERE id = $2`,
      [urlStrings, itemDbItemId]
    );
  }

  async getImages(itemDbItemId: string) {
    const result = await this.query(
      `SELECT r2_url, r2_key, is_primary, source_url
       FROM item_db_images
       WHERE item_db_item_id = $1
       AND download_status = 'ok'
       ORDER BY is_primary DESC, downloaded_at ASC
       LIMIT 4`,
      [itemDbItemId]
    );
    return result.rows;
  }

  async checkForgeryRisk(title: string, category: string) {
    const titleLower = title.toLowerCase();
    const categoryLower = category.toLowerCase();

    const result = await this.query(
      `SELECT * FROM forgery_risk
       WHERE (item_category ILIKE $1 OR item_category IS NULL)
       OR EXISTS (
         SELECT 1 FROM unnest(item_keywords) AS kw
         WHERE $2 ILIKE '%' || kw || '%'
       )
       ORDER BY
         CASE forgery_risk_level
           WHEN 'high' THEN 1
           WHEN 'medium' THEN 2
           WHEN 'low' THEN 3
           ELSE 4
         END
       LIMIT 1`,
      [categoryLower, titleLower]
    );

    if (result.rows.length === 0) {
      return {
        forgery_risk_level: 'none',
        notes: null,
        authentic_value_notes: null,
        replica_value_notes: null
      };
    }

    return result.rows[0];
  }
}

export const itemDbService = new ItemDbService();
