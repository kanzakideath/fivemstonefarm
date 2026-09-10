import type {
  LeaderboardCategory,
  LeaderboardEntry,
  OnlineEvent,
  OnlinePushResponse,
  OnlineTransport,
  ProcessedEventReceipt,
  PublicProfile,
} from '../domain/types';
import { SeededRng, stableChecksum } from '../domain/rng';

const TIERS = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', 'MASTER', 'LEGEND'] as const;

export const LOWER_IS_BETTER_LEADERBOARD_CATEGORIES = [
  'ENDLESS_FASTEST_CLEAR',
  'ENDLESS_FEWEST_DAMAGE',
] as const satisfies readonly LeaderboardCategory[];

export const isLowerBetterLeaderboard = (category: LeaderboardCategory): boolean =>
  (LOWER_IS_BETTER_LEADERBOARD_CATEGORIES as readonly LeaderboardCategory[]).includes(category);

const cloneProfile = (profile: PublicProfile): PublicProfile => {
  if (typeof globalThis.structuredClone === 'function') return globalThis.structuredClone(profile);
  return JSON.parse(JSON.stringify(profile)) as PublicProfile;
};

export interface MockOnlineOptions {
  fakeUserCount?: number;
  seed?: string;
  latencyMs?: number;
  failureRate?: number;
  now?: () => Date;
}

interface AuthorityAccount {
  lastSequenceBySession: Record<string, number>;
  totalMining: number;
  battleWins: number;
  fusionCount: number;
}

/**
 * Deterministic standalone server substitute. It validates idempotency, timestamps,
 * sequence monotonicity and impossible payloads instead of trusting aggregate client totals.
 */
export class MockOnlineAdapter implements OnlineTransport {
  private readonly receipts = new Map<string, ProcessedEventReceipt>();
  private readonly authority = new Map<string, AuthorityAccount>();
  private readonly profiles = new Map<string, PublicProfile>();
  private readonly rng: SeededRng;
  private readonly leaderboardSeed: string;
  private readonly latencyMs: number;
  private readonly failureRate: number;
  private readonly now: () => Date;

  constructor(options: MockOnlineOptions = {}) {
    const count = Math.max(0, Math.min(10_000, Math.floor(options.fakeUserCount ?? 1_000)));
    this.leaderboardSeed = options.seed ?? 'stoneverse-mock-online';
    this.rng = new SeededRng(this.leaderboardSeed);
    this.latencyMs = Math.max(0, options.latencyMs ?? 0);
    this.failureRate = Math.max(0, Math.min(1, options.failureRate ?? 0));
    this.now = options.now ?? (() => new Date());
    this.seedProfiles(count);
  }

