import { describe, expect, it } from 'vitest';
import { aggregateActivityNotifications, notificationTitle } from './notifications';

describe('activity notification aggregation', () => {
  it('turns ten repeat completions into one notification', () => {
    const result = aggregateActivityNotifications(Array.from({ length: 10 }, (_, index) => ({
      id: `cycle-${index}`,
      kind: 'EXPEDITION' as const,
      title: 'Expedition completed',
      detail: 'Expedition Storageへ格納',
      occurredAt: index,
    })));
    expect(result).toHaveLength(1);
    expect(result[0]?.count).toBe(10);
    expect(notificationTitle(result[0]!)).toBe('Expedition completed ×10');
  });

  it('never swallows distinct rare discoveries', () => {
    const result = aggregateActivityNotifications([
      { id: 'rare-a', kind: 'DISCOVERY', title: 'UNKNOWN SIGNAL', detail: 'A', occurredAt: 1, rare: true },
      { id: 'rare-b', kind: 'DISCOVERY', title: 'UNKNOWN SIGNAL', detail: 'B', occurredAt: 2, rare: true },
    ]);
    expect(result).toHaveLength(2);
  });
});
