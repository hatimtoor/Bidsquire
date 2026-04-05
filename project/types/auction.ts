export interface AuctionItem {
  id: string;
  url?: string;
  url_main?: string; // Alternative URL field name from webhook data
  auctionName?: string;
  lotNumber?: string;
  images?: string[];
  mainImageUrl?: string; // Add main image URL field
  sku?: string;
  itemName?: string;
  category?: string;
  description?: string;
  lead?: string;
  auctionSiteEstimate?: string;
  aiDescription?: string;
  aiEstimate?: string;
  status: 'processing' | 'research' | 'winning' | 'photography' | 'research2' | 'admin_review' | 'finalized';
  researcherEstimate?: string;
  researcherDescription?: string;
  referenceUrls?: string[];
  similarUrls?: string[]; // New field for similar item URLs
  photographerQuantity?: number;
  photographerImages?: string[];
  isMultipleItems?: boolean; // New field to mark if item has multiple pieces
  multipleItemsCount?: number; // New field to specify how many items
  finalData?: any;
  createdAt: Date;
  updatedAt: Date;
  assignedTo?: string;
  notes?: string;
  photographerNotes?: string; // Separate notes for photographer
  researcherNotes?: string; // Notes from researcher 1
  researcher2Notes?: string; // Notes from researcher 2
  priority?: 'low' | 'medium' | 'high';
  tags?: string[];
  parentItemId?: string; // For sub-items, reference to parent item
  subItemNumber?: number; // For sub-items, the number (1, 2, 3, etc.)
  adminId?: string; // ID of the admin who fetched/created this item
  adminEmail?: string; // Email of the admin who fetched/created this item
  orgId?: string; // Organization this item belongs to
  researcher2Estimate?: string;
  researcher2Description?: string;
}

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  password: string;
  role: 'researcher' | 'photographer' | 'researcher2' | 'admin' | 'super_admin';
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  isTrial?: boolean;
  avatar?: string;
  createdBy?: string;
  orgId?: string;
  ebayConnected?: boolean;
  ebayUserId?: string;
}

export interface WorkflowStep {
  id: string;
  itemId: string;
  fromStatus: AuctionItem['status'];
  toStatus: AuctionItem['status'];
  userId: string;
  userName: string;
  timestamp: Date;
  notes?: string;
  data?: any;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'item_assigned' | 'status_change' | 'new_item' | 'reminder';
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
  itemId?: string;
}

export interface DashboardStats {
  total: number;
  research: number;
  winning: number;
  photography: number;
  research2: number;
  finalized: number;
  myItems: number;
  overdue: number;
}

// Credit Management Interfaces
export interface UserCredits {
  id: string;
  userId: string;
  currentCredits: number;
  totalPurchased: number;
  lastTopupDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreditTransaction {
  id: string;
  userId: string;
  transactionType: 'purchase' | 'deduction' | 'topup';
  amount: number;
  description: string;
  createdAt: Date;
}

export interface CreditSettings {
  id: string;
  settingName: string;
  settingValue: number;
  description: string;
  updatedBy?: string;
  updatedAt: Date;
}

export interface CreditBalance {
  currentCredits: number;
  totalPurchased: number;
  isLowBalance: boolean; // true if credits <= 10
}
