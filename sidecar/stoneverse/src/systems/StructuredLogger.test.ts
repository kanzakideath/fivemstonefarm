import { describe, expect, it, vi } from 'vitest';
import { StructuredLogger } from './StructuredLogger';

describe('StructuredLogger', () => {
  it('redacts sensitive nested fields and shares a bounded buffer with children', () => {
    let id = 0;
    const logger = new StructuredLogger({
      minimumLevel: 'debug',
      capacity: 2,
      sessionId: 'session-a',
      now: () => new Date('2026-09-10T00:00:00.000Z'),
      idFactory: () => `event-${++id}`,
      baseContext: { accountId: 'account-a', accessToken: 'never-log-this' },
    });
    const fusionLogger = logger.child({ feature: 'fusion' });
    fusionLogger.info({
      domain: 'fusion',
      event: 'stone.fused',
      data: { childId: 'stone-3', nested: { password: 'hidden', iv: 31 } },
    });
    logger.warn({ domain: 'save', event: 'save.retry' });
    logger.error({ domain: 'save', event: 'save.failed', error: new Error('quota') });

    const entries = logger.entries();
    expect(entries).toHaveLength(2);
    expect(entries[1].error?.message).toBe('quota');
    expect(fusionLogger.exportJsonLines()).not.toContain('never-log-this');
    expect(fusionLogger.exportJsonLines()).not.toContain('hidden');
  });

  it('isolates sink failures from gameplay', () => {
    const logger = new StructuredLogger({
      sinks: [{ write: vi.fn(() => { throw new Error('sink offline'); }) }],
    });
    expect(() => logger.info({ domain: 'system', event: 'game.started' })).not.toThrow();
    expect(logger.entries()).toHaveLength(1);
  });
});
