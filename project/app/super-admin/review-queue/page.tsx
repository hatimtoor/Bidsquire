'use client';

import { useEffect, useState, useCallback, type ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  ClipboardCheck,
  Check,
  X,
  ExternalLink,
  ImageOff,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from 'lucide-react';

interface Comparable {
  title?: string | null;
  price?: number | string | null;
  url?: string | null;
}

interface FinalData {
  topComps?: Comparable[] | null;
  warnings?: string[] | null;
  confidenceScore?: number | null;
}

interface ReviewItem {
  id: string;
  item_name: string | null;
  lot_number: string | null;
  auction_name: string | null;
  status: string | null;
  critic_verdict: string | null;
  critic_notes: string | null;
  researcher_estimate: string | null;
  ai_description: string | null;
  description: string | null;
  main_image_url: string | null;
  url_main: string | null;
  images: string[] | null;
  notes: string | null;
  final_data: FinalData | null;
  category: string | null;
  priority: string | null;
  review_status: string | null;
  review_stage: string | null;
  created_at: string | null;
}

type Stage = 'stage1' | 'stage2';

const VERDICTS: Record<string, { label: string; className: string }> = {
  A: { label: 'Gold standard', className: 'bg-green-100 text-green-800 border-green-200' },
  B: { label: 'Asking prices', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  C: { label: 'Weak comparables', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  D: { label: 'No usable data', className: 'bg-red-100 text-red-800 border-red-200' },
};

function VerdictBadge({ verdict }: { verdict: string | null }) {
  const key = (verdict || '').toUpperCase();
  const info = VERDICTS[key];
  if (!info) {
    return (
      <Badge className="bg-gray-100 text-gray-700 border-gray-200">Unscored</Badge>
    );
  }
  return <Badge className={info.className}>{`${key} — ${info.label}`}</Badge>;
}

// Confidence may be stored as a 0–1 fraction or a 0–100 percentage; normalise.
function confidenceInfo(score: number | null | undefined) {
  if (score === null || score === undefined || Number.isNaN(Number(score))) {
    return null;
  }
  const value = Number(score);
  const pct = value <= 1 ? value * 100 : value;
  const rounded = Math.round(pct);
  const color = pct >= 70 ? 'text-green-600' : pct >= 40 ? 'text-yellow-600' : 'text-red-600';
  return { pct: rounded, color };
}

function formatPrice(price: number | string | null | undefined): string {
  if (price === null || price === undefined || price === '') return '';
  if (typeof price === 'number') return `$${price}`;
  const str = String(price).trim();
  return str.startsWith('$') ? str : `$${str}`;
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400">{children}</h4>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return <p className="text-sm text-gray-400 italic">{children}</p>;
}

function ItemDetail({ item }: { item: ReviewItem }) {
  const finalData = item.final_data || {};
  const comps = Array.isArray(finalData.topComps) ? finalData.topComps : [];
  const warnings = Array.isArray(finalData.warnings)
    ? finalData.warnings.filter((w) => w && w.trim())
    : [];
  const confidence = confidenceInfo(finalData.confidenceScore);
  const images = Array.isArray(item.images) ? item.images.filter(Boolean) : [];

  return (
    <div className="mt-4 pt-4 border-t space-y-5">
      {/* Confidence score */}
      <div className="space-y-1">
        <SectionLabel>Confidence</SectionLabel>
        {confidence ? (
          <p className={`text-lg font-bold ${confidence.color}`}>{confidence.pct}%</p>
        ) : (
          <EmptyState>No confidence score recorded</EmptyState>
        )}
      </div>

      {/* Warnings */}
      <div className="space-y-1">
        <SectionLabel>Warnings</SectionLabel>
        {warnings.length > 0 ? (
          <div className="space-y-1">
            {warnings.map((warning, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
              >
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span className="whitespace-pre-line">{warning}</span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState>No warnings recorded</EmptyState>
        )}
      </div>

      {/* Top comparables */}
      <div className="space-y-1">
        <SectionLabel>Top comparables</SectionLabel>
        {comps.length > 0 ? (
          <ul className="space-y-1">
            {comps.map((comp, idx) => (
              <li
                key={idx}
                className="flex items-center justify-between gap-3 rounded-md border bg-gray-50 px-3 py-2 text-sm"
              >
                <span className="min-w-0 flex-1 truncate text-gray-700">
                  {comp.title || 'Untitled comparable'}
                </span>
                {formatPrice(comp.price) ? (
                  <span className="shrink-0 font-semibold text-gray-900">
                    {formatPrice(comp.price)}
                  </span>
                ) : null}
                {comp.url ? (
                  <a
                    href={comp.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 text-blue-600 hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    View
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState>No comparables recorded</EmptyState>
        )}
      </div>

      {/* AI description */}
      <div className="space-y-1">
        <SectionLabel>AI description</SectionLabel>
        {item.ai_description ? (
          <p className="text-sm text-gray-600 whitespace-pre-line">{item.ai_description}</p>
        ) : (
          <EmptyState>No AI description recorded</EmptyState>
        )}
      </div>

      {/* Auction description */}
      <div className="space-y-1">
        <SectionLabel>Auction description</SectionLabel>
        {item.description ? (
          <p className="text-sm text-gray-600 whitespace-pre-line">{item.description}</p>
        ) : (
          <EmptyState>No description recorded</EmptyState>
        )}
      </div>

      {/* Notes */}
      <div className="space-y-1">
        <SectionLabel>Notes</SectionLabel>
        {item.notes ? (
          <p className="text-sm text-gray-600 whitespace-pre-line">{item.notes}</p>
        ) : (
          <EmptyState>No notes recorded</EmptyState>
        )}
      </div>

      {/* Image gallery */}
      <div className="space-y-1">
        <SectionLabel>Images</SectionLabel>
        {images.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {images.map((src, idx) => (
              <a
                key={idx}
                href={src}
                target="_blank"
                rel="noopener noreferrer"
                title="Open full size"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={`${item.item_name || 'Item'} image ${idx + 1}`}
                  className="h-16 w-16 rounded-md object-cover border bg-gray-50 hover:opacity-80"
                />
              </a>
            ))}
          </div>
        ) : (
          <EmptyState>No additional images</EmptyState>
        )}
      </div>
    </div>
  );
}

export default function ReviewQueuePage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [stage, setStage] = useState<Stage>('stage1');
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpanded = (itemId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login');
    } else if (user && user.role !== 'super_admin') {
      router.push('/admin');
    }
  }, [user, isLoading, router]);

  const fetchItems = useCallback(async (targetStage: Stage) => {
    setIsLoadingData(true);
    try {
      const res = await fetch(`/api/super-admin/review-queue?stage=${targetStage}`, {
        credentials: 'same-origin',
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (error) {
      console.error('Error loading review queue:', error);
      setItems([]);
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (user && user.role === 'super_admin') {
      fetchItems(stage);
    }
  }, [user, stage, fetchItems]);

  const switchStage = (next: Stage) => {
    if (next === stage) return;
    setRejectingId(null);
    setRejectionReason('');
    setStage(next);
  };

  const submitDecision = async (
    itemId: string,
    action: 'approved' | 'rejected',
    reason?: string
  ) => {
    setProcessingId(itemId);
    try {
      const res = await fetch('/api/super-admin/review-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ itemId, action, rejectionReason: reason }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      // Optimistically remove from the list
      setItems((prev) => prev.filter((it) => it.id !== itemId));
      setRejectingId(null);
      setRejectionReason('');
    } catch (error) {
      console.error('Error submitting review decision:', error);
    } finally {
      setProcessingId(null);
    }
  };

  if (isLoading || !user || user.role !== 'super_admin') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-left space-y-2">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <ClipboardCheck className="h-7 w-7" />
          Review Queue
        </h1>
        <p className="text-gray-600">Approve or reject pending AI item evaluations</p>
      </div>

      <div className="flex gap-2">
        <Button
          variant={stage === 'stage1' ? 'default' : 'outline'}
          onClick={() => switchStage('stage1')}
        >
          Stage 1 Approvals
        </Button>
        <Button
          variant={stage === 'stage2' ? 'default' : 'outline'}
          onClick={() => switchStage('stage2')}
        >
          Stage 2 Approvals
        </Button>
      </div>

      {isLoadingData ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading items...</span>
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-gray-500">
            No pending items in {stage === 'stage1' ? 'Stage 1' : 'Stage 2'}.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <Card key={item.id}>
              <CardContent className="p-4">
                <div className="flex gap-4">
                  <div className="shrink-0">
                    {item.main_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.main_image_url}
                        alt={item.item_name || 'Item'}
                        className="h-24 w-24 rounded-md object-cover border bg-gray-50"
                      />
                    ) : (
                      <div className="h-24 w-24 rounded-md border bg-gray-50 flex items-center justify-center text-gray-300">
                        <ImageOff className="h-8 w-8" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {item.lot_number ? (
                        <Badge variant="outline">Lot {item.lot_number}</Badge>
                      ) : null}
                      <VerdictBadge verdict={item.critic_verdict} />
                      {item.category ? (
                        <span className="text-xs text-gray-400">{item.category}</span>
                      ) : null}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-auto text-gray-500"
                        onClick={() => toggleExpanded(item.id)}
                        aria-expanded={expandedIds.has(item.id)}
                      >
                        {expandedIds.has(item.id) ? (
                          <>
                            Hide details
                            <ChevronUp className="ml-1 h-4 w-4" />
                          </>
                        ) : (
                          <>
                            Details
                            <ChevronDown className="ml-1 h-4 w-4" />
                          </>
                        )}
                      </Button>
                    </div>

                    <div>
                      <p className="text-sm text-gray-500 truncate">
                        {item.auction_name || 'Unknown auction'}
                      </p>
                      <h3 className="font-semibold text-gray-900 truncate">
                        {item.item_name || 'Unnamed item'}
                      </h3>
                    </div>

                    {item.critic_notes ? (
                      <p className="text-sm text-gray-600 whitespace-pre-line">
                        {item.critic_notes}
                      </p>
                    ) : null}

                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      {item.researcher_estimate ? (
                        <span className="text-gray-700">
                          <span className="text-gray-400">Estimate:</span>{' '}
                          {item.researcher_estimate}
                        </span>
                      ) : null}
                      {item.url_main ? (
                        <a
                          href={item.url_main}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          View listing
                        </a>
                      ) : null}
                    </div>

                    {rejectingId === item.id ? (
                      <div className="space-y-2 pt-1">
                        <input
                          type="text"
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          placeholder="Reason for rejection"
                          className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={processingId === item.id || !rejectionReason.trim()}
                            onClick={() =>
                              submitDecision(item.id, 'rejected', rejectionReason.trim())
                            }
                          >
                            {processingId === item.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              'Confirm reject'
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setRejectingId(null);
                              setRejectionReason('');
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          disabled={processingId === item.id}
                          onClick={() => submitDecision(item.id, 'approved')}
                        >
                          {processingId === item.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Check className="mr-1 h-4 w-4" />
                              Approve
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setRejectingId(item.id);
                            setRejectionReason('');
                          }}
                        >
                          <X className="mr-1 h-4 w-4" />
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {expandedIds.has(item.id) ? <ItemDetail item={item} /> : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
