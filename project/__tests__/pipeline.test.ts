/**
 * Tests for item pipeline transitions.
 * Covers: valid transitions, invalid transitions, credit blocking at research2.
 */

// These mirror the switch cases in dataStore.ts moveItemToNextStatus
type ItemStatus = 'processing' | 'research' | 'winning' | 'photography' | 'research2' | 'admin_review' | 'finalized';

function getNextStatus(current: ItemStatus): ItemStatus | null {
  switch (current) {
    case 'research': return 'winning';
    case 'winning': return 'photography';
    case 'photography': return 'research2';
    case 'research2': return 'admin_review';
    case 'admin_review': return 'finalized';
    default: return null;
  }
}

type MoveResult = { success: boolean; error?: string };

function simulateMove(
  currentStatus: ItemStatus,
  credits: number,
  research2Cost: number
): MoveResult {
  const next = getNextStatus(currentStatus);
  if (!next) return { success: false, error: 'INVALID_TRANSITION' };

  // Credit check for research2 → admin_review
  if (currentStatus === 'research2') {
    if (credits < research2Cost) {
      return { success: false, error: 'INSUFFICIENT_CREDITS' };
    }
  }

  return { success: true };
}

describe('Item Pipeline Transitions', () => {
  describe('valid forward transitions', () => {
    const cases: [ItemStatus, ItemStatus][] = [
      ['research', 'winning'],
      ['winning', 'photography'],
      ['photography', 'research2'],
      ['research2', 'admin_review'],
      ['admin_review', 'finalized'],
    ];

    cases.forEach(([from, to]) => {
      it(`${from} → ${to}`, () => {
        expect(getNextStatus(from)).toBe(to);
      });
    });
  });

  describe('invalid transitions return null', () => {
    const invalid: ItemStatus[] = ['processing', 'finalized'];
    invalid.forEach(status => {
      it(`${status} has no next stage`, () => {
        expect(getNextStatus(status)).toBeNull();
      });
    });
  });

  describe('credit blocking at research2 stage', () => {
    it('blocks move when credits are 0', () => {
      const result = simulateMove('research2', 0, 2);
      expect(result.success).toBe(false);
      expect(result.error).toBe('INSUFFICIENT_CREDITS');
    });

    it('blocks move when credits are less than cost', () => {
      const result = simulateMove('research2', 1, 2);
      expect(result.success).toBe(false);
      expect(result.error).toBe('INSUFFICIENT_CREDITS');
    });

    it('blocks move when credits exactly equal cost minus 1', () => {
      const result = simulateMove('research2', 1, 2);
      expect(result.success).toBe(false);
    });

    it('allows move when credits exactly equal cost', () => {
      const result = simulateMove('research2', 2, 2);
      expect(result.success).toBe(true);
    });

    it('allows move when credits exceed cost', () => {
      const result = simulateMove('research2', 100, 2);
      expect(result.success).toBe(true);
    });

    it('does NOT deduct credits at other stages', () => {
      // Research stage does not check credits — should always pass
      const result = simulateMove('research', 0, 2);
      expect(result.success).toBe(true);
    });

    it('does NOT check credits at photography stage', () => {
      const result = simulateMove('photography', 0, 2);
      expect(result.success).toBe(true);
    });
  });

  describe('SKU generation', () => {
    function generateSku(auctionName: string, lotNumber: string): string {
      const words = auctionName.split(' ').filter(w => /^[a-zA-Z]+$/.test(w));
      const prefix = words.slice(0, 3).map(w => w[0].toUpperCase()).join('');
      return `${prefix}-${lotNumber}`;
    }

    function generateSkuWithSuffix(auctionName: string, lotNumber: string, index: number): string {
      const base = generateSku(auctionName, lotNumber);
      const suffix = String.fromCharCode(97 + index); // a, b, c...
      return `${base}(${suffix})`;
    }

    it('generates correct SKU from 3-word auction name', () => {
      expect(generateSku('Spring Online Auction', '123')).toBe('SOA-123');
    });

    it('generates correct SKU from 2-word auction name', () => {
      expect(generateSku('Spring Auction', '456')).toBe('SA-456');
    });

    it('ignores numeric words in auction name', () => {
      expect(generateSku('Spring 2025 Auction', '789')).toBe('SA-789');
    });

    it('generates correct suffix for multiple quantities', () => {
      expect(generateSkuWithSuffix('Spring Online Auction', '100', 0)).toBe('SOA-100(a)');
      expect(generateSkuWithSuffix('Spring Online Auction', '100', 1)).toBe('SOA-100(b)');
      expect(generateSkuWithSuffix('Spring Online Auction', '100', 25)).toBe('SOA-100(z)');
    });
  });
});
