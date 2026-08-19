'use client';

// Metro Manager dashboard — UX-only build (no backend yet). Mock data + the two
// core flows: assign an unassigned auction to an operator, and add a team member.
// Role-gated to admin / super_admin for now; a dedicated `metro_manager` role
// would replace that gate once the backend lands. See vault: Metro Manager (Build Scope).

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  LayoutDashboard,
  Gavel,
  Users,
  Map as MapIcon,
  Settings,
  Search,
  Plus,
  ArrowRight,
  Loader2,
  Mail,
  KeyRound,
  MapPin,
} from 'lucide-react';
import { toast } from 'sonner';

// ── Mock data ───────────────────────────────────────────────────────────────

interface Operator {
  id: number;
  name: string;
  county: string;
  auctions: number;
  items: number;
}

type AuctionStatus = 'new' | 'uploading' | 'listed' | 'sold';

interface Auction {
  id: number;
  name: string;
  site: string;
  county: string;
  operator: string | null;
  lots: number | string;
  status: AuctionStatus;
  closes: string;
}

interface County {
  name: string;
  state: 'NY' | 'CT' | 'NJ';
  active: number; // active operators/auctions in this county
}

const INITIAL_TEAM: Operator[] = [
  { id: 1, name: 'Marcus Reed', county: 'Westchester, NY', auctions: 3, items: 41 },
  { id: 2, name: 'Dana Cole', county: 'Bergen & Hudson, NJ', auctions: 2, items: 28 },
  { id: 3, name: 'Priya Nair', county: 'Nassau, NY', auctions: 1, items: 12 },
  { id: 4, name: 'Luis Ortega', county: 'Suffolk, NY', auctions: 2, items: 33 },
];

const INITIAL_AUCTIONS: Auction[] = [
  { id: 1, name: 'Yonkers Estate — Mid-Century Modern', site: 'HiBid · Empire Auctions', county: 'Westchester', operator: 'Marcus Reed', lots: 87, status: 'listed', closes: 'Aug 22' },
  { id: 2, name: 'Paramus Storage Units 40–52', site: 'HiBid · North NJ Storage', county: 'Bergen', operator: 'Dana Cole', lots: 64, status: 'uploading', closes: 'Aug 20' },
  { id: 3, name: 'Hempstead Estate Liquidation', site: 'HiBid · LI Estate Co.', county: 'Nassau', operator: 'Priya Nair', lots: 112, status: 'new', closes: 'Aug 25' },
  { id: 4, name: 'Riverhead Farm Auction', site: 'HiBid · East End Auctions', county: 'Suffolk', operator: 'Luis Ortega', lots: 53, status: 'listed', closes: 'Aug 21' },
  { id: 5, name: 'Stamford Downsizing Sale', site: 'HiBid · Gold Coast Sales', county: 'Fairfield', operator: null, lots: 78, status: 'new', closes: 'Aug 24' },
  { id: 6, name: 'Morristown Antiques Lot', site: 'HiBid · Morris Auction House', county: 'Morris', operator: null, lots: 45, status: 'new', closes: 'Aug 26' },
];

// The full 21-county roster for Yanni's NYC Metro (Paul, Aug 2026).
const COUNTIES: County[] = [
  { name: 'Manhattan', state: 'NY', active: 0 },
  { name: 'Brooklyn', state: 'NY', active: 0 },
  { name: 'Queens', state: 'NY', active: 0 },
  { name: 'Bronx', state: 'NY', active: 0 },
  { name: 'Staten Island', state: 'NY', active: 0 },
  { name: 'Westchester', state: 'NY', active: 3 },
  { name: 'Rockland', state: 'NY', active: 0 },
  { name: 'Putnam', state: 'NY', active: 0 },
  { name: 'Suffolk', state: 'NY', active: 2 },
  { name: 'Nassau', state: 'NY', active: 1 },
  { name: 'Fairfield', state: 'CT', active: 1 },
  { name: 'New Haven', state: 'CT', active: 0 },
  { name: 'Bergen', state: 'NJ', active: 2 },
  { name: 'Hudson', state: 'NJ', active: 1 },
  { name: 'Passaic', state: 'NJ', active: 0 },
  { name: 'Essex', state: 'NJ', active: 0 },
  { name: 'Union', state: 'NJ', active: 0 },
  { name: 'Morris', state: 'NJ', active: 0 },
  { name: 'Middlesex', state: 'NJ', active: 0 },
  { name: 'Somerset', state: 'NJ', active: 0 },
  { name: 'Monmouth', state: 'NJ', active: 0 },
];

