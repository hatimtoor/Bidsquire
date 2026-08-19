// The NYC Metro territory definition (Paul, Aug 2026). The county roster is
// configuration, not user data — a metro "holds" these counties; auctions are
// tagged with one of them. Kept here so the API and any UI share one source.

export interface MetroCounty {
  name: string;
  state: 'NY' | 'CT' | 'NJ';
}

export const NYC_METRO_COUNTIES: MetroCounty[] = [
  { name: 'Manhattan', state: 'NY' },
  { name: 'Brooklyn', state: 'NY' },
  { name: 'Queens', state: 'NY' },
  { name: 'Bronx', state: 'NY' },
  { name: 'Staten Island', state: 'NY' },
  { name: 'Westchester', state: 'NY' },
  { name: 'Rockland', state: 'NY' },
  { name: 'Putnam', state: 'NY' },
  { name: 'Suffolk', state: 'NY' },
  { name: 'Nassau', state: 'NY' },
  { name: 'Fairfield', state: 'CT' },
  { name: 'New Haven', state: 'CT' },
  { name: 'Bergen', state: 'NJ' },
  { name: 'Hudson', state: 'NJ' },
  { name: 'Passaic', state: 'NJ' },
  { name: 'Essex', state: 'NJ' },
  { name: 'Union', state: 'NJ' },
  { name: 'Morris', state: 'NJ' },
  { name: 'Middlesex', state: 'NJ' },
  { name: 'Somerset', state: 'NJ' },
  { name: 'Monmouth', state: 'NJ' },
];

export type MetroAuctionStatus = 'new' | 'uploading' | 'listed' | 'sold';

// Roles that act as the manager over a metro territory.
export const METRO_MANAGER_ROLES = ['metro_manager', 'admin', 'super_admin'];
