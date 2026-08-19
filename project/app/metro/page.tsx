'use client';

// Metro Manager dashboard — live against /api/metro/*. The manager sees the whole
// territory, provisions operators, finds auctions, and assigns each to one person
// (assignment is the visibility boundary: operators only see their own auctions).
// Role-gated to metro_manager / admin / super_admin.

import { useEffect, useState, useCallback } from 'react';
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
import { NYC_METRO_COUNTIES } from '@/lib/metro';

interface Operator {
  id: string;
  name: string;
  county: string;
  auctions: number;
  items: number;
}
type AuctionStatus = 'new' | 'uploading' | 'listed' | 'sold';
interface Auction {
  id: string;
  name: string;
  site: string;
  county: string;
  operator: string | null;
  lots: number | string;
  status: AuctionStatus;
  closes: string;
}
interface Coverage { name: string; state: string; active: number; }
interface Stats {
  counties_held: number;
  active_operators: number;
  auctions_in_progress: number;
  items_this_week: number;
  listed_on_ebay: number;
}

const STATUS: Record<AuctionStatus, { label: string; className: string }> = {
  new: { label: 'New', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  uploading: { label: 'Uploading', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  listed: { label: 'Listed', className: 'bg-green-100 text-green-700 border-green-200' },
  sold: { label: 'Sold', className: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
};

const COUNTY_OPTIONS = NYC_METRO_COUNTIES.map((c) => ({ label: `${c.name}, ${c.state}`, value: c.name }));

function initials(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function MetroManagerPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const isManager =
    user?.role === 'metro_manager' || user?.role === 'admin' || user?.role === 'super_admin';

  const [metroName, setMetroName] = useState('New York Metro');
  const [team, setTeam] = useState<Operator[]>([]);
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [coverage, setCoverage] = useState<Coverage[]>(
    NYC_METRO_COUNTIES.map((c) => ({ name: c.name, state: c.state, active: 0 }))
  );
  const [stats, setStats] = useState<Stats>({
    counties_held: NYC_METRO_COUNTIES.length,
    active_operators: 0,
    auctions_in_progress: 0,
    items_this_week: 0,
    listed_on_ebay: 0,
  });
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [activeNav, setActiveNav] = useState('overview');

  const [addOpen, setAddOpen] = useState(false);
  const [assignId, setAssignId] = useState<string | null>(null);
  const [findOpen, setFindOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [memberName, setMemberName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberCounty, setMemberCounty] = useState(COUNTY_OPTIONS[0].value);
  const [pwMethod, setPwMethod] = useState<'link' | 'manual'>('link');
  const [manualPassword, setManualPassword] = useState('');

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login');
    } else if (user && !isManager) {
      router.push('/admin');
    }
  }, [user, isLoading, isManager, router]);

  const loadSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/metro/summary', { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMetroName(data.metroName || 'New York Metro');
      setTeam(Array.isArray(data.team) ? data.team : []);
      setAuctions(Array.isArray(data.auctions) ? data.auctions : []);
      if (Array.isArray(data.counties)) setCoverage(data.counties);
      if (data.stats) setStats(data.stats);
    } catch (err) {
      console.error('Error loading metro summary:', err);
      toast.error('Could not load the metro dashboard.');
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (user && isManager) loadSummary();
  }, [user, isManager, loadSummary]);

  const assigning = auctions.find((a) => a.id === assignId) || null;
  const unassignedCount = auctions.filter((a) => !a.operator).length;
  const countiesActive = coverage.filter((c) => c.active > 0).length;

  const assignTo = async (operator: Operator) => {
    if (!assignId) return;
    setBusy(true);
    try {
      const res = await fetch('/api/metro/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ auctionId: assignId, operatorId: operator.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      toast.success(`Assigned to ${operator.name}`);
      setAssignId(null);
      await loadSummary();
    } catch (err: any) {
      toast.error(err.message || 'Failed to assign auction.');
    } finally {
      setBusy(false);
    }
  };

  const addMember = async () => {
    if (!memberName.trim() || !memberEmail.trim()) {
      toast.error('Name and email are required.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/metro/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: memberName.trim(),
          email: memberEmail.trim(),
          homeCounty: memberCounty,
          pwMethod,
          password: pwMethod === 'manual' ? manualPassword : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      toast.success(
        pwMethod === 'link'
          ? `Set-up link emailed to ${memberEmail.trim()}`
          : `${memberName.trim()} added.`
      );
      setAddOpen(false);
      setMemberName('');
      setMemberEmail('');
      setMemberCounty(COUNTY_OPTIONS[0].value);
      setPwMethod('link');
      setManualPassword('');
      await loadSummary();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add member.');
    } finally {
      setBusy(false);
    }
  };

  const addFoundAuction = async (county: string, url: string) => {
    setBusy(true);
    try {
      const res = await fetch('/api/metro/auctions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ county, sourceUrl: url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      toast.success('Added to territory — assign it to an operator.');
      setFindOpen(false);
      await loadSummary();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add auction.');
    } finally {
      setBusy(false);
    }
  };

  if (isLoading || !user || !isManager) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading...</span>
      </div>
    );
  }

  const nav = [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'auctions', label: 'Auctions', icon: Gavel },
    { key: 'team', label: 'Team', icon: Users },
    { key: 'counties', label: 'Counties', icon: MapIcon },
    { key: 'settings', label: 'Settings', icon: Settings },
  ];

  // The dashboard is a single page; nav items jump to their section.
  const goToSection = (key: string) => {
    if (key === 'settings') {
      toast.info('Metro settings are coming soon.');
      return;
    }
    setActiveNav(key);
    document.getElementById(key)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const statCards = [
    { n: stats.counties_held, l: 'Counties held' },
    { n: stats.active_operators, l: 'Active operators' },
    { n: stats.auctions_in_progress, l: 'Auctions in progress' },
    { n: stats.items_this_week, l: 'Items this week' },
    { n: stats.listed_on_ebay, l: 'Listed on eBay' },
  ];

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r bg-white sticky top-0 h-screen">
        <div className="px-5 py-5 text-lg font-bold tracking-tight">Bidsquire</div>
        <div className="mx-3 mb-4 rounded-lg border bg-gray-50 px-3 py-2.5">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Metro</div>
          <div className="text-base font-semibold text-gray-900">{metroName}</div>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {nav.map((n) => (
            <button
              key={n.key}
              type="button"
              onClick={() => goToSection(n.key)}
              className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                activeNav === n.key
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <n.icon className="h-4 w-4" />
              {n.label}
            </button>
          ))}
        </nav>
        <div className="m-3 flex items-center gap-3 border-t pt-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-900 text-sm font-semibold text-white">
            {initials(user.name || 'M')}
          </div>
          <div className="leading-tight">
            <div className="text-sm font-medium text-gray-900">{user.name}</div>
            <div className="text-xs text-gray-400">Metro manager</div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="min-w-0 flex-1">
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b bg-white px-6 py-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-gray-900">{metroName}</h1>
            <p className="text-sm text-gray-500">Territory overview · {stats.counties_held} counties held</p>
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
          <div id="overview" className="grid grid-cols-2 gap-4 md:grid-cols-5 scroll-mt-24">
            {statCards.map((s) => (
              <Card key={s.l}>
                <CardContent className="p-4">
                  <div className="text-3xl font-bold tabular-nums text-gray-900">{s.n}</div>
                  <div className="mt-1 text-sm text-gray-500">{s.l}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Auctions */}
          <div id="auctions" className="scroll-mt-24">
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
                      {isLoadingData ? (
                        <TableRow>
                          <TableCell colSpan={6} className="py-10 text-center text-gray-400">
                            <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                          </TableCell>
                        </TableRow>
                      ) : auctions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="py-10 text-center text-gray-500">
                            No auctions yet. Use <b>Find auction</b> to add one to the territory.
                          </TableCell>
                        </TableRow>
                      ) : (
                        auctions.map((a) => (
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
                              <Badge className={STATUS[a.status]?.className || STATUS.new.className}>
                                {STATUS[a.status]?.label || a.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-gray-500">{a.closes}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Two columns */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div id="team" className="scroll-mt-24">
              <div className="mb-3 flex items-center gap-3">
                <h2 className="text-lg font-semibold text-gray-900">Team</h2>
                <Badge variant="outline" className="text-gray-500">{team.length} operators</Badge>
              </div>
              <Card>
                <CardContent className="p-0">
                  {team.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-gray-500">
                      No operators yet. Use <b>Add member</b> to invite someone.
                    </div>
                  ) : (
                    team.map((t, i) => (
                      <div key={t.id} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t' : ''}`}>
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
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            <div id="counties" className="scroll-mt-24">
              <div className="mb-3 flex items-center gap-3">
                <h2 className="text-lg font-semibold text-gray-900">County coverage</h2>
                <Badge variant="outline" className="text-gray-500">
                  {coverage.length} held · {countiesActive} active
                </Badge>
              </div>
              <Card>
                <CardContent className="grid grid-cols-2 gap-2 p-4">
                  {coverage.map((c) => {
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
                        <span className={`h-2 w-2 shrink-0 rounded-full ${active ? 'bg-green-500' : 'bg-gray-300'}`} />
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
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COUNTY_OPTIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>How do they get their password?</Label>
              <RadioGroup value={pwMethod} onValueChange={(v) => setPwMethod(v as 'link' | 'manual')} className="gap-2">
                <label htmlFor="pw-link" className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 ${pwMethod === 'link' ? 'border-blue-300 bg-blue-50/50' : ''}`}>
                  <RadioGroupItem value="link" id="pw-link" className="mt-0.5" />
                  <div>
                    <div className="flex items-center gap-1.5 text-sm font-medium"><Mail className="h-3.5 w-3.5" /> Email them a set-up link</div>
                    <div className="text-xs text-gray-500">They click a link and choose their own password. Nothing to hand over.</div>
                  </div>
                </label>
                <label htmlFor="pw-manual" className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 ${pwMethod === 'manual' ? 'border-blue-300 bg-blue-50/50' : ''}`}>
                  <RadioGroupItem value="manual" id="pw-manual" className="mt-0.5" />
                  <div>
                    <div className="flex items-center gap-1.5 text-sm font-medium"><KeyRound className="h-3.5 w-3.5" /> I&apos;ll set it and send it to them</div>
                    <div className="text-xs text-gray-500">You create the password now and pass it along yourself.</div>
                  </div>
                </label>
              </RadioGroup>
              {pwMethod === 'manual' && (
                <Input
                  type="text"
                  value={manualPassword}
                  onChange={(e) => setManualPassword(e.target.value)}
                  placeholder="Set a password (min 6 chars)"
                  className="mt-1"
                />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={addMember} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add member'}
            </Button>
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
            {team.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-500">Add a team member first.</p>
            ) : (
              team.map((t) => (
                <button
                  key={t.id}
                  disabled={busy}
                  onClick={() => assignTo(t)}
                  className="flex w-full items-center gap-3 rounded-md border p-3 text-left hover:border-blue-300 hover:bg-blue-50/50 disabled:opacity-60"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white">
                    {initials(t.name)}
                  </span>
                  <div>
                    <div className="text-sm font-medium text-gray-900">{t.name}</div>
                    <div className="text-xs text-gray-400">{t.county} · {t.auctions} active</div>
                  </div>
                </button>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignId(null)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Find auction modal */}
      <FindAuctionDialog open={findOpen} onOpenChange={setFindOpen} busy={busy} onAdd={addFoundAuction} />
    </div>
  );
}

function FindAuctionDialog({
  open,
  onOpenChange,
  busy,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  busy: boolean;
  onAdd: (county: string, url: string) => void;
}) {
  const [county, setCounty] = useState(COUNTY_OPTIONS[0].value);
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
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {COUNTY_OPTIONS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="find-url" className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> Paste a HiBid auction URL
            </Label>
            <Input id="find-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://hibid.com/catalog/…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={() => onAdd(county, url)} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add to territory'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
