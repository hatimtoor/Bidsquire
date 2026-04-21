// This file is server-side only and should not be imported on the client side
// It will be used only in API routes and server-side functions

import { Pool, PoolClient } from 'pg';
import { AuctionItem, UserAccount, WorkflowStep, Notification } from '@/types/auction';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

const dbConfig = {
  host: process.env.DB_HOST || process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || process.env.POSTGRES_PORT || '5435'),
  database: process.env.DB_NAME || process.env.POSTGRES_DB || 'auctionflow',
  user: process.env.DB_USER || process.env.POSTGRES_USER || 'auctionuser',
  password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'auctionpass',
  ssl: process.env.DB_SSL === 'true',
};

class DatabaseService {
  private pool: Pool | null = null;
  private isConnected = false;
  private initializationPromise: Promise<void> | null = null;

  constructor() {
    // Only initialize on server side
    if (!isBrowser) {
      this.initializationPromise = this.initializeDatabase();
    }
  }

  // Ensure database is initialized before any operation
  private async ensureInitialized(): Promise<void> {
    if (this.initializationPromise) {
      await this.initializationPromise;
    }
  }

  private async initializeDatabase() {
    try {
      console.log('🔌 Initializing database connection with config:', {
        host: dbConfig.host,
        port: dbConfig.port,
        database: dbConfig.database,
        user: dbConfig.user,
        ssl: dbConfig.ssl
      });

      // Create connection pool
      this.pool = new Pool(dbConfig);

      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');



      client.release();

      this.isConnected = true;
      console.log('✅ Database connected successfully');

      // Initialize tables
      await this.createTables();
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      console.error('❌ Database config:', dbConfig);
      this.isConnected = false;
    }
  }

