export type ActivityNotificationKind = 'EXPEDITION' | 'DISCOVERY' | 'BATTLE' | 'SYSTEM' | 'REWARD';

export interface ActivityNotificationInput {
  id: string;
  kind: ActivityNotificationKind;
  title: string;
  detail: string;
  occurredAt: number;
  count?: number;
  rare?: boolean;
}

export interface AggregatedActivityNotification extends ActivityNotificationInput {
  count: number;
  sourceIds: string[];
}

/**
 * Coalesces repeat/offline bursts into one notification per semantic event.
 * Rare discoveries deliberately remain separate so they are never hidden.
 */
export const aggregateActivityNotifications = (
  inputs: readonly ActivityNotificationInput[],
  maxItems = 30,
): AggregatedActivityNotification[] => {
  const grouped = new Map<string, AggregatedActivityNotification>();
  for (const input of [...inputs].sort((left, right) => left.occurredAt - right.occurredAt)) {
    if (!input.id || !Number.isFinite(input.occurredAt)) continue;
    const count = Math.max(1, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(input.count ?? 1)));
    const key = input.rare ? `rare:${input.id}` : `${input.kind}:${input.title}`;
    const previous = grouped.get(key);
    if (!previous) {
      grouped.set(key, { ...input, count, sourceIds: [input.id] });
      continue;
    }
    previous.count = Math.min(Number.MAX_SAFE_INTEGER, previous.count + count);
    previous.occurredAt = Math.max(previous.occurredAt, input.occurredAt);
    previous.detail = input.detail || previous.detail;
    previous.sourceIds.push(input.id);
  }
  return [...grouped.values()]
    .sort((left, right) => Number(Boolean(right.rare)) - Number(Boolean(left.rare)) || right.occurredAt - left.occurredAt)
    .slice(0, Math.max(1, Math.min(100, Math.floor(maxItems))));
};

export const notificationTitle = (notification: AggregatedActivityNotification): string =>
  notification.count > 1 ? `${notification.title} ×${notification.count}` : notification.title;