  private seedProfiles(count: number): void {
    const prefixes = ['Obsidian', 'Quartz', 'Magma', 'Echo', 'Prism', 'Granite', 'Aurora', 'Void', 'Solar', 'Tidal'];
    const suffixes = ['Keeper', 'Smith', 'Seeker', 'Sage', 'Rider', 'Warden', 'Miner', 'Pulse', 'Core', 'Rune'];
    for (let index = 0; index < count; index += 1) {
      const accountId = `mock_${index.toString().padStart(5, '0')}`;
      const accountLevel = this.rng.int(2, 100);
      const miningLevel = Math.min(100, Math.max(1, accountLevel + this.rng.int(-12, 15)));
      const tierIndex = Math.min(TIERS.length - 1, Math.floor(accountLevel / 16));
      const totalMined = Math.round((accountLevel ** 2.35) * (4 + this.rng.next() * 5));
      const collectionPercent = Math.min(100, Math.round(accountLevel * (0.65 + this.rng.next() * 0.42)));
      const achievementPercent = Math.min(100, Math.round(accountLevel * (0.52 + this.rng.next() * 0.45)));
      const raidStats = {
        lifetimeDamage: Math.round(accountLevel ** 3 * (25 + this.rng.next() * 20)),
        bossesDefeated: Math.floor(accountLevel * this.rng.next()),
        bestContributionRank: this.rng.int(1, 500),
      };
      const showcaseStoneIds = Array.from({ length: this.rng.int(3, 6) }, (_, slot) => `${accountId}_stone_${slot}`);
      const highestEndlessFloor = Math.max(1, Math.round(accountLevel ** 1.42 * (1.1 + this.rng.next())));
      const weeklyHighestEndlessFloor = Math.min(highestEndlessFloor, Math.max(1, Math.round(highestEndlessFloor * (0.35 + this.rng.next() * 0.62))));
      const currentExpeditionCount = this.rng.int(0, 3);
      const expeditionCount = Math.round(accountLevel * (2 + this.rng.next() * 9));
      const bossKills = raidStats.bossesDefeated + Math.floor(highestEndlessFloor / 10);
      const battleWins = Math.round(accountLevel ** 1.55 * (1 + this.rng.next() * 2));
      const battlePower = Math.round(accountLevel ** 2.12 * (18 + this.rng.next() * 12));
      const favoriteStoneCount = this.rng.int(0, Math.min(3, showcaseStoneIds.length));
      const perfectStoneCount = this.rng.int(0, Math.max(0, Math.floor(accountLevel / 18)));
      const mutationCollectionCount = this.rng.int(0, Math.max(1, Math.floor(accountLevel / 5)));
      const fastestEndlessClearTurns = Math.max(8, Math.round(245 - accountLevel * 1.65 + this.rng.next() * 42));
      const fewestEndlessDamage = Math.max(0, Math.round((105 - accountLevel) * 82 + this.rng.next() * 1_200));
      this.profiles.set(accountId, {
        accountId,
        username: `${this.rng.pick(prefixes)}${this.rng.pick(suffixes)}${index + 1}`,
        avatarId: `avatar_${this.rng.int(1, 12)}`,
        frameId: `frame_${tierIndex}`,
        titleId: `title_${this.rng.int(1, 20)}`,
        accountLevel,
        miningLevel,
        totalMined,
        collectionPercent,
        achievementPercent,
        arenaTier: TIERS[tierIndex] ?? 'BRONZE',
        arenaRating: 800 + tierIndex * 430 + this.rng.int(0, 420),
        raidStats,
        showcaseStoneIds,
        lastOnlineAt: new Date(this.now().getTime() - this.rng.int(0, 14 * 86_400_000)).toISOString(),
        highestEndlessFloor,
        weeklyHighestEndlessFloor,
        currentExpeditionCount,
        expeditionCount,
        expeditionScore: expeditionCount * 100 + weeklyHighestEndlessFloor * 25,
        bossKills,
        battleWins,
        battlePower,
        bestTeamStoneIds: [...showcaseStoneIds],
        favoriteStoneIds: showcaseStoneIds.slice(0, favoriteStoneCount),
        favoriteStoneCount,
        perfectStoneCount,
        mutationCollectionCount,
        fastestEndlessClearTurns,
        fewestEndlessDamage,
      });
    }
  }

  private async delay(): Promise<void> {
    if (this.latencyMs > 0) await new Promise<void>((resolve) => setTimeout(resolve, this.latencyMs));
    if (this.rng.chance(this.failureRate)) throw new Error('Mock network is unavailable');
  }

  private rejectReason(event: OnlineEvent): { reason: string; retryable: boolean } | null {
    if (!event.eventId || !event.sessionId || !event.accountId) return { reason: 'Malformed event identity', retryable: false };
    const timestamp = new Date(event.timestamp).getTime();
    const drift = timestamp - this.now().getTime();
    if (!Number.isFinite(timestamp) || drift > 5 * 60_000 || drift < -30 * 86_400_000) return { reason: 'Timestamp outside authority window', retryable: false };
    const account = this.authority.get(event.accountId) ?? { lastSequenceBySession: {}, totalMining: 0, battleWins: 0, fusionCount: 0 };
    const previous = account.lastSequenceBySession[event.sessionId] ?? 0;
    if (event.sequence <= previous) return { reason: 'Non-monotonic session sequence', retryable: false };
    if (event.sequence > previous + 10_000) return { reason: 'Impossible session sequence jump', retryable: false };
    if (event.kind === 'MINING_RECORDED') {
      const payload = event.payload as { amount?: unknown; quality?: unknown };
      if (typeof payload.amount !== 'number' || payload.amount < 1 || payload.amount > 100) return { reason: 'Impossible mining amount', retryable: false };
      if (typeof payload.quality === 'number' && (payload.quality < 0 || payload.quality > 1)) return { reason: 'Impossible mining quality', retryable: false };
    }
    return null;
  }