  private async createTables() {
    if (!this.pool) return;

    try {
      const client = await this.pool.connect();

      // Create users table (matching initialization script)
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          role VARCHAR(50) NOT NULL DEFAULT 'user',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          is_active BOOLEAN DEFAULT TRUE,
        is_trial BOOLEAN DEFAULT FALSE,
          created_by VARCHAR(255)
        )
      `);

      // ... rest of constraints if any ...

      // Create auction_items table
      await client.query(`
        CREATE TABLE IF NOT EXISTS auction_items (
          id VARCHAR(255) PRIMARY KEY,
          url TEXT,
          url_main TEXT,
          auction_name VARCHAR(255),
          lot_number VARCHAR(100),
          images TEXT[],
          main_image_url TEXT,
          sku VARCHAR(100),
          item_name VARCHAR(255),
          category VARCHAR(100),
          description TEXT,
          lead TEXT,
          auction_site_estimate VARCHAR(100),
          ai_description TEXT,
          ai_estimate VARCHAR(100),
          status VARCHAR(50) NOT NULL,
          researcher_estimate VARCHAR(100),
          researcher_description TEXT,
          reference_urls TEXT[],
          similar_urls TEXT[],
          photographer_quantity INTEGER,
          photographer_images TEXT[],
          is_multiple_items BOOLEAN DEFAULT FALSE,
          multiple_items_count INTEGER DEFAULT 1,
          final_data JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          assigned_to VARCHAR(255),
          notes TEXT,
          photographer_notes TEXT,
          researcher_notes TEXT,
          researcher2_notes TEXT,
          priority VARCHAR(20) DEFAULT 'medium',
          tags TEXT[],
          parent_item_id VARCHAR(255),
          sub_item_number INTEGER,
          admin_id VARCHAR(255),
          FOREIGN KEY (parent_item_id) REFERENCES auction_items(id) ON DELETE CASCADE,
          FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL
        )
      `);

      // Create workflow_steps table
      await client.query(`
        CREATE TABLE IF NOT EXISTS workflow_steps (
          id VARCHAR(255) PRIMARY KEY,
          item_id VARCHAR(255) NOT NULL,
          from_status VARCHAR(50) NOT NULL,
          to_status VARCHAR(50) NOT NULL,
          user_id VARCHAR(255) NOT NULL,
          user_name VARCHAR(255) NOT NULL,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          notes TEXT,
          data JSONB,
          FOREIGN KEY (item_id) REFERENCES auction_items(id) ON DELETE CASCADE
        )
      `);

      // Create notifications table
      await client.query(`
        CREATE TABLE IF NOT EXISTS notifications (
          id VARCHAR(255) PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          type VARCHAR(50) NOT NULL,
          title VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          read BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          item_id VARCHAR(255),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (item_id) REFERENCES auction_items(id) ON DELETE CASCADE
        )
      `);

      // Create webhook_data table
      await client.query(`
        CREATE TABLE IF NOT EXISTS webhook_data (
          id VARCHAR(255) PRIMARY KEY,
          url_main TEXT NOT NULL,
          item_name VARCHAR(255),
          lot_number VARCHAR(100),
          description TEXT,
          lead TEXT,
          category VARCHAR(100),
          estimate VARCHAR(100),
          auction_name VARCHAR(255),
          all_unique_image_urls TEXT[],
          main_image_url TEXT,
          gallery_image_urls TEXT[],
          broad_search_images TEXT[],
          tumbnail_images TEXT[],
          ai_response TEXT,
          received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          status VARCHAR(50) DEFAULT 'processed'
        )
      `);

      // Create user_credits table
      await client.query(`
        CREATE TABLE IF NOT EXISTS user_credits (
          id VARCHAR(255) PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          current_credits INTEGER DEFAULT 60,
          total_purchased INTEGER DEFAULT 60,
          last_topup_date TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

      // Create credit_batches table
      await client.query(`
        CREATE TABLE IF NOT EXISTS credit_batches (
          id VARCHAR(255) PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          amount INTEGER NOT NULL,
          remaining_amount INTEGER NOT NULL,
          expires_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

      // Create credit_transactions table
      await client.query(`
        CREATE TABLE IF NOT EXISTS credit_transactions (
          id VARCHAR(255) PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          transaction_type VARCHAR(50) NOT NULL,
          amount INTEGER NOT NULL,
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

      // Create indexes for credit batches

      await client.query(`
          CREATE INDEX IF NOT EXISTS idx_credit_batches_user_id ON credit_batches(user_id)
      `);
      await client.query(`
          CREATE INDEX IF NOT EXISTS idx_credit_batches_expires_at ON credit_batches(expires_at)
      `);

      // Create password_reset_tokens table
      await client.query(`
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
          id VARCHAR(255) PRIMARY KEY,
          user_email VARCHAR(255) NOT NULL,
          token VARCHAR(255) NOT NULL,
          expires BIGINT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create credit_settings table
      await client.query(`
        CREATE TABLE IF NOT EXISTS credit_settings (
          id VARCHAR(255) PRIMARY KEY,
          setting_name VARCHAR(100) UNIQUE NOT NULL,
          setting_value INTEGER NOT NULL,
          description TEXT,
          updated_by VARCHAR(255),
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
        )
      `);

      // Add created_by field to users table
      await client.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by VARCHAR(255)
      `);
      await client.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS is_trial BOOLEAN DEFAULT FALSE
      `);

      // Multi-tenancy: organizations table
      await client.query(`
        CREATE TABLE IF NOT EXISTS organizations (
          id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
          name VARCHAR(255) NOT NULL,
          slug VARCHAR(100) UNIQUE NOT NULL,
          plan VARCHAR(50) NOT NULL DEFAULT 'trial',
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await client.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS org_id VARCHAR(255)
      `);
      await client.query(`
        ALTER TABLE auction_items ADD COLUMN IF NOT EXISTS org_id VARCHAR(255)
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_users_org_id ON users(org_id)
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_auction_items_org_id ON auction_items(org_id)
      `);

      // eBay OAuth token columns
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ebay_access_token  TEXT`);
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ebay_refresh_token TEXT`);
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ebay_token_expiry  TIMESTAMP WITH TIME ZONE`);
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ebay_user_id       VARCHAR(255)`);


      // Create password_reset_tokens table
      await client.query(`
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
          id VARCHAR(255) PRIMARY KEY,
          user_email VARCHAR(255) NOT NULL,
          token VARCHAR(255) NOT NULL,
          expires BIGINT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create indexes for new tables
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_user_credits_user_id ON user_credits(user_id)
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id)
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON credit_transactions(transaction_type)
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_credit_settings_name ON credit_settings(setting_name)
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_users_created_by ON users(created_by)
      `);

      client.release();
      console.log('✅ Database tables created successfully');
    } catch (error) {
      console.error('❌ Error creating tables:', error);
    }
  }

  // Check if database is connected
  isDatabaseConnected(): boolean {
    if (isBrowser) return false;
    return this.isConnected;
  }

  // Get database connection
  async getClient(): Promise<PoolClient> {
    if (isBrowser) {
      throw new Error('Database service not available on client side');
    }
    if (!this.pool) {
      throw new Error('Database not initialized');
    }
    return await this.pool.connect();
  }

  // Users operations
  async createUser(user: Omit<UserAccount, 'id' | 'createdAt' | 'updatedAt'>, createdBy?: string): Promise<UserAccount> {
    if (isBrowser) {
      throw new Error('Database service not available on client side');
    }

    // Ensure database is initialized
    await this.ensureInitialized();

    if (!this.isConnected) {
      throw new Error('Database not connected');
    }

    const client = await this.getClient();
    try {
      const id = crypto.randomUUID();
      const now = new Date();

      console.log('👤 Creating user:', { name: user.name, email: user.email, role: user.role, createdBy });

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(user.password, salt);

      const result = await client.query(`
        INSERT INTO users (id, name, email, password, role, created_at, updated_at, is_active, created_by, is_trial, org_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `, [id, user.name, user.email, passwordHash, user.role, now, now, user.isActive, createdBy, user.isTrial || false, user.orgId || null]);

      console.log('✅ User created successfully:', result.rows[0]);
      return this.mapUserFromDb(result.rows[0]);
    } catch (error) {
      console.error('❌ Error creating user:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async createUserWithCredits(user: Omit<UserAccount, 'id' | 'createdAt' | 'updatedAt'>, createdBy: string): Promise<UserAccount> {
    const newUser = await this.createUser(user, createdBy);

    // Create initial credits for the new user
    await this.createUserCredits(newUser.id);

    return newUser;
  }

  async getAllUsers(): Promise<UserAccount[]> {
    if (isBrowser) {
      throw new Error('Database service not available on client side');
    }

    // Ensure database is initialized
    await this.ensureInitialized();

    const client = await this.getClient();
    try {
      const result = await client.query('SELECT * FROM users ORDER BY created_at DESC');
      return result.rows.map(row => this.mapUserFromDb(row));
    } finally {
      client.release();
    }
  }

  async getUsersByRole(role: string): Promise<UserAccount[]> {
    if (isBrowser) {
      throw new Error('Database service not available on client side');
    }

    // Ensure database is initialized
    await this.ensureInitialized();

    const client = await this.getClient();
    try {
      const result = await client.query('SELECT * FROM users WHERE role = $1 ORDER BY created_at DESC', [role]);
      return result.rows.map(row => this.mapUserFromDb(row));
    } finally {
      client.release();
    }
  }

  async getTeamMembersByAdmin(adminId: string): Promise<UserAccount[]> {
    if (isBrowser) {
      throw new Error('Database service not available on client side');
    }

    this.ensureInitialized();
    const client = await this.getClient();
    try {
      const result = await client.query(`
        SELECT * FROM users
        WHERE role IN ('researcher', 'researcher2', 'photographer')
        AND created_by = $1
        ORDER BY created_at DESC
      `, [adminId]);
      return result.rows.map(row => this.mapUserFromDb(row));
    } finally {
      client.release();
    }
  }

  async getPhotographersByAdmin(adminId: string): Promise<UserAccount[]> {
    if (isBrowser) {
      throw new Error('Database service not available on client side');
    }

    this.ensureInitialized();
    const client = await this.getClient();
    try {
      const result = await client.query(`
        SELECT * FROM users
        WHERE role = 'photographer'
        AND created_by = $1
        ORDER BY created_at DESC
      `, [adminId]);
      return result.rows.map(row => this.mapUserFromDb(row));
    } finally {
      client.release();
    }
  }

  async getUserById(id: string): Promise<UserAccount | null> {
    if (isBrowser) {
      throw new Error('Database service not available on client side');
    }

    const client = await this.getClient();
    try {
      const result = await client.query('SELECT * FROM users WHERE id = $1', [id]);
      return result.rows.length > 0 ? this.mapUserFromDb(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  async getUserByEmail(email: string): Promise<UserAccount | null> {
    if (isBrowser) {
      throw new Error('Database service not available on client side');
    }

    const client = await this.getClient();
    try {
      // Use LOWER() for case-insensitive email comparison
      const result = await client.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email]);
      return result.rows.length > 0 ? this.mapUserFromDb(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  async deleteUser(id: string): Promise<boolean> {
    if (isBrowser) {
      throw new Error('Database service not available on client side');
    }

    const client = await this.getClient();
    try {
      const result = await client.query('DELETE FROM users WHERE id = $1', [id]);
      return (result.rowCount ?? 0) > 0;
    } finally {
      client.release();
    }
  }

  async updateUser(id: string, updates: Partial<UserAccount>): Promise<UserAccount | null> {
    if (isBrowser) {
      throw new Error('Database service not available on client side');
    }

    const client = await this.getClient();
    try {
      // Create a copy to manipulate
      const dbUpdates: any = { ...updates };
      delete dbUpdates.id; // ensure ID is not updated
      // The previous code filtered 'role'. I will allow 'role' update as per instruction.

      // Handle password hashing
      if (updates.password) {
          const salt = await bcrypt.genSalt(10);
          const hash = await bcrypt.hash(updates.password, salt);
          dbUpdates.password = hash;
          // dbUpdates.password is now the hash, do NOT delete it.
      }

      // Filter keys that are safe to update (or mapped)
      const validKeys = Object.keys(dbUpdates).filter(key => key !== 'id');
      // If we want to allow role, we keep it. If we want to restrict, we filter.
      // Given I am fixing "Secure Password Storage", I should be careful about changing other logic.
      // But consistent activation requires role update. I'll allow it.

      if (validKeys.length === 0) return this.getUserById(id);

      // Build query
      // Map keys to snake_case column names
      const setClause = validKeys.map((key, index) => {
          const colName = this.camelToSnake(key);
          return `${colName} = $${index + 2}`;
      }).join(', ');

      const values = validKeys.map(key => dbUpdates[key]);

      const query = `
        UPDATE users
        SET ${setClause}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `;

      const result = await client.query(query, [id, ...values]);
      return result.rows.length > 0 ? this.mapUserFromDb(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  async changePassword(id: string, currentPassword: string, newPassword: string): Promise<boolean> {
    if (isBrowser) {
      throw new Error('Database service not available on client side');
    }

    const client = await this.getClient();
    try {
        // First verify current password
        const userResult = await client.query('SELECT password FROM users WHERE id = $1', [id]);
        console.log('User query result rows:', userResult.rows.length);
        if (userResult.rows.length === 0) {
          console.log('User not found with ID:', id);
          return false;
        }

        const storedHash = userResult.rows[0].password;
        console.log('Stored password hash (first 20 chars):', storedHash ? storedHash.substring(0, 20) : 'NULL');
        console.log('Is bcrypt hash:', storedHash ? storedHash.startsWith('$2') : false);
        if (!storedHash) {
          console.log('No password hash stored');
          return false;
        }

        const isMatch = await bcrypt.compare(currentPassword, storedHash);
        console.log('Password match result:', isMatch);
        if (!isMatch) return false;

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const newHash = await bcrypt.hash(newPassword, salt);

      const result = await client.query(
        'UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [newHash, id]
      );
      return (result.rowCount ?? 0) > 0;
    } finally {
      client.release();
    }
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
      return await bcrypt.compare(password, hash);
  }

  async hasUsedTrial(userId: string): Promise<boolean> {
    if (isBrowser) {
      throw new Error('Database service not available on client side');
    }

    const client = await this.getClient();
    try {
      // Check for transactions clearly marked as trial/provisioning
      // We look for 'Provisioned via Activation' or potentially 'TRIAL_PROVISION' if we standardize on that type
      const result = await client.query(`
        SELECT COUNT(*) as count
        FROM credit_transactions
        WHERE user_id = $1
        AND (
            description ILIKE '%Provisioned via Activation%'
            OR description ILIKE '%Trial%'
            OR transaction_type = 'TRIAL_PROVISION'
        )
      `, [userId]);

      const count = parseInt(result.rows[0].count, 10);
      return count > 0;
    } finally {
      client.release();
    }
  }

  // Auction items operations

  // Find item by URL (for duplicate detection)
  async findItemByUrl(url: string, adminId?: string): Promise<AuctionItem | null> {
    if (isBrowser) {
      throw new Error('Database service not available on client side');
    }

    await this.ensureInitialized();
    const client = await this.getClient();
    try {
      let query = 'SELECT * FROM auction_items WHERE (url = $1 OR url_main = $1)';
      const params: any[] = [url];

      if (adminId) {
        query += ' AND admin_id = $2';
        params.push(adminId);
      } else {
        // If no adminId provided, maybe we want global check?
        // For now, let's keep it global if no admin specified, or handle nulls?
        // Existing behavior was global.
      }

      query += ' LIMIT 1';

      const result = await client.query(query, params);
      return result.rows.length > 0 ? this.mapAuctionItemFromDb(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  // Find processing item by Fuzzy URL (ignores protocol, query params)
  async findProcessingItemByFuzzyUrl(url: string, adminId: string): Promise<AuctionItem | null> {
    if (isBrowser) {
      throw new Error('Database service not available on client side');
    }

    // Helper to normalize URL for comparison (extracts host+path)
    const normalize = (u: string) => {
      try {
        const parsed = new URL(u);
        // Remove www. from hostname
        const host = parsed.hostname.replace(/^www\./, '');
        // Remove trailing slash from pathname
        const path = parsed.pathname.replace(/\/$/, '');
        return `${host}${path}`.toLowerCase();
      } catch (e) {
        return u.toLowerCase(); // Fallback for invalid URLs
      }
    };

    const targetNormalized = normalize(url);
    console.log(`[DB] Fuzzy Search - Target: ${url} -> Normalized: ${targetNormalized}`);

    await this.ensureInitialized();
    const client = await this.getClient();
    try {
      // Fetch all 'processing' items for this admin
      // Since 'processing' items are transient, there shouldn't be many
      const result = await client.query(
        "SELECT * FROM auction_items WHERE status = 'processing' AND admin_id = $1",
        [adminId]
      );

      // Perform in-memory fuzzy match
      const match = result.rows.find(row => {
        const rowUrl = row.url_main || row.url;
        if (!rowUrl) return false;
        const rowNormalized = normalize(rowUrl);
        const isMatch = rowNormalized === targetNormalized;
        if (isMatch) console.log(`[DB] Match Found! ID: ${row.id} - RowUrl: ${rowUrl} -> Normalized: ${rowNormalized}`);
        return isMatch;
      });

      return match ? this.mapAuctionItemFromDb(match) : null;
    } finally {
      client.release();
    }
  }

  // Create item with provided ID (for placeholder creation)
  async createItem(item: Partial<AuctionItem> & { id: string }): Promise<AuctionItem> {
    if (isBrowser) {
      throw new Error('Database service not available on client side');
    }

    await this.ensureInitialized();
    const client = await this.getClient();
    try {
      const now = new Date();
      const result = await client.query(`
        INSERT INTO auction_items (
          id, url, url_main, auction_name, lot_number, images, main_image_url, sku, item_name, category, description,
          lead, auction_site_estimate, ai_description, ai_estimate, status, researcher_estimate,
          researcher_description, reference_urls, similar_urls, photographer_quantity, photographer_images,
          is_multiple_items, multiple_items_count, final_data, created_at, updated_at, assigned_to, notes, priority, tags,
          parent_item_id, sub_item_number, photographer_notes, researcher_notes, researcher2_notes, admin_id
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37
        ) RETURNING *
      `, [
        item.id || crypto.randomUUID(),
        item.url || null,
        item.url_main || null,
        item.auctionName || null,
        item.lotNumber || null,
        item.images || [],
        item.mainImageUrl || null,
        item.sku || null,
        item.itemName || 'Unnamed Item',
        item.category || 'Uncategorized',
        item.description || null,
        item.lead || null,
        item.auctionSiteEstimate || null,
        item.aiDescription || null,
        item.aiEstimate || null,
        item.status || 'research',
        item.researcherEstimate || null,
        item.researcherDescription || null,
        item.referenceUrls || [],
        item.similarUrls || [],
        item.photographerQuantity || null,
        item.photographerImages || [],
        item.isMultipleItems || false,
        item.multipleItemsCount || 1,
        item.finalData || null,
        item.createdAt || now,
        item.updatedAt || now,
        item.assignedTo || null,
        item.notes || null,
        item.priority || 'medium',
        item.tags || [],
        item.parentItemId || null,
        item.subItemNumber || null,
        item.photographerNotes || null,
        item.researcherNotes || null,
        item.researcher2Notes || null,
        item.adminId || null
      ]);

      return this.mapAuctionItemFromDb(result.rows[0]);
    } finally {
      client.release();
    }
  }

  // Update item by ID
  async updateItem(id: string, updates: Partial<AuctionItem>): Promise<AuctionItem | null> {
    return this.updateAuctionItem(id, updates);
  }

  async createAuctionItem(item: Omit<AuctionItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<AuctionItem> {
    if (isBrowser) {
      throw new Error('Database service not available on client side');
    }

    const client = await this.getClient();
    try {
      const id = crypto.randomUUID();
      const now = new Date();

      const result = await client.query(`
        INSERT INTO auction_items (
          id, url, url_main, auction_name, lot_number, images, main_image_url, sku, item_name, category, description,
          lead, auction_site_estimate, ai_description, ai_estimate, status, researcher_estimate,
          researcher_description, reference_urls, similar_urls, photographer_quantity, photographer_images,
          is_multiple_items, multiple_items_count, final_data, created_at, updated_at, assigned_to, notes, priority, tags,
          parent_item_id, sub_item_number, photographer_notes, researcher_notes, researcher2_notes, admin_id, org_id
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38
        ) RETURNING *
      `, [
        id, item.url, item.url_main || null, item.auctionName, item.lotNumber, item.images, item.mainImageUrl, item.sku, item.itemName,
        item.category, item.description, item.lead, item.auctionSiteEstimate, item.aiDescription,
        item.aiEstimate, item.status, item.researcherEstimate, item.researcherDescription,
        item.referenceUrls, item.similarUrls, item.photographerQuantity, item.photographerImages,
        item.isMultipleItems || false, item.multipleItemsCount || 1, item.finalData,
        now, now, item.assignedTo, item.notes, item.priority || 'medium', item.tags, item.parentItemId || null, item.subItemNumber || null, item.photographerNotes || null, item.researcherNotes || null, item.researcher2Notes || null, item.adminId || null, item.orgId || null
      ]);

      return this.mapAuctionItemFromDb(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async getAuctionItems(): Promise<AuctionItem[]> {
    if (isBrowser) {
      throw new Error('Database service not available on client side');
    }

    console.log('🔍 Database: Getting auction items...');
    const client = await this.getClient();
    try {
      const result = await client.query('SELECT * FROM auction_items ORDER BY created_at DESC');
      console.log('📊 Database: Found', result.rows.length, 'items');
      const items = result.rows.map(row => this.mapAuctionItemFromDb(row));
      console.log('📋 Database: Mapped items:', items.length);
      return items;
    } finally {
      client.release();
    }
  }

  async getAuctionItemsByAdmin(adminId: string): Promise<AuctionItem[]> {
    if (isBrowser) {
      throw new Error('Database service not available on client side');
    }

    console.log('🔍 Database: Getting auction items for admin:', adminId);
    const client = await this.getClient();
    try {
      const result = await client.query('SELECT * FROM auction_items WHERE admin_id = $1 ORDER BY created_at DESC', [adminId]);
      console.log('📊 Database: Found', result.rows.length, 'items for admin');
      const items = result.rows.map(row => this.mapAuctionItemFromDb(row));
      console.log('📋 Database: Mapped items:', items.length);
      return items;
    } finally {
      client.release();
    }
  }

  async getAuctionItem(id: string): Promise<AuctionItem | null> {
    if (isBrowser) {
      throw new Error('Database service not available on client side');
    }

    const client = await this.getClient();
    try {
      const result = await client.query('SELECT * FROM auction_items WHERE id = $1', [id]);
      return result.rows.length > 0 ? this.mapAuctionItemFromDb(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  async updateAuctionItem(id: string, updates: Partial<AuctionItem>): Promise<AuctionItem | null> {
    if (isBrowser) {
      throw new Error('Database service not available on client side');
    }

    console.log('🔄 Database updateAuctionItem called:', { id, updates });

    const client = await this.getClient();
    try {
      const fields = Object.keys(updates).filter(key => key !== 'id');
      const values = fields.map((_, index) => `$${index + 2}`);

      const query = `
        UPDATE auction_items
        SET ${fields.map(field => `${this.camelToSnake(field)} = $${fields.indexOf(field) + 2}`).join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `;

      console.log('📤 Database query:', query);
      console.log('📤 Database values:', [id, ...fields.map(field => updates[field as keyof AuctionItem])]);

      const result = await client.query(query, [id, ...fields.map(field => updates[field as keyof AuctionItem])]);
      console.log('📥 Database result:', result.rows[0]);

      return result.rows.length > 0 ? this.mapAuctionItemFromDb(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  // Webhook data operations
  async storeWebhookData(data: any): Promise<any> {
    if (isBrowser) {
      throw new Error('Database service not available on client side');
    }

    const client = await this.getClient();
    try {
      const id = crypto.randomUUID();

      const result = await client.query(`
        INSERT INTO webhook_data (
          id, url_main, item_name, lot_number, description, lead, category, estimate,
          auction_name, all_unique_image_urls, main_image_url, gallery_image_urls,
          broad_search_images, tumbnail_images, ai_response, status
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
        ) RETURNING *
      `, [
        id, data.url_main, data.item_name, data.lot_number, data.description, data.lead,
        data.category, data.estimate, data.auction_name, data.all_unique_image_urls,
        data.main_image_url, data.gallery_image_urls, data.broad_search_images,
        data.tumbnail_images, data.ai_response, 'processed'
      ]);

      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async getWebhookData(): Promise<any[]> {
    if (isBrowser) {
      throw new Error('Database service not available on client side');
    }

    const client = await this.getClient();
    try {
      const result = await client.query('SELECT * FROM webhook_data ORDER BY received_at DESC');
      return result.rows;
    } finally {
      client.release();
    }
  }

  // Helper methods
  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  private mapUserFromDb(row: any): UserAccount {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      password: row.password,
      role: row.role as any,
      createdAt: new Date(row.createdAt || row.created_at),
      updatedAt: new Date(row.updatedAt || row.updated_at),
      isActive: Boolean(row.isActive || row.is_active),
      isTrial: Boolean(row.is_trial),
      avatar: row.avatar,
      createdBy: row.created_by,
      orgId: row.org_id || undefined,
      ebayConnected: !!row.ebay_refresh_token,
      ebayUserId: row.ebay_user_id || undefined,
    };
  }

  private mapAuctionItemFromDb(row: any): AuctionItem {
    return {
      id: row.id,
      url: row.url,
      url_main: row.url_main,
      auctionName: row.auction_name,
      lotNumber: row.lot_number,
      images: Array.isArray(row.images) ? row.images : (row.images ? [row.images] : []),
      mainImageUrl: row.main_image_url,
      sku: row.sku,
      itemName: row.item_name,
      category: row.category,
      description: row.description,
      lead: row.lead,
      auctionSiteEstimate: row.auction_site_estimate,
      aiDescription: row.ai_description,
      aiEstimate: row.ai_estimate,
      status: row.status as any,
      researcherEstimate: row.researcher_estimate,
      researcherDescription: row.researcher_description,
      referenceUrls: Array.isArray(row.reference_urls) ? row.reference_urls : (row.reference_urls ? [row.reference_urls] : []),
      similarUrls: Array.isArray(row.similar_urls) ? row.similar_urls : (row.similar_urls ? [row.similar_urls] : []),
      photographerQuantity: row.photographer_quantity,
      photographerImages: Array.isArray(row.photographer_images) ? row.photographer_images : (row.photographer_images ? [row.photographer_images] : []),
      isMultipleItems: Boolean(row.is_multiple_items),
      multipleItemsCount: row.multiple_items_count || 1,
      finalData: row.final_data,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      assignedTo: row.assigned_to,
      notes: row.notes,
      photographerNotes: row.photographer_notes,
      researcherNotes: row.researcher_notes,
      researcher2Notes: row.researcher2_notes,
      priority: row.priority as any,
      tags: row.tags || [],
      parentItemId: row.parent_item_id,
      subItemNumber: row.sub_item_number,
      adminId: row.admin_id,
      orgId: row.org_id || undefined,
    };
  }

  // Close database connection
  async close() {
    if (this.pool && !isBrowser) {
      await this.pool.end();
      this.isConnected = false;
    }
  }

  async deleteAuctionItem(id: string): Promise<boolean> {
    if (isBrowser) {
      throw new Error('Database service not available on client side');
    }

    const client = await this.getClient();
    try {
      const result = await client.query('DELETE FROM auction_items WHERE id = $1', [id]);
      return (result.rowCount ?? 0) > 0;
    } finally {
      client.release();
    }
  }

  // Credit Management Methods
  async createUserCredits(userId: string, initialCredits: number = 100): Promise<boolean> {
    if (isBrowser) {
      throw new Error('Database service not available on client side');
    }

    const client = await this.getClient();
    try {
      // Create initial credit batch (never expires by default for initial credits, or set logic here)
      // For now, let's say initial credits never expire.
      await this.addCredits(userId, initialCredits, 'Initial credits', null);

      // We still keep user_credits table for caching/display of 'total_purchased'
      // But availability is now derived from batches.
      const id = `credits-${userId}`;
      await client.query(`
        INSERT INTO user_credits (id, user_id, current_credits, total_purchased, created_at, updated_at)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO NOTHING
      `, [id, userId, initialCredits, initialCredits]);

      return true;
    } finally {
      client.release();
    }
  }

  async getUserCredits(userId: string): Promise<{ current_credits: number; total_purchased: number } | null> {
    if (isBrowser) {
      throw new Error('Database service not available on client side');
    }

    const client = await this.getClient();
    try {
      // Calculate current valid credits from batches
      const batchResult = await client.query(`
        SELECT COALESCE(SUM(remaining_amount), 0) as current_credits
        FROM credit_batches
        WHERE user_id = $1
        AND remaining_amount > 0
        AND (expires_at IS NULL OR expires_at > NOW())
      `, [userId]);

      const currentCredits = parseInt(batchResult.rows[0].current_credits);

      // Get total purchased from user_credits cache/record
      const userCreditsResult = await client.query(
        'SELECT total_purchased FROM user_credits WHERE user_id = $1',
        [userId]
      );

      const totalPurchased = userCreditsResult.rows.length > 0 ? userCreditsResult.rows[0].total_purchased : 0;

      // Also auto-migrate if user has credits in user_credits but NO batches (backward compatibility)
      if (currentCredits === 0 && totalPurchased > 0) {
           const legacyCreditsCheck = await client.query('SELECT current_credits FROM user_credits WHERE user_id = $1', [userId]);
           if (legacyCreditsCheck.rows.length > 0 && legacyCreditsCheck.rows[0].current_credits > 0) {
               // Found legacy credits without batch. Migrate them.
               console.log(`Migrating legacy credits for user ${userId}`);
               const legacyAmount = legacyCreditsCheck.rows[0].current_credits;
               // Perform migration: Add a non-expiring batch
               await this.addCredits(userId, legacyAmount, 'Legacy credits migration', null);
               return { current_credits: legacyAmount, total_purchased: totalPurchased };
           }
      }

      return { current_credits: currentCredits, total_purchased: totalPurchased };
    } finally {
      client.release();
    }
  }

  async hasEnoughCredits(userId: string, cost: number): Promise<boolean> {
    const credits = await this.getUserCredits(userId);
    return !!credits && credits.current_credits >= cost;
  }

  async deductCredits(userId: string, amount: number, description: string): Promise<boolean> {
    if (isBrowser) {
      throw new Error('Database service not available on client side');
    }

    const client = await this.getClient();
    try {
      // Check if user has enough credits
      const credits = await this.getUserCredits(userId);
      if (!credits || credits.current_credits < amount) {
        return false;
      }

      // Start transaction
      await client.query('BEGIN');

      // 1. Get valid batches ordered by expiration (earliest first), nulls last?
      // Actually strictly we want expiring credits to be used first. NULL means never expire.
      // So sorting ASC by expires_at puts dates first. NULLs are usually last in ASC order in Postgres default?
      // Postgres: NULLS LAST is default for ASC. Perfect.
      // Wait, if expires_at is NULL, it's effectively Infinity.
      // So "Expires in 1 month" < "Expires in 3 months" < "Never expires".
      // Yes, using earliest expiration date first is correct strategy for user benefit.

      const batchesResult = await client.query(`
        SELECT id, remaining_amount
        FROM credit_batches
        WHERE user_id = $1
        AND remaining_amount > 0
        AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY expires_at ASC NULLS LAST
        FOR UPDATE
      `, [userId]);

      let remainingToDeduct = amount;
      const batchesToUpdate: { id: string, deduct: number }[] = [];

      for (const batch of batchesResult.rows) {
        if (remainingToDeduct <= 0) break;

        const available = batch.remaining_amount;
        const deduct = Math.min(amount, remainingToDeduct, available); // min check safe

        batchesToUpdate.push({ id: batch.id, deduct });
        remainingToDeduct -= deduct;
      }

      if (remainingToDeduct > 0) {
        // Not enough credits
        await client.query('ROLLBACK');
        return false;
      }

      // 2. Perform updates
      for (const update of batchesToUpdate) {
        await client.query(`
           UPDATE credit_batches
           SET remaining_amount = remaining_amount - $1
           WHERE id = $2
        `, [update.deduct, update.id]);
      }

      // 3. Update summary table (for quick view/cache if needed, though we rely on batches now)
      await client.query(`
        UPDATE user_credits
        SET current_credits = current_credits - $1, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $2
      `, [amount, userId]);

      // 4. Log transaction
      const txnId = crypto.randomUUID();
      await client.query(`
        INSERT INTO credit_transactions (id, user_id, transaction_type, amount, description, created_at)
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      `, [txnId, userId, 'deduction', amount, description]);

      await client.query('COMMIT');
      return true;
    } catch (error) {
       await client.query('ROLLBACK');
       console.error('Error deducting credits:', error);
       return false;
    } finally {
      client.release();
    }

  }

  async topUpCredits(userId: string, amount: number, description: string = 'Credit top-up', expiresInDays: number | null = null): Promise<boolean> {
    if (isBrowser) {
      throw new Error('Database service not available on client side');
    }

    const client = await this.getClient();
    try {
      // Update legacy fields for record keeping
      await client.query(`
        UPDATE user_credits
        SET last_topup_date = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1
      `, [userId]);

      // Use new batch system
      return await this.addCredits(userId, amount, description, expiresInDays);
    } finally {
      client.release();
    }
  }

  async addCredits(userId: string, amount: number, description: string, expiresInDays: number | null = null): Promise<boolean> {
    if (isBrowser) throw new Error('DB service server side only');

    const client = await this.getClient();
    try {
        await client.query('BEGIN');

        const batchId = crypto.randomUUID();

        let expiresAt: Date | null = null;
        if (expiresInDays !== null) {
            expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + expiresInDays);
        }

        // 1. Create Batch
        await client.query(`
            INSERT INTO credit_batches (id, user_id, amount, remaining_amount, expires_at, created_at)
            VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        `, [batchId, userId, amount, amount, expiresAt]);

        // 2. Update user_credits aggregate (for total_purchased and cache)
        await client.query(`
            INSERT INTO user_credits (id, user_id, current_credits, total_purchased, last_topup_date, created_at, updated_at)
            VALUES ($1, $2, $3, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (id) DO UPDATE
            SET current_credits = user_credits.current_credits + $3,
                total_purchased = user_credits.total_purchased + $3,
                last_topup_date = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
        `, [`credits-${userId}`, userId, amount]);

        // 3. Log transaction
         const txnId = crypto.randomUUID();
         await client.query(`
            INSERT INTO credit_transactions (id, user_id, transaction_type, amount, description, created_at)
            VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        `, [txnId, userId, 'topup', amount, description]);

        await client.query('COMMIT');
        return true;
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error adding credits:', error);
        return false;
    } finally {
        client.release();
    }
  }

  async addCreditTransaction(userId: string, type: string, amount: number, description: string): Promise<void> {
    if (isBrowser) {
      throw new Error('Database service not available on client side');
    }

    const client = await this.getClient();
    try {
      const id = crypto.randomUUID();
      await client.query(`
        INSERT INTO credit_transactions (id, user_id, transaction_type, amount, description, created_at)
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      `, [id, userId, type, amount, description]);
    } finally {
      client.release();
    }
  }

    async getCreditTransactions(userId: string): Promise<any[]> {
    if (isBrowser) {
      throw new Error('Database service not available on client side');
    }

    const client = await this.getClient();
    try {
      const result = await client.query(`
        SELECT * FROM credit_transactions
        WHERE user_id = $1
        ORDER BY created_at DESC
      `, [userId]);
      return result.rows;
    } finally {
      client.release();
    }
  }

  async transactionExists(userId: string, description: string): Promise<boolean> {
      if (isBrowser) {
          throw new Error('Database service not available on client side');
      }

      const client = await this.getClient();
      try {
          // Check if any transaction exists with this description for this user
          // (e.g. "Stripe Purchase: cs_test_...")
          const result = await client.query(`
              SELECT id FROM credit_transactions
              WHERE user_id = $1 AND description = $2
              LIMIT 1
          `, [userId, description]);
          return result.rows.length > 0;
      } finally {
          client.release();
      }
  }

  async getCreditSettings(): Promise<{ [key: string]: number }> {
    if (isBrowser) {
      throw new Error('Database service not available on client side');
    }

    const client = await this.getClient();
    try {
      console.log('Fetching credit settings from database...');
      const result = await client.query('SELECT setting_name, setting_value FROM credit_settings');
      const settings: { [key: string]: number } = {};
      result.rows.forEach(row => {
        settings[row.setting_name] = row.setting_value;
      });
      console.log('Credit settings fetched:', settings);
      return settings;
    } finally {
      client.release();
    }
  }

  async updateCreditSettings(settings: Record<string, number>, updatedBy: string): Promise<boolean> {
    if (isBrowser) {
      throw new Error('Database service not available on client side');
    }

    const client = await this.getClient();
    try {
      await client.query('BEGIN');

      for (const [key, value] of Object.entries(settings)) {
        await client.query(`
          INSERT INTO credit_settings (id, setting_name, setting_value, updated_by, updated_at)
          VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
          ON CONFLICT (setting_name) DO UPDATE
          SET setting_value = $3, updated_by = $4, updated_at = CURRENT_TIMESTAMP
        `, [`setting-${key}`, key, value, updatedBy]);
      }

      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  // Password Reset Token Operations
  async createPasswordResetToken(email: string, token: string, expires: number): Promise<boolean> {
    if (isBrowser) return false;
    await this.ensureInitialized();
    const client = await this.getClient();
    try {
      const id = crypto.randomUUID();
      // Remove any existing tokens for this email
      await client.query('DELETE FROM password_reset_tokens WHERE user_email = $1', [email]);

      await client.query(
        'INSERT INTO password_reset_tokens (id, user_email, token, expires) VALUES ($1, $2, $3, $4)',
        [id, email, token, expires]
      );
      return true;
    } catch (error) {
      console.error('Error creating password reset token:', error);
      return false;
    } finally {
      client.release();
    }
  }

  async validatePasswordResetToken(token: string) {
    if (isBrowser) return null;
    await this.ensureInitialized();
    const client = await this.getClient();
    try {
      const result = await client.query(
        'SELECT * FROM password_reset_tokens WHERE token = $1',
        [token]
      );

      if (result.rows.length === 0) return null;

      const tokenData = result.rows[0];
      if (Date.now() > Number(tokenData.expires)) {
        // Expired
        await this.deletePasswordResetToken(token);
        return null;
      }

      return tokenData;
    } catch (error) {
      console.error('Error validating token:', error);
      return null;
    } finally {
      client.release();
    }
  }

  async deletePasswordResetToken(token: string) {
    if (isBrowser) return;
    await this.ensureInitialized();
    const client = await this.getClient();
    try {
      await client.query('DELETE FROM password_reset_tokens WHERE token = $1', [token]);
    } catch (error) {
      console.error('Error deleting token:', error);
    } finally {
      client.release();
    }
  }

  // ── Activation Token One-Time-Use Tracking ─────────────────────────────
  // Stores used JTIs so activation links can't be replayed.

  async isActivationTokenUsed(jti: string): Promise<boolean> {
    if (isBrowser) throw new Error('Database service not available on client side');
    await this.ensureInitialized();
    const client = await this.getClient();
    try {
      // Create table on first use (idempotent)
      await client.query(`
        CREATE TABLE IF NOT EXISTS used_activation_tokens (
          jti VARCHAR(255) PRIMARY KEY,
          used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP
        )
      `);
      const result = await client.query(
        'SELECT jti FROM used_activation_tokens WHERE jti = $1',
        [jti]
      );
      return result.rows.length > 0;
    } finally {
      client.release();
    }
  }

  async markActivationTokenUsed(jti: string, expMs: number): Promise<void> {
    if (isBrowser) return;
    await this.ensureInitialized();
    const client = await this.getClient();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS used_activation_tokens (
          jti VARCHAR(255) PRIMARY KEY,
          used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP
        )
      `);
      await client.query(
        `INSERT INTO used_activation_tokens (jti, expires_at)
         VALUES ($1, to_timestamp($2 / 1000.0))
         ON CONFLICT (jti) DO NOTHING`,
        [jti, expMs]
      );
    } catch (error) {
      console.error('Error marking activation token as used:', error);
    } finally {
      client.release();
    }
  }

  // ── Organizations ────────────────────────────────────────────────────────

  async createOrganization(name: string, plan: string = 'trial'): Promise<{ id: string; name: string; slug: string; plan: string }> {
    if (isBrowser) throw new Error('Database service not available on client side');
    await this.ensureInitialized();
    const client = await this.getClient();
    try {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const id = crypto.randomUUID();
      const result = await client.query(
        `INSERT INTO organizations (id, name, slug, plan)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
         RETURNING id, name, slug, plan`,
        [id, name, slug, plan]
      );
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async getOrganizationBySlug(slug: string): Promise<{ id: string; name: string; slug: string; plan: string } | null> {
    if (isBrowser) throw new Error('Database service not available on client side');
    await this.ensureInitialized();
    const client = await this.getClient();
    try {
      const result = await client.query('SELECT id, name, slug, plan FROM organizations WHERE slug = $1', [slug]);
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  async setUserOrg(userId: string, orgId: string): Promise<void> {
    if (isBrowser) throw new Error('Database service not available on client side');
    await this.ensureInitialized();
    const client = await this.getClient();
    try {
      await client.query('UPDATE users SET org_id = $1 WHERE id = $2', [orgId, userId]);
    } finally {
      client.release();
    }
  }

  async getAuctionItemsByOrg(orgId: string, adminId?: string): Promise<AuctionItem[]> {
    if (isBrowser) throw new Error('Database service not available on client side');
    await this.ensureInitialized();
    const client = await this.getClient();
    try {
      // Include items by org_id OR by admin_id (for items created before org was assigned)
      const result = adminId
        ? await client.query(
            'SELECT * FROM auction_items WHERE org_id = $1 OR admin_id = $2 ORDER BY created_at DESC',
            [orgId, adminId]
          )
        : await client.query(
            'SELECT * FROM auction_items WHERE org_id = $1 ORDER BY created_at DESC',
            [orgId]
          );
      return result.rows.map(row => this.mapAuctionItemFromDb(row));
    } finally {
      client.release();
    }
  }

  async getUsersByOrg(orgId: string): Promise<UserAccount[]> {
    if (isBrowser) throw new Error('Database service not available on client side');
    await this.ensureInitialized();
    const client = await this.getClient();
    try {
      const result = await client.query(
        "SELECT * FROM users WHERE org_id = $1 AND role != 'super_admin' ORDER BY created_at DESC",
        [orgId]
      );
      return result.rows.map(row => this.mapUserFromDb(row));
    } finally {
      client.release();
    }
  }

  // ─── eBay OAuth Token Management ──────────────────────────────────────────

  async saveEbayTokens(
    userId: string,
    tokens: { accessToken: string; refreshToken: string; expiresAt: Date; ebayUserId?: string }
  ): Promise<void> {
    await this.ensureInitialized();
    const client = await this.getClient();
    try {
      await client.query(
        `UPDATE users
         SET ebay_access_token  = $1,
             ebay_refresh_token = $2,
             ebay_token_expiry  = $3,
             ebay_user_id       = COALESCE($4, ebay_user_id),
             updated_at         = CURRENT_TIMESTAMP
         WHERE id = $5`,
        [tokens.accessToken, tokens.refreshToken, tokens.expiresAt, tokens.ebayUserId || null, userId]
      );
    } finally {
      client.release();
    }
  }

  async getEbayTokens(userId: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresAt: Date | null;
    ebayUserId: string | null;
  } | null> {
    await this.ensureInitialized();
    const client = await this.getClient();
    try {
      const result = await client.query(
        'SELECT ebay_access_token, ebay_refresh_token, ebay_token_expiry, ebay_user_id FROM users WHERE id = $1',
        [userId]
      );
      if (!result.rows.length || !result.rows[0].ebay_refresh_token) return null;
      const row = result.rows[0];
      return {
        accessToken: row.ebay_access_token,
        refreshToken: row.ebay_refresh_token,
        expiresAt: row.ebay_token_expiry ? new Date(row.ebay_token_expiry) : null,
        ebayUserId: row.ebay_user_id || null,
      };
    } finally {
      client.release();
    }
  }

  async clearEbayTokens(userId: string): Promise<void> {
    await this.ensureInitialized();
    const client = await this.getClient();
    try {
      await client.query(
        `UPDATE users
         SET ebay_access_token  = NULL,
             ebay_refresh_token = NULL,
             ebay_token_expiry  = NULL,
             ebay_user_id       = NULL,
             updated_at         = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [userId]
      );
    } finally {
      client.release();
    }
  }
}

// Export the database service
export const databaseService = new DatabaseService();
