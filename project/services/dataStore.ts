import { AuctionItem, UserAccount, WorkflowStep, Notification, DashboardStats } from '@/types/auction';

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

class DataStore {
  private items: AuctionItem[] = [];
  private users: UserAccount[] = [];
  private workflowSteps: WorkflowStep[] = [];
  private notifications: Notification[] = [];
  private useDatabase = true;

  constructor() {
    // Only initialize if we're in a browser environment
    if (isBrowser) {
      this.initializeStorage();
    }
  }

  private async initializeStorage() {
    // Use PostgreSQL database for production
    this.useDatabase = true;
    console.log('🚀 Production mode: Using PostgreSQL database for storage');

    // Clean up any existing demo data
    this.cleanupDemoData();

    this.loadFromLocalStorage();
    this.initializeAdminUser();
  }

  private cleanupDemoData() {
    if (!isBrowser) return;

    try {
      // Clear any existing demo data
      localStorage.removeItem('auctionItems');
      localStorage.removeItem('workflowSteps');
      localStorage.removeItem('notifications');

      // Only keep user accounts (admin will be recreated if needed)
      const existingUsers = localStorage.getItem('userAccounts');
      if (existingUsers) {
        const users = JSON.parse(existingUsers);
        // Filter out demo users, keep only admin
        const productionUsers = users.filter((user: UserAccount) =>
          user.role === 'admin' && user.email === 'admin@example.com'
        );
        if (productionUsers.length > 0) {
          localStorage.setItem('userAccounts', JSON.stringify(productionUsers));
        } else {
          localStorage.removeItem('userAccounts');
        }
      }

      console.log('🧹 Demo data cleaned up for production');
    } catch (error) {
      console.error('Error cleaning up demo data:', error);
    }
  }

  private loadFromLocalStorage() {
    if (!isBrowser) return;

    try {
      const storedItems = localStorage.getItem('auctionItems');
      const storedUsers = localStorage.getItem('userAccounts');
      const storedWorkflow = localStorage.getItem('workflowSteps');
      const storedNotifications = localStorage.getItem('notifications');

      if (storedItems) this.items = JSON.parse(storedItems);
      if (storedUsers) this.users = JSON.parse(storedUsers);
      if (storedWorkflow) this.workflowSteps = JSON.parse(storedWorkflow);
      if (storedNotifications) this.notifications = JSON.parse(storedNotifications);
    } catch (error) {
      console.error('Error loading data from localStorage:', error);
    }
  }

  private saveToLocalStorage() {
    if (!isBrowser) return;

    try {
      localStorage.setItem('auctionItems', JSON.stringify(this.items));
      localStorage.setItem('userAccounts', JSON.stringify(this.users));
      localStorage.setItem('workflowSteps', JSON.stringify(this.workflowSteps));
      localStorage.setItem('notifications', JSON.stringify(this.notifications));
    } catch (error) {
      console.error('Error saving data to localStorage:', error);
    }
  }

  initializeAdminUser() {
    if (!isBrowser) return;

    // Check if admin user already exists
    const adminExists = this.users.find(user => user.role === 'admin');
    if (!adminExists) {
      // Create only the essential admin user for production
      const adminUser: UserAccount = {
        id: 'admin-001',
        name: process.env.ADMIN_NAME || 'Bidsquire Admin',
        email: process.env.ADMIN_EMAIL || 'admin@bidsquire.com',
        password: process.env.ADMIN_PASSWORD || 'Admin@bids25',
        role: 'admin',
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true
      };
      this.users.push(adminUser);
      this.saveToLocalStorage();
    }
  }

