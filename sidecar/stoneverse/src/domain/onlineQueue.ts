import type { Clock, GameState, OnlineEvent, OnlineEventKind } from './types';
import type { RandomSource } from './rng';
import { makeId, systemClock } from './rng';

export const enqueueOnlineEvent = <T>(
  state: GameState,
  kind: OnlineEventKind,
  payload: T,
  rng: RandomSource,
  clock: Clock = systemClock,
  requestedEventId?: string,
): OnlineEvent<T> => {
  const timestamp = clock.now();
  const eventId = requestedEventId ?? makeId('evt', rng, timestamp.getTime());
  const existing = state.online.queue.find((event) => event.eventId === eventId);
  if (existing) return existing as OnlineEvent<T>;
  if (state.online.processedReceipts.some((receipt) => receipt.eventId === eventId)) throw new Error('Online event was already acknowledged');
  state.online.sequence += 1;
  const event: OnlineEvent<T> = {
    eventId,
    sessionId: state.online.sessionId,
    sequence: state.online.sequence,
    timestamp: timestamp.toISOString(),
    accountId: state.account.accountId,
    kind,
    payload,
    attempts: 0,
    nextAttemptAt: timestamp.toISOString(),
  };
  state.online.queue.push(event);
  return event;
};

export const dueOnlineEvents = (state: GameState, clock: Clock = systemClock, limit = 100): OnlineEvent[] => {
  const now = clock.now().getTime();
  return state.online.queue.filter((event) => new Date(event.nextAttemptAt).getTime() <= now).slice(0, Math.max(1, limit));
};

export const scheduleOnlineRetry = (event: OnlineEvent, clock: Clock = systemClock): void => {
  event.attempts += 1;
  const delay = Math.min(300_000, 1_000 * 2 ** Math.min(8, event.attempts));
  event.nextAttemptAt = new Date(clock.now().getTime() + delay).toISOString();
};