const STATUS: Record<AuctionStatus, { label: string; className: string }> = {
  new: { label: 'New', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  uploading: { label: 'Uploading', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  listed: { label: 'Listed', className: 'bg-green-100 text-green-700 border-green-200' },
  sold: { label: 'Sold', className: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
};

function initials(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function MetroManagerPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [team, setTeam] = useState<Operator[]>(INITIAL_TEAM);
  const [auctions, setAuctions] = useState<Auction[]>(INITIAL_AUCTIONS);

  const [addOpen, setAddOpen] = useState(false);
  const [assignId, setAssignId] = useState<number | null>(null);
  const [findOpen, setFindOpen] = useState(false);

  // Add-member form
  const [memberName, setMemberName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberCounty, setMemberCounty] = useState('Westchester, NY');
  const [pwMethod, setPwMethod] = useState<'link' | 'manual'>('link');

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login');
    } else if (user && user.role !== 'admin' && user.role !== 'super_admin') {
      router.push('/admin');
    }
  }, [user, isLoading, router]);

  const countiesActive = useMemo(() => COUNTIES.filter((c) => c.active > 0).length, []);
  const assigning = auctions.find((a) => a.id === assignId) || null;
  const unassignedCount = auctions.filter((a) => !a.operator).length;

  const assignTo = (operator: Operator) => {
    if (assignId === null) return;
    setAuctions((prev) =>
      prev.map((a) => (a.id === assignId ? { ...a, operator: operator.name, status: 'uploading' } : a))
    );
    setAssignId(null);
    toast.success(`Assigned to ${operator.name}`);
  };

  const addMember = () => {
    if (!memberName.trim() || !memberEmail.trim()) {
      toast.error('Name and email are required.');
      return;
    }
    setTeam((prev) => [
      ...prev,
      { id: Date.now(), name: memberName.trim(), county: memberCounty, auctions: 0, items: 0 },
    ]);
    toast.success(
      pwMethod === 'link'
        ? `Set-up link emailed to ${memberEmail.trim()}`
        : `${memberName.trim()} added — send them their password`
    );
    setAddOpen(false);
    setMemberName('');
    setMemberEmail('');
    setMemberCounty('Westchester, NY');
    setPwMethod('link');
  };

  const addFoundAuction = (county: string) => {
    setAuctions((prev) => [
      ...prev,
      {
        id: Date.now(),
        name: 'New auction from HiBid',
        site: 'HiBid · pending scrape',
        county,
        operator: null,
        lots: '—',
        status: 'new',
        closes: '—',
      },
    ]);
    setFindOpen(false);
    toast.success('Added to territory — assign it to an operator.');
  };

  if (isLoading || !user || (user.role !== 'admin' && user.role !== 'super_admin')) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading...</span>
      </div>
    );
  }

  const nav = [
    { label: 'Overview', icon: LayoutDashboard, active: true },
    { label: 'Auctions', icon: Gavel, active: false },
    { label: 'Team', icon: Users, active: false },
    { label: 'Counties', icon: MapIcon, active: false },
    { label: 'Settings', icon: Settings, active: false },
  ];

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r bg-white sticky top-0 h-screen">
        <div className="px-5 py-5 text-lg font-bold tracking-tight">Bidsquire</div>
        <div className="mx-3 mb-4 rounded-lg border bg-gray-50 px-3 py-2.5">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Metro</div>
          <div className="text-base font-semibold text-gray-900">New York</div>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {nav.map((n) => (
            <div
              key={n.label}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm ${
                n.active ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600'
              }`}
            >
              <n.icon className="h-4 w-4" />
              {n.label}
            </div>
          ))}
        </nav>
        <div className="m-3 flex items-center gap-3 border-t pt-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-900 text-sm font-semibold text-white">
            Y
          </div>
          <div className="leading-tight">
            <div className="text-sm font-medium text-gray-900">Yanni</div>
            <div className="text-xs text-gray-400">Metro manager</div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="min-w-0 flex-1">
        {/* Header */}
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b bg-white px-6 py-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-gray-900">New York Metro</h1>
            <p className="text-sm text-gray-500">Territory overview · {COUNTIES.length} counties held</p>
          </div>
          <div className="relative hidden sm:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input placeholder="Search auctions, people…" className="w-56 pl-9" />
          </div>
          <Button variant="outline" onClick={() => setFindOpen(true)}>
            <Search className="mr-2 h-4 w-4" />
            Find auction
          </Button>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add member
          </Button>
        </div>

        <div className="space-y-7 px-6 py-6">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            {[
              { n: COUNTIES.length, l: 'Counties held' },
              { n: team.length, l: 'Active operators' },
              { n: auctions.length, l: 'Auctions in progress' },
              { n: 147, l: 'Items this week' },
              { n: 89, l: 'Listed on eBay' },
            ].map((s) => (
              <Card key={s.l}>
                <CardContent className="p-4">
                  <div className="text-3xl font-bold tabular-nums text-gray-900">{s.n}</div>
                  <div className="mt-1 text-sm text-gray-500">{s.l}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Auctions */}
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold text-gray-900">Auctions</h2>
              <Badge variant="outline" className="text-gray-500">
                {auctions.length} in progress · {unassignedCount} need assigning
              </Badge>
            </div>
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Auction</TableHead>
                        <TableHead>County</TableHead>
                        <TableHead>Operator</TableHead>
                        <TableHead>Lots</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Closes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auctions.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell>
                            <div className="font-medium text-gray-900">{a.name}</div>
                            <div className="text-xs text-gray-400">{a.site}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-800">
                              {a.county}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {a.operator ? (
                              <div className="flex items-center gap-2">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-800 text-[10px] font-semibold text-white">
                                  {initials(a.operator)}
                                </span>
                                <span className="text-sm text-gray-700">{a.operator}</span>
                              </div>
                            ) : (
                              <Button
                                variant="link"
                                className="h-auto p-0 text-blue-600"
                                onClick={() => setAssignId(a.id)}
                              >
                                Assign
                                <ArrowRight className="ml-1 h-3.5 w-3.5" />
                              </Button>
                            )}
                          </TableCell>
                          <TableCell className="tabular-nums text-gray-700">{a.lots}</TableCell>
                          <TableCell>
                            <Badge className={STATUS[a.status].className}>{STATUS[a.status].label}</Badge>
                          </TableCell>
                          <TableCell className="text-gray-500">{a.closes}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Two columns */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Team roster */}
            <div>
              <div className="mb-3 flex items-center gap-3">
                <h2 className="text-lg font-semibold text-gray-900">Team</h2>
                <Badge variant="outline" className="text-gray-500">{team.length} operators</Badge>
              </div>
              <Card>
                <CardContent className="p-0">
                  {team.map((t, i) => (
                    <div
                      key={t.id}
                      className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t' : ''}`}
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-900 text-sm font-semibold text-white">
                        {initials(t.name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-gray-900">{t.name}</div>
                        <div className="text-xs text-gray-400">{t.county}</div>
                      </div>
                      <div className="text-right text-xs text-gray-500">
                        <span className="block text-base font-semibold tabular-nums text-gray-800">
                          {t.auctions}
                        </span>
                        auctions · {t.items} items
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* County coverage */}
            <div>
              <div className="mb-3 flex items-center gap-3">
                <h2 className="text-lg font-semibold text-gray-900">County coverage</h2>
                <Badge variant="outline" className="text-gray-500">
                  {COUNTIES.length} held · {countiesActive} active
                </Badge>
              </div>
              <Card>
                <CardContent className="grid grid-cols-2 gap-2 p-4">
                  {COUNTIES.map((c) => {
                    const active = c.active > 0;
                    return (
                      <div
                        key={`${c.name}-${c.state}`}
                        className={`flex items-center justify-between rounded-md border px-3 py-2 ${
                          active ? 'border-green-200 bg-green-50' : ''
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-gray-800">
                            {c.name}
                            <span className="ml-1 text-xs font-normal text-gray-400">{c.state}</span>
                          </div>
                          <div className={`text-xs ${active ? 'text-green-600' : 'text-gray-400'}`}>
                            {active ? `${c.active} active` : 'held · idle'}
                          </div>
                        </div>
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${active ? 'bg-green-500' : 'bg-gray-300'}`}
                        />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Add member modal */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add a team member</DialogTitle>
            <DialogDescription>
              They&apos;ll get their own login, walled off from everyone else on the metro.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="m-name">Full name</Label>
              <Input id="m-name" value={memberName} onChange={(e) => setMemberName(e.target.value)} placeholder="e.g. Sam Whitfield" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-email">Email</Label>
              <Input id="m-email" type="email" value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} placeholder="sam@email.com" />
            </div>
            <div className="space-y-1.5">
              <Label>
                Home county <span className="font-normal text-gray-400">(where they&apos;re based)</span>
              </Label>
              <Select value={memberCounty} onValueChange={setMemberCounty}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTIES.map((c) => (
                    <SelectItem key={`${c.name}-${c.state}`} value={`${c.name}, ${c.state}`}>
                      {c.name}, {c.state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>How do they get their password?</Label>
              <RadioGroup value={pwMethod} onValueChange={(v) => setPwMethod(v as 'link' | 'manual')} className="gap-2">
                <label
                  htmlFor="pw-link"
                  className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 ${
                    pwMethod === 'link' ? 'border-blue-300 bg-blue-50/50' : ''
                  }`}
                >
                  <RadioGroupItem value="link" id="pw-link" className="mt-0.5" />
                  <div>
                    <div className="flex items-center gap-1.5 text-sm font-medium">
                      <Mail className="h-3.5 w-3.5" /> Email them a set-up link
                    </div>
                    <div className="text-xs text-gray-500">
                      They click a link and choose their own password. Nothing to hand over.
                    </div>
                  </div>
                </label>
                <label
                  htmlFor="pw-manual"
                  className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 ${
                    pwMethod === 'manual' ? 'border-blue-300 bg-blue-50/50' : ''
                  }`}
                >
                  <RadioGroupItem value="manual" id="pw-manual" className="mt-0.5" />
                  <div>
                    <div className="flex items-center gap-1.5 text-sm font-medium">
                      <KeyRound className="h-3.5 w-3.5" /> I&apos;ll set it and send it to them
                    </div>
                    <div className="text-xs text-gray-500">
                      You create the password now and pass it along yourself.
                    </div>
                  </div>
                </label>
              </RadioGroup>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={addMember}>Add member</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign modal */}
      <Dialog open={assignId !== null} onOpenChange={(o) => !o && setAssignId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign this auction</DialogTitle>
            <DialogDescription>
              {assigning ? `Choose who runs "${assigning.name}". Only they will see it.` : 'Choose who runs it.'}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {team.map((t) => (
              <button
                key={t.id}
                onClick={() => assignTo(t)}
                className="flex w-full items-center gap-3 rounded-md border p-3 text-left hover:border-blue-300 hover:bg-blue-50/50"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white">
                  {initials(t.name)}
                </span>
                <div>
                  <div className="text-sm font-medium text-gray-900">{t.name}</div>
                  <div className="text-xs text-gray-400">{t.county} · {t.auctions} active</div>
                </div>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignId(null)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Find auction modal */}
      <FindAuctionDialog open={findOpen} onOpenChange={setFindOpen} onAdd={addFoundAuction} />
    </div>
  );
}

// Small local component so the county selection has its own state.
function FindAuctionDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onAdd: (county: string) => void;
}) {
  const [county, setCounty] = useState('Fairfield');
  const [url, setUrl] = useState('');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Find an upcoming auction</DialogTitle>
          <DialogDescription>Search HiBid inside your territory, then hand it to someone.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>County</Label>
            <Select value={county} onValueChange={setCounty}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COUNTIES.map((c) => (
                  <SelectItem key={`${c.name}-${c.state}`} value={c.name}>
                    {c.name}, {c.state}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="find-url" className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> Paste a HiBid auction URL
            </Label>
            <Input
              id="find-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://hibid.com/catalog/…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => onAdd(county)}>Add to territory</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