  // Auction Items
  async getItems(userId?: string, userRole?: string): Promise<AuctionItem[]> {
    if (this.useDatabase) {
      try {
        console.log('🔍 Fetching items from API endpoint...');
        // Use API endpoint for client-side database access
        const url = new URL('/api/auction-items', window.location.origin);
        if (userId && userRole) {
          url.searchParams.set('userId', userId);
          url.searchParams.set('userRole', userRole);
        }

        const response = await fetch(url.toString());
        console.log('📡 API response status:', response.status);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log('📊 API response data:', data);

        const items = Array.isArray(data) ? data : [];
        console.log('📋 Items from API:', items.length, 'items');

        // Update local cache
        this.items = items;
        return items;
      } catch (error) {
        console.error('❌ Error fetching items from database:', error);
        // Fallback to local items if database fails
        return [...this.items];
      }
    }
    return [...this.items];
  }

  getItemsByStatus(status: AuctionItem['status']): AuctionItem[] {
    return this.items.filter(item => item.status === status);
  }

  getItemsByUser(userId: string): AuctionItem[] {
    return this.items.filter(item => item.assignedTo === userId);
  }

  getItem(id: string): AuctionItem | undefined {
    return this.items.find(item => item.id === id);
  }

  async addItem(item: Omit<AuctionItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<AuctionItem> {
    if (this.useDatabase) {
      try {
        // Import database service directly for server-side operations
        const { databaseService } = await import('@/services/database');
        const newItem = await databaseService.createAuctionItem(item);
        this.items.push(newItem);
        return newItem;
      } catch (error) {
        console.error('Error creating auction item in database:', error);
        throw error;
      }
    } else {
      const newItem: AuctionItem = {
        ...item,
        id: Date.now().toString(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      this.items.push(newItem);
      this.saveToLocalStorage();
      return newItem;
    }
  }

  async updateItem(id: string, updates: Partial<AuctionItem>): Promise<AuctionItem | null> {
    console.log('🔄 dataStore.updateItem called:', { id, updates });
    if (this.useDatabase) {
      try {
        // Update in database
        console.log('📤 Sending PUT request to /api/auction-items with:', updates);
        const response = await fetch(`/api/auction-items?id=${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updates)
        });

        console.log('📥 API response status:', response.status);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const updatedItem = await response.json();
        console.log('📥 API response data:', updatedItem);

        // Update local cache
        const index = this.items.findIndex(item => item.id === id);
        if (index !== -1) {
          this.items[index] = updatedItem;
          console.log('✅ Updated local cache');
        }

        return updatedItem;
      } catch (error) {
        console.error('❌ Error updating item in database:', error);
        return null;
      }
    } else {
      // Local storage mode
      const index = this.items.findIndex(item => item.id === id);
      if (index === -1) return null;

      const updatedItem = {
        ...this.items[index],
        ...updates,
        updatedAt: new Date()
      };

      this.items[index] = updatedItem;
      this.saveToLocalStorage();
      return updatedItem;
    }
  }

  async deleteItem(id: string): Promise<boolean> {
    if (this.useDatabase) {
      try {
        // Delete from database
        const response = await fetch(`/api/auction-items?id=${id}`, {
          method: 'DELETE'
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Remove from local cache
        const index = this.items.findIndex(item => item.id === id);
        if (index !== -1) {
          this.items.splice(index, 1);
        }

        return true;
      } catch (error) {
        console.error('Error deleting item from database:', error);
        return false;
      }
    } else {
      // Local storage mode
      const index = this.items.findIndex(item => item.id === id);
      if (index === -1) return false;

      this.items.splice(index, 1);
      this.saveToLocalStorage();
      return true;
    }
  }

  // Users
  async getUsers(): Promise<UserAccount[]> {
    if (this.useDatabase) {
      try {
        const response = await fetch('/api/users');
        if (response.ok) {
          return await response.json();
        }
      } catch (error) {
        console.error('Error fetching users from database:', error);
      }
    }
    return [...this.users];
  }

  async getUser(id: string): Promise<UserAccount | undefined> {
    if (this.useDatabase) {
      try {
        const response = await fetch(`/api/users/${id}`);
        if (response.ok) {
          return await response.json();
        }
      } catch (error) {
        console.error('Error fetching user from database:', error);
      }
    }
    return this.users.find(user => user.id === id);
  }

  async getUserByEmail(email: string): Promise<UserAccount | undefined> {
    if (this.useDatabase) {
      try {
        const response = await fetch(`/api/users/email/${email}`);
        if (response.ok) {
          return await response.json();
        }
      } catch (error) {
        console.error('Error fetching user by email from database:', error);
      }
    }
    return this.users.find(user => user.email === email);
  }

  async addUser(userData: Omit<UserAccount, 'id' | 'createdAt'>): Promise<UserAccount> {
    if (this.useDatabase) {
      try {
        const response = await fetch('/api/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(userData),
        });
        if (response.ok) {
          return await response.json();
        }
      } catch (error) {
        console.error('Error creating user in database:', error);
      }
    }

    const newUser: UserAccount = {
      ...userData,
      id: `user-${Date.now()}`,
      createdAt: new Date()
    };

    this.users.push(newUser);
    this.saveToLocalStorage();
    return newUser;
  }

  async updateUser(userId: string, updates: Partial<UserAccount>): Promise<UserAccount | null> {
    const index = this.users.findIndex(user => user.id === userId);
    if (index === -1) return null;

    // Don't allow changing the role of the last admin user
    if (updates.role && updates.role !== 'admin') {
      const adminUsers = this.users.filter(user => user.role === 'admin');
      if (adminUsers.length === 1 && adminUsers[0].id === userId) {
        throw new Error('Cannot change the role of the last admin user');
      }
    }

    this.users[index] = {
      ...this.users[index],
      ...updates
    };

    this.saveToLocalStorage();
    return this.users[index];
  }

  async deleteUser(userId: string): Promise<boolean> {
    if (this.useDatabase) {
      try {
        // Don't allow deleting the last admin user
        const adminUsers = this.users.filter(user => user.role === 'admin');
        if (adminUsers.length === 1 && adminUsers[0].id === userId) {
          throw new Error('Cannot delete the last admin user');
        }

        // Delete from database
        const response = await fetch(`/api/users/${userId}`, {
          method: 'DELETE'
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Remove from local cache
        const index = this.users.findIndex(user => user.id === userId);
        if (index !== -1) {
          this.users.splice(index, 1);
        }

        return true;
      } catch (error) {
        console.error('Error deleting user from database:', error);
        return false;
      }
    } else {
      // Local storage mode
      const index = this.users.findIndex(user => user.id === userId);
      if (index === -1) return false;

      // Don't allow deleting the last admin user
      const adminUsers = this.users.filter(user => user.role === 'admin');
      if (adminUsers.length === 1 && adminUsers[0].id === userId) {
        throw new Error('Cannot delete the last admin user');
      }

      this.users.splice(index, 1);
      this.saveToLocalStorage();
      return true;
    }
  }

  // Password change functionality
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<boolean> {
    if (this.useDatabase) {
      try {
        console.log('🔐 Changing password via database...');
        const { databaseService } = await import('@/services/database');
        const success = await databaseService.changePassword(userId, currentPassword, newPassword);
        console.log('🔐 Password change result:', success);
        return success;
      } catch (error) {
        console.error('❌ Error changing password in database:', error);
        return false;
      }
    }

    // Local storage fallback
    const user = await this.getUser(userId);
    if (!user || user.password !== currentPassword) {
      return false;
    }

    user.password = newPassword;
    this.saveToLocalStorage();
    return true;
  }

  // Update user profile
  async updateUserProfile(userId: string, updates: Partial<UserAccount>): Promise<UserAccount | null> {
    const index = this.users.findIndex(user => user.id === userId);
    if (index === -1) return null;

    // Don't allow role changes through profile update
    const { role, ...safeUpdates } = updates;

    this.users[index] = {
      ...this.users[index],
      ...safeUpdates
    };
    this.saveToLocalStorage();
    return this.users[index];
  }

  // Workflow
  addWorkflowStep(step: Omit<WorkflowStep, 'id' | 'timestamp'>): WorkflowStep {
    const newStep: WorkflowStep = {
      ...step,
      id: Date.now().toString(),
      timestamp: new Date()
    };
    this.workflowSteps.push(newStep);
    this.saveToLocalStorage();
    return newStep;
  }

  getWorkflowSteps(itemId: string): WorkflowStep[] {
    return this.workflowSteps.filter(step => step.itemId === itemId);
  }

  // Notifications
  addNotification(notification: Omit<Notification, 'id' | 'createdAt'>): Notification {
    const newNotification: Notification = {
      ...notification,
      id: Date.now().toString(),
      createdAt: new Date()
    };
    this.notifications.push(newNotification);
    this.saveToLocalStorage();
    return newNotification;
  }

  getNotifications(userId: string): Notification[] {
    return this.notifications.filter(notification => notification.userId === userId);
  }

  markNotificationAsRead(id: string): boolean {
    const notification = this.notifications.find(n => n.id === id);
    if (!notification) return false;

    notification.read = true;
    this.saveToLocalStorage();
    return true;
  }

  // Dashboard Stats
  getDashboardStats(userId?: string): DashboardStats {
    const userItems = userId ? this.items.filter(item => item.assignedTo === userId) : [];

    return {
      total: this.items.length,
      research: this.items.filter(item => item.status === 'research').length,

      winning: this.items.filter(item => item.status === 'winning').length,
      photography: this.items.filter(item => item.status === 'photography').length,
      research2: this.items.filter(item => item.status === 'research2').length,
      finalized: this.items.filter(item => item.status === 'finalized').length,
      myItems: userItems.length,
      overdue: userItems.filter(item => {
        const daysSinceUpdate = (Date.now() - new Date(item.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceUpdate > 7; // Items not updated in 7 days
      }).length
    };
  }

  // Workflow Management
  async moveItemToNextStatus(itemId: string, userId: string, userName: string, notes?: string): Promise<{ success: boolean; error?: string }> {
    const item = this.getItem(itemId);
    if (!item) return { success: false, error: 'ITEM_NOT_FOUND' };

    const currentStatus = item.status;
    let nextStatus: AuctionItem['status'];

    switch (currentStatus) {
      case 'research':
        nextStatus = 'winning';
        break;
      case 'winning':
        nextStatus = 'photography';
        break;
      case 'photography':
        nextStatus = 'research2';
        break;
      case 'research2':
        nextStatus = 'admin_review';
        break;
      case 'admin_review':
        nextStatus = 'finalized';
        break;
      default:
        return { success: false, error: 'INVALID_TRANSITION' };
    }

    // Check credits BEFORE moving the item — block if insufficient
    if (currentStatus === 'research2' && nextStatus === 'admin_review' && item.adminId) {
      try {
        const { databaseService } = await import('@/services/database');
        const creditSettings = await databaseService.getCreditSettings();
        const research2Cost = creditSettings.research2_stage_cost ?? creditSettings.research2_cost ?? 2;
        const balance = await databaseService.getUserCredits(item.adminId);

        if (!balance || balance.current_credits < research2Cost) {
          console.log(`⛔ Blocked: insufficient credits (have ${balance?.current_credits ?? 0}, need ${research2Cost})`);
          return { success: false, error: 'INSUFFICIENT_CREDITS' };
        }

        // Credits available — deduct now
        const creditDeducted = await databaseService.deductCredits(
          item.adminId,
          research2Cost,
          `Research2 completion: ${item.itemName || 'Unnamed Item'}`
        );

        if (!creditDeducted) {
          console.log('⛔ Credit deduction failed');
          return { success: false, error: 'INSUFFICIENT_CREDITS' };
        }

        console.log(`✅ Credits deducted: ${research2Cost} credits for research2 completion`);
      } catch (error) {
        console.error('Error checking/deducting credits for research2:', error);
        return { success: false, error: 'CREDIT_CHECK_FAILED' };
      }
    }

    // Auto-assign role based on the next status
    const assignedRole = await this.autoAssignRole(nextStatus);
    console.log(`🔄 Auto-assignment: ${currentStatus} → ${nextStatus}, assigned role: ${assignedRole}`);

    // Update item status and assignment
    const updateData: Partial<AuctionItem> = { status: nextStatus };
    if (assignedRole) {
      updateData.assignedTo = assignedRole;
      console.log(`✅ Item will be assigned to: ${assignedRole}`);
    } else {
      console.log(`⚠️ No role assigned for status: ${nextStatus}`);
    }

    const updated = await this.updateItem(itemId, updateData);
    if (!updated) return { success: false, error: 'UPDATE_FAILED' };

    // Get assigned role info for logging
    const assignmentNote = assignedRole ? ` (Auto-assigned to ${assignedRole} role)` : '';

    // Add workflow step
    this.addWorkflowStep({
      itemId,
      fromStatus: currentStatus,
      toStatus: nextStatus,
      userId,
      userName,
      notes: `${notes || ''}${assignmentNote}`
    });

    // Add notification to the newly assigned role
    this.addNotification({
      userId: assignedRole || item.assignedTo || userId,
      type: 'status_change',
      title: 'Item Status Updated',
      message: `Item "${item.itemName}" moved from ${currentStatus} to ${nextStatus}`,
      read: false,
      itemId
    });

    // Send webhook when researcher moves item to winning status (non-blocking)
    if (currentStatus === 'research' && nextStatus === 'winning') {
      this.sendResearcherProgressionWebhook(itemId).catch(error => {
        console.error('❌ Researcher progression webhook failed (non-blocking):', error);
      });

      // Lead notification: item won at auction (server-side only)
      if (item.adminId && typeof window === 'undefined') {
        import('@/services/database').then(({ databaseService }) =>
          databaseService.getUserById(item.adminId!).then(adminUser => {
            if (!adminUser) return;
            return import('@/services/lead-notifications').then(({ notifyItemsWon }) =>
              notifyItemsWon({
                adminName: adminUser.name,
                adminEmail: adminUser.email,
                itemName: item.itemName || 'Unnamed item',
                auctionUrl: item.url || item.url_main,
                auctionName: item.auctionName,
              })
            );
          })
        ).catch(e => console.error('[Notify] winning email failed:', e));
      }
    }

    // Lead notification: photos uploaded (photography → research2, server-side only)
    if (currentStatus === 'photography' && nextStatus === 'research2') {
      if (item.adminId && typeof window === 'undefined') {
        import('@/services/database').then(({ databaseService }) =>
          databaseService.getUserById(item.adminId!).then(adminUser => {
            if (!adminUser) return;
            return import('@/services/lead-notifications').then(({ notifyPhotosUploaded }) =>
              notifyPhotosUploaded({
                adminName: adminUser.name,
                adminEmail: adminUser.email,
                itemName: item.itemName || 'Unnamed item',
                photoCount: item.photographerImages?.length || 0,
                auctionUrl: item.url || item.url_main,
              })
            );
          })
        ).catch(e => console.error('[Notify] photos email failed:', e));
      }
    }

    return { success: true };
  }

  // Find first researcher user for auto-assignment
  private async findResearcherUser(): Promise<UserAccount | null> {
    try {
      if (this.useDatabase && typeof window === 'undefined') {
        // Server-side: use database service directly
        const { databaseService } = await import('@/services/database');
        const users = await databaseService.getAllUsers();
        return users.find(user => user.role === 'researcher' && (user.isActive !== false)) || null;
      } else {
        // Client-side: use API
        const users = await this.getUsers();
        return users.find(user => user.role === 'researcher' && (user.isActive !== false)) || null;
      }
    } catch (error) {
      console.error('Error finding researcher user:', error);
      return null;
    }
  }

  // Find first researcher2 user for auto-assignment
  private async findResearcher2User(): Promise<UserAccount | null> {
    try {
      if (this.useDatabase && typeof window === 'undefined') {
        // Server-side: use database service directly
        const { databaseService } = await import('@/services/database');
        const users = await databaseService.getAllUsers();
        return users.find(user => user.role === 'researcher2' && (user.isActive !== false)) || null;
      } else {
        // Client-side: use API
        const users = await this.getUsers();
        return users.find(user => user.role === 'researcher2' && (user.isActive !== false)) || null;
      }
    } catch (error) {
      console.error('Error finding researcher2 user:', error);
      return null;
    }
  }

  // Find first photographer user for auto-assignment
  private async findPhotographerUser(): Promise<UserAccount | null> {
    try {
      if (this.useDatabase && typeof window === 'undefined') {
        // Server-side: use database service directly
        const { databaseService } = await import('@/services/database');
        const users = await databaseService.getAllUsers();
        return users.find(user => user.role === 'photographer' && (user.isActive !== false)) || null;
      } else {
        // Client-side: use API
        const users = await this.getUsers();
        return users.find(user => user.role === 'photographer' && (user.isActive !== false)) || null;
      }
    } catch (error) {
      console.error('Error finding photographer user:', error);
      return null;
    }
  }

  // Auto-assign role based on item status
  private async autoAssignRole(status: string): Promise<string | undefined> {
    try {
      console.log(`🎯 autoAssignRole called with status: ${status}`);
      switch (status) {
        case 'research':
          console.log('🎯 Returning researcher role');
          return 'researcher';
        case 'research2':
          console.log('🎯 Returning researcher2 role');
          return 'researcher2';
        case 'photography':
          console.log('🎯 Returning photographer role');
          return 'photographer';
        case 'admin_review':
          console.log('🎯 Returning admin role');
          return 'admin';
        default:
          console.log(`🎯 No role found for status: ${status}`);
          return undefined;
      }
    } catch (error) {
      console.error('❌ Error auto-assigning role:', error);
      return undefined;
    }
  }

  // Move item to next stage with auto-assignment
  async moveToNextStage(itemId: string): Promise<AuctionItem | null> {
    try {
      const item = this.items.find(i => i.id === itemId);
      if (!item) {
        console.error('Item not found:', itemId);
        return null;
      }

      let nextStatus: string;
      let nextAssignedTo: string | undefined;

      // Determine next status and auto-assign role
      switch (item.status) {
        case 'research':
          nextStatus = 'winning';
          // Keep current assignment for winning status
          nextAssignedTo = item.assignedTo;
          break;
        case 'winning':
          nextStatus = 'photography';
          // Auto-assign to photographer role
          nextAssignedTo = await this.autoAssignRole('photography');
          break;
        case 'photography':
          nextStatus = 'research2';
          // Auto-assign to researcher2 role
          nextAssignedTo = await this.autoAssignRole('research2');
          break;
        case 'research2':
          nextStatus = 'finalized';
          // No assignment needed for finalized
          nextAssignedTo = undefined;
          break;
        default:
          console.error('Invalid status for progression:', item.status);
          return null;
      }

      console.log(`🔄 Moving item ${itemId} from ${item.status} to ${nextStatus}`);
      if (nextAssignedTo) {
        console.log(`👤 Auto-assigning to user: ${nextAssignedTo}`);
      }

      // Update the item
      const updatedItem = await this.updateItem(itemId, {
        status: nextStatus as any,
        assignedTo: nextAssignedTo
      });

      return updatedItem;
    } catch (error) {
      console.error('Error moving item to next stage:', error);
      return null;
    }
  }

  // Import from webhook data
  async importFromWebhook(webhookData: any, adminId?: string): Promise<AuctionItem | null> {
    try {
      console.log('=== IMPORT FROM WEBHOOK STARTED ===');
      console.log('Webhook data received:', JSON.stringify(webhookData, null, 2));

      // Auto-assign to researcher role
      console.log('Auto-assigning to researcher role...');
      const assignedRole = await this.autoAssignRole('research');
      console.log('Assigned to role:', assignedRole);

      // Extract data from webhook structure
      let processedData: any = {};

      // Check if this is already processed data from webhook receive API
      if (webhookData.item_name && webhookData.url_main) {
        console.log('=== USING PROCESSED WEBHOOK DATA ===');
        console.log('🔍 Available image fields in webhook data:', {
          all_unique_image_urls: webhookData.all_unique_image_urls,
          main_image_url: webhookData.main_image_url,
          tumbnail_images: webhookData.tumbnail_images
        });
        // This is already processed data from the webhook receive API
        const itemName = webhookData.item_name || 'Unnamed Item';
        const multipleItemsMatch = itemName.match(/\((\d+)\)/);
        const isMultipleItems = !!multipleItemsMatch;
        const multipleItemsCount = isMultipleItems ? parseInt(multipleItemsMatch[1]) : 1;

        processedData = {
          url: webhookData.url_main || '',
          itemName: itemName,
          lotNumber: webhookData.lot_number || '',
          description: webhookData.description || '',
          auctionName: webhookData.auction_name || '',
          auctionSiteEstimate: webhookData.estimate || '',
          aiDescription: webhookData.ai_response || '',
          images: this.processImageUrls(webhookData.all_unique_image_urls),
          mainImageUrl: webhookData.main_image_url || '',
          category: webhookData.category || 'Uncategorized',
          status: 'research' as const,
          priority: 'medium' as const,
          assignedTo: assignedRole,
          isMultipleItems: isMultipleItems,
          multipleItemsCount: multipleItemsCount,
          adminId: adminId // Add admin ID for item allotment
        };
      } else if (webhookData.httpData && webhookData.httpData[0] && webhookData.httpData[0].json) {
        console.log('=== EXTRACTING FROM N8N STRUCTURE ===');
        const n8nData = webhookData.httpData[0].json;

        // Detect multiple items from item name (e.g., "(4) Dad Themed Wooden Signs")
        const itemName = n8nData.item_name || 'Unnamed Item';
        const multipleItemsMatch = itemName.match(/\((\d+)\)/);
        const isMultipleItems = !!multipleItemsMatch;
        const multipleItemsCount = isMultipleItems ? parseInt(multipleItemsMatch[1]) : 1;

        processedData = {
          url: n8nData.url || n8nData.url_main || n8nData.hibid_url || '',
          itemName: itemName,
          lotNumber: n8nData.lot_number || '',
          description: n8nData.description || '',
          auctionName: n8nData.auction_name || '',
          auctionSiteEstimate: n8nData.estimate || '',
          aiDescription: webhookData.cleanedOutput || webhookData.rawOutput || '',
          images: this.processImageUrls(n8nData.all_unique_image_urls),
          mainImageUrl: n8nData.main_image_url || '',
          category: n8nData.category || 'Uncategorized',
          status: 'research' as const,
          priority: 'medium' as const,
          assignedTo: assignedRole,
          isMultipleItems: isMultipleItems,
          multipleItemsCount: multipleItemsCount,
          adminId: adminId // Add admin ID for item allotment
        };
      } else {
        console.log('=== USING DIRECT DATA STRUCTURE ===');
        // Detect multiple items from item name (e.g., "(4) Dad Themed Wooden Signs")
        const itemName = webhookData.item_name || 'Unnamed Item';
        const multipleItemsMatch = itemName.match(/\((\d+)\)/);
        const isMultipleItems = !!multipleItemsMatch;
        const multipleItemsCount = isMultipleItems ? parseInt(multipleItemsMatch[1]) : 1;

        processedData = {
          url: webhookData.url || webhookData.url_main || webhookData.hibid_url || '',
          itemName: itemName,
          lotNumber: webhookData.lot_number || '',
          description: webhookData.description || '',
          auctionName: webhookData.auction_name || '',
          auctionSiteEstimate: webhookData.estimate || '',
          aiDescription: webhookData.ai_response || '',
          images: this.processImageUrls(webhookData.all_unique_image_urls),
          mainImageUrl: webhookData.main_image_url || '',
          category: webhookData.category || 'Uncategorized',
          status: 'research' as const,
          priority: 'medium' as const,
          assignedTo: assignedRole,
          isMultipleItems: isMultipleItems,
          multipleItemsCount: multipleItemsCount,
          adminId: adminId // Add admin ID for item allotment
        };
      }

      // Create new auction item
      console.log('=== CREATING AUCTION ITEM ===');
      console.log('Processed data for addItem:', JSON.stringify(processedData, null, 2));

      const newItem = await this.addItem(processedData);
      console.log('✅ Auction item created successfully:', newItem ? newItem.id : 'null');

      // Add workflow step
      this.addWorkflowStep({
        itemId: newItem.id,
        fromStatus: 'research',
        toStatus: 'research',
        userId: 'system',
        userName: 'System',
        notes: `Item imported from webhook and auto-assigned to ${assignedRole} role`
      });

      return newItem;
    } catch (error) {
      console.error('Error importing from webhook:', error);
      return null;
    }
  }

  // Check storage type
  isUsingDatabase(): boolean {
    return this.useDatabase;
  }

  // Production data management
  clearAllData(): void {
    if (!isBrowser) return;

    try {
      // Clear all data
      this.items = [];
      this.workflowSteps = [];
      this.notifications = [];

      // Keep only admin user
      const adminUser = this.users.find(user => user.role === 'admin');
      this.users = adminUser ? [adminUser] : [];

      // Clear localStorage
      localStorage.removeItem('auctionItems');
      localStorage.removeItem('workflowSteps');
      localStorage.removeItem('notifications');

      // Save clean state
      this.saveToLocalStorage();

      console.log('🧹 All data cleared for production reset');
    } catch (error) {
      console.error('Error clearing data:', error);
    }
  }

  // Get production status
  getProductionStatus(): { isClean: boolean; userCount: number; itemCount: number } {
    return {
      isClean: this.users.length <= 1 && this.items.length === 0,
      userCount: this.users.length,
      itemCount: this.items.length
    };
  }

  // Create sub-items for photographer lot
  async createSubItems(originalItemId: string, subItemCount: number): Promise<AuctionItem[]> {
    try {
      // Call the API endpoint to create sub-items
      const response = await fetch(`/api/auction-items/${originalItemId}/create-sub-items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ subItemCount })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || 'Failed to create sub-items');
      }

      const result = await response.json();
      console.log(`✅ Created ${result.subItems.length} sub-items for item ${originalItemId} - All items set to HIGH priority`);

      // Refresh the items list to include the new sub-items
      await this.getItems();

      return result.subItems;
    } catch (error) {
      console.error('Error creating sub-items:', error);
      throw error;
    }
  }

  private processImageUrls(urls: string | string[]): string[] {
    if (!urls) {
      console.log('🔍 No image URLs provided');
      return [];
    }

    if (typeof urls === 'string') {
      console.log('🔍 Processing image URLs string:', urls);
      // Split by comma and filter out empty strings
      const urlArray = urls.split(',').map(url => url.trim()).filter(url => url.length > 0);
      console.log('✅ Processed image URLs:', urlArray);
      return urlArray;
    }

    if (Array.isArray(urls)) {
      console.log('🔍 Processing image URLs array:', urls);
      const urlArray = urls.map(url => url.trim()).filter(url => url.length > 0);
      console.log('✅ Processed image URLs:', urlArray);
      return urlArray;
    }

    console.log('⚠️ No valid image URLs found:', urls);
    return [];
  }

  // Send researcher progression webhook
  private async sendResearcherProgressionWebhook(itemId: string): Promise<void> {
    try {
      const item = this.getItem(itemId);
      if (!item) {
        console.error('❌ Item not found for webhook:', itemId);
        return;
      }

      console.log('📤 Sending researcher progression webhook for item:', item.itemName);

      const response = await fetch('/api/webhook/send-researcher-progression', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ itemData: item }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Researcher progression webhook sent successfully:', result.message);
      } else {
        const errorData = await response.json();
        console.error('❌ Researcher progression webhook failed:', errorData);
      }
    } catch (error) {
      console.error('❌ Error sending researcher progression webhook:', error);
    }
  }
}

export const dataStore = new DataStore();