  async pushEvents(events: readonly OnlineEvent[]): Promise<OnlinePushResponse> {
    await this.delay();
    const accepted: ProcessedEventReceipt[] = [];
    const rejected: OnlinePushResponse['rejected'] = [];
    for (const event of events) {
      const duplicate = this.receipts.get(event.eventId);
      if (duplicate) {
        accepted.push(duplicate);
        continue;
      }
      const invalid = this.rejectReason(event);
      if (invalid) {
        rejected.push({ eventId: event.eventId, ...invalid });
        continue;
      }
      const account = this.authority.get(event.accountId) ?? { lastSequenceBySession: {}, totalMining: 0, battleWins: 0, fusionCount: 0 };
      account.lastSequenceBySession[event.sessionId] = event.sequence;
      if (event.kind === 'MINING_RECORDED') account.totalMining += Number((event.payload as { amount: number }).amount);
      if (event.kind === 'BATTLE_FINISHED' && (event.payload as { winner?: string }).winner === 'PLAYER') account.battleWins += 1;
      if (event.kind === 'STONE_FUSED') account.fusionCount += 1;
      this.authority.set(event.accountId, account);
      const receipt = { eventId: event.eventId, processedAt: this.now().toISOString(), checksum: stableChecksum(event) };
      this.receipts.set(event.eventId, receipt);
      accepted.push(receipt);
    }
    return { accepted, rejected };
  }

  async getPublicProfile(accountId: string): Promise<PublicProfile | null> {
    await this.delay();
    const profile = this.profiles.get(accountId);
    return profile ? cloneProfile(profile) : null;
  }

  async getLeaderboard(category: LeaderboardCategory, limit = 100): Promise<LeaderboardEntry[]> {
    await this.delay();
    const value = (profile: PublicProfile): number => {
      switch (category) {
        case 'TOTAL_MINING': return profile.totalMined;
        case 'DAILY_MINING': return Math.round(profile.totalMined / 300 + profile.miningLevel * 3);
        case 'WEEKLY_MINING': return Math.round(profile.totalMined / 52 + profile.miningLevel * 15);
        case 'MONTHLY_MINING': return Math.round(profile.totalMined / 12 + profile.miningLevel * 50);
        case 'COLLECTION': return profile.collectionPercent;
        case 'ACHIEVEMENTS': return profile.achievementPercent;
        case 'PVP': return profile.arenaRating;
        case 'RAID': return profile.raidStats.lifetimeDamage;
        case 'RARE_DISCOVERY': return Math.round(profile.collectionPercent * profile.miningLevel * 0.7);
        case 'FUSION': return Math.round(profile.accountLevel ** 1.8 * 0.8);
        case 'ENDLESS_HIGHEST_FLOOR': return profile.weeklyHighestEndlessFloor ?? profile.highestEndlessFloor ?? 0;
        case 'ENDLESS_FASTEST_CLEAR': return profile.fastestEndlessClearTurns ?? Number.MAX_SAFE_INTEGER;
        case 'ENDLESS_FEWEST_DAMAGE': return profile.fewestEndlessDamage ?? Number.MAX_SAFE_INTEGER;
        case 'EXPEDITION_SCORE': return profile.expeditionScore ?? profile.expeditionCount ?? 0;
        case 'BOSS_CLEARS': return profile.bossKills ?? profile.raidStats.bossesDefeated;
        case 'BATTLE_POWER': return profile.battlePower ?? 0;
      }
    };
    const direction = isLowerBetterLeaderboard(category) ? 1 : -1;
    return [...this.profiles.values()]
      .sort((a, b) => (value(a) - value(b)) * direction || a.accountId.localeCompare(b.accountId))
      .slice(0, Math.max(1, Math.min(1_000, limit)))
      .map((profile, index) => {
        const trend = Number.parseInt(stableChecksum([this.leaderboardSeed, category, profile.accountId]), 16) % 7 - 3;
        return {
          rank: index + 1,
          previousRank: Math.max(1, index + 1 + trend),
          accountId: profile.accountId,
          username: profile.username,
          avatarId: profile.avatarId,
          frameId: profile.frameId,
          titleId: profile.titleId,
          value: value(profile),
        };
      });
  }
}
