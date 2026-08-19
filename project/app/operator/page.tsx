'use client';

// Operator dashboard. An operator sees ONLY the auctions assigned to them — the
// /api/metro/summary endpoint scopes to the caller when their role is 'operator',
// so this page can never surface another operator's work. Read-only for now
// (working an auction — uploading photos — rides the existing item pipeline).

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/layout/navbar';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, Gavel } from 'lucide-react';
import { toast } from 'sonner';

type AuctionStatus = 'new' | 'uploading' | 'listed' | 'sold';
interface Auction {
  id: string;
  name: string;
  site: string;
  county: string;
  lots: number | string;
  status: AuctionStatus;
  closes: string;
}

const STATUS: Record<AuctionStatus, { label: string; className: string }> = {
  new: { label: 'New', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  uploading: { label: 'Uploading', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  listed: { label: 'Listed', className: 'bg-green-100 text-green-700 border-green-200' },
  sold: { label: 'Sold', className: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
};

export default function OperatorPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [metroName, setMetroName] = useState('');
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login');
    } else if (user && user.role !== 'operator') {
      // Managers have their own board; everyone else goes home.
      router.push(user.role === 'metro_manager' ? '/metro' : '/');
    }
  }, [user, router, isLoading]);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/metro/summary', { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMetroName(data.metroName || '');
      setAuctions(Array.isArray(data.auctions) ? data.auctions : []);
    } catch (err) {
      console.error('Error loading operator auctions:', err);
      toast.error('Could not load your auctions.');
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (user && user.role === 'operator') load();
  }, [user, load]);

  if (isLoading || !user || user.role !== 'operator') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading...</span>
      </div>
    );
  }

  const totalLots = auctions.reduce((s, a) => s + (Number(a.lots) || 0), 0);
  const uploading = auctions.filter((a) => a.status === 'uploading' || a.status === 'new').length;
  const listed = auctions.filter((a) => a.status === 'listed' || a.status === 'sold').length;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="container mx-auto max-w-5xl space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My auctions</h1>
          <p className="text-gray-600">
            {user.name}
            {user.homeCounty ? ` · ${user.homeCounty}` : ''}
            {metroName ? ` · ${metroName}` : ''}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { n: auctions.length, l: 'Assigned to me' },
            { n: totalLots, l: 'Lots to process' },
            { n: uploading, l: 'In progress' },
            { n: listed, l: 'Listed / sold' },
          ].map((s) => (
            <Card key={s.l}>
              <CardContent className="p-4">
                <div className="text-3xl font-bold tabular-nums text-gray-900">{s.n}</div>
                <div className="mt-1 text-sm text-gray-500">{s.l}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Auction</TableHead>
                    <TableHead>County</TableHead>
                    <TableHead>Lots</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Closes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingData ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-12 text-center text-gray-400">
                        <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                      </TableCell>
                    </TableRow>
                  ) : auctions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-12 text-center text-gray-500">
                        <Gavel className="mx-auto mb-2 h-6 w-6 text-gray-300" />
                        Nothing assigned to you yet. Your manager will hand you auctions to run.
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
    </div>
  );
}
