import { describe, expect, it } from 'vitest';
import { SeededRng } from '../rng';
import type { RandomSource } from '../rng';
import {
  MAX_COMBAT_VALUE,
  STANDARD_ADVANCED_SKILLS,
  calculateTeamSynergy,
  createAdvancedBattle,
  getEffectiveStat,
  getTurnOrder,
  getUsableSkills,
  resolveAdvancedCommand,
  runAdvancedRound,
  type AdvancedSkillDefinition,
  type CombatantTemplate,
  type CombatStats,
} from './combat';

const stats = (overrides: Partial<CombatStats> = {}): CombatStats => ({
  maxHp: 1_000,
  attack: 140,
  defense: 90,
  speed: 100,
  accuracy: 140,
  resistance: 100,
  critChance: 0.15,
  critDamage: 1.6,
  breakPower: 25,
  ...overrides,
});

const unit = (
  id: string,
  side: 'PLAYER' | 'ENEMY',
  skillIds: readonly string[] = ['strike'],
  overrides: Partial<CombatantTemplate> = {},
): CombatantTemplate => ({
  id,
  name: id,
  side,
  role: side === 'PLAYER' ? 'STRIKER' : 'VANGUARD',
  family: side === 'PLAYER' ? 'quartz' : 'basalt',
  level: 20,
  stats: stats(),
  skillIds,
  ...overrides,
});

const alwaysHitRng: RandomSource = {
  next: () => 0,
  int: (minInclusive) => minInclusive,
  chance: (probability) => probability > 0,
  pick: <T>(values: readonly T[]) => values[0] as T,
  weighted: <T>(values: readonly T[]) => values[0] as T,
  shuffle: <T>(values: readonly T[]) => [...values],
  fork: () => alwaysHitRng,
};

describe('advanced combat resolver', () => {
  it('orders turns by effective speed and applies role plus lineage synergy', () => {
    const synergy = calculateTeamSynergy([
      { role: 'TANK', family: 'q' },
      { role: 'STRIKER', family: 'q' },
      { role: 'SUPPORT', family: 'q' },
    ]);
    expect(synergy.roleDiversity).toBe(3);
    expect(synergy.lineagePairs).toBe(1);
    expect(synergy.attackBonus).toBeGreaterThan(0.1);
    expect(synergy.ultimateStart).toBeGreaterThan(0);

    const battle = createAdvancedBattle({
      units: [
        unit('slow', 'PLAYER', ['strike'], { stats: stats({ speed: 80 }) }),
        unit('ally', 'PLAYER', ['strike'], { role: 'SUPPORT', stats: stats({ speed: 70 }) }),
        unit('fast', 'ENEMY', ['strike'], { stats: stats({ speed: 160 }) }),
      ],
      skills: STANDARD_ADVANCED_SKILLS,
    });
    expect(getTurnOrder(battle)).toEqual(['fast', 'slow', 'ally']);
    expect(getEffectiveStat(battle.units[0]!, 'attack')).toBeGreaterThan(battle.units[0]!.stats.attack);
  });

  it('resolves damage, shields, counters, break, DoT, controls and modifiers without a second engine', () => {
    const skills: Record<string, AdvancedSkillDefinition> = {
      assault: {
        id: 'assault',
        name: 'Assault',
        target: 'ENEMY',
        effects: [
          { kind: 'DAMAGE', power: 0.5 },
          { kind: 'BREAK', value: 100 },
          { kind: 'DOT', power: 0.03, duration: 2 },
          { kind: 'DEBUFF', stat: 'defense', value: 0.2, duration: 2 },
          { kind: 'CONTROL', control: 'SILENCE', duration: 1 },
        ],
      },
      fortress: {
        id: 'fortress',
        name: 'Fortress',
        target: 'SELF',
        effects: [{ kind: 'SHIELD', power: 1 }, { kind: 'BUFF', stat: 'defense', value: 0.2, duration: 2 }, { kind: 'COUNTER', power: 0.5, duration: 2 }],
      },
    };
    const battle = createAdvancedBattle({ units: [unit('hero', 'PLAYER', ['assault']), unit('guard', 'ENEMY', ['fortress'])], skills });
    resolveAdvancedCommand(battle, { actorId: 'guard', skillId: 'fortress' }, alwaysHitRng);
    const guard = battle.units.find((candidate) => candidate.id === 'guard')!;
    expect(guard.shield).toBeGreaterThan(0);
    expect(guard.counter).not.toBeNull();

    const log = resolveAdvancedCommand(battle, { actorId: 'hero', skillId: 'assault', targetIds: ['guard'] }, alwaysHitRng);
    expect(log.resolutions.map((result) => result.kind)).toEqual(['DAMAGE', 'BREAK', 'DOT', 'DEBUFF', 'CONTROL']);
    expect(log.counter?.actorId).toBe('guard');
    expect(guard.controls.some((control) => control.kind === 'STUN')).toBe(true);
    expect(guard.controls.some((control) => control.kind === 'SILENCE')).toBe(true);
    expect(guard.dots).toHaveLength(1);
    expect(guard.modifiers.some((modifier) => modifier.stat === 'defense' && modifier.value < 0)).toBe(true);
  });

  it('uses the same resolver path for a manual command and an automatic provider command', () => {
    const config = { units: [unit('hero', 'PLAYER'), unit('enemy', 'ENEMY')], skills: STANDARD_ADVANCED_SKILLS, maxTurns: 4 };
    const manual = createAdvancedBattle(config);
    const automatic = createAdvancedBattle(config);
    runAdvancedRound(manual, { commands: { hero: { actorId: 'hero', skillId: 'strike', targetIds: ['enemy'] } } }, new SeededRng('shared'));
    runAdvancedRound(
      automatic,
      { commandProvider: (_state, actorId) => actorId === 'hero' ? { actorId, skillId: 'strike', targetIds: ['enemy'] } : null },
      new SeededRng('shared'),
    );
    expect(automatic.units.map(({ hp, ultimate }) => ({ hp, ultimate }))).toEqual(manual.units.map(({ hp, ultimate }) => ({ hp, ultimate })));
    expect(automatic.log).toEqual(manual.log);
  });

  it('spends an Ultimate on every AoE target and heals the selected lowest ally', () => {
    const battle = createAdvancedBattle({
      units: [
        unit('hero', 'PLAYER', ['nova'], { initialUltimate: 100 }),
        unit('healer', 'PLAYER', ['mend'], { role: 'SUPPORT' }),
        ...['one', 'two', 'three'].map((id) => unit(id, 'ENEMY', ['strike'], { stats: stats({ maxHp: 2_000 }) })),
      ],
      skills: STANDARD_ADVANCED_SKILLS,
    });
    const hero = battle.units.find((candidate) => candidate.id === 'hero')!;
    const healer = battle.units.find((candidate) => candidate.id === 'healer')!;
    hero.hp = 400;
    const enemyHp = battle.units.filter((candidate) => candidate.side === 'ENEMY').map((candidate) => candidate.hp);
    const ultimateLog = resolveAdvancedCommand(battle, { actorId: 'hero', skillId: 'nova' }, alwaysHitRng);
    expect(hero.ultimate).toBe(0);
    expect(ultimateLog.resolutions.filter((result) => result.kind === 'DAMAGE')).toHaveLength(3);
    expect(battle.units.filter((candidate) => candidate.side === 'ENEMY').every((candidate, index) => candidate.hp < enemyHp[index]!)).toBe(true);
    resolveAdvancedCommand(battle, { actorId: 'healer', skillId: 'mend', targetIds: ['hero'] }, alwaysHitRng);
    expect(hero.hp).toBeGreaterThan(400);
  });

  it('triggers boss weak-point phases, summons and enrage', () => {
    const skills: Record<string, AdvancedSkillDefinition> = {
      lance: { id: 'lance', name: 'Lance', target: 'BOSS', element: 'LIGHT', effects: [{ kind: 'DAMAGE', power: 3 }] },
      tap: { id: 'tap', name: 'Tap', target: 'ENEMY', effects: [{ kind: 'DAMAGE', power: 0.1 }] },
    };
    const summon = unit('echo', 'ENEMY', ['tap'], { stats: stats({ maxHp: 200 }) });
    const boss = unit('boss', 'ENEMY', ['tap'], {
      stats: stats({ maxHp: 600, defense: 10 }),
      boss: {
        weakPoint: 'LIGHT',
        enrageTurn: 1,
        enrageMultiplier: 1.5,
        phases: [{ id: 'half', hpRatio: 0.8, attackMultiplier: 1.2, weakPoint: 'DARK', summons: [summon] }],
      },
    });
    const battle = createAdvancedBattle({ units: [unit('hero', 'PLAYER', ['lance'], { stats: stats({ attack: 180, speed: 200 }) }), boss], skills });
    runAdvancedRound(
      battle,
      { commands: { hero: { actorId: 'hero', skillId: 'lance', targetIds: ['boss'] } } },
      new SeededRng('boss-phase'),
    );
    const runtimeBoss = battle.units.find((candidate) => candidate.id === 'boss')!;
    expect(runtimeBoss.bossState?.enraged).toBe(true);
    expect(runtimeBoss.bossState?.triggeredPhaseIds).toContain('half');
    expect(runtimeBoss.bossState?.weakPoint).toBe('DARK');
    expect(battle.units.some((candidate) => candidate.id.includes('half') && candidate.name === 'echo')).toBe(true);
  });

  it('executes all named statuses instead of treating them as display-only labels', () => {
    const skills: Record<string, AdvancedSkillDefinition> = {
      afflict: {
        id: 'afflict',
        name: 'Afflict',
        target: 'ENEMY',
        effects: [
          { kind: 'STATUS', status: 'BURN', power: 0.05, duration: 2 },
          { kind: 'STATUS', status: 'CRACK', power: 0.2, duration: 2 },
          { kind: 'STATUS', status: 'VULNERABLE', power: 0.25, duration: 2 },
          { kind: 'STATUS', status: 'STUN', duration: 1 },
          { kind: 'STATUS', status: 'SILENCE', duration: 1 },
          { kind: 'STATUS', status: 'SLOW', power: 0.3, duration: 2 },
        ],
      },
      sanctuary: {
        id: 'sanctuary',
        name: 'Sanctuary',
        target: 'SELF',
        effects: [
          { kind: 'STATUS', status: 'SHIELD', power: 0.5, duration: 2 },
          { kind: 'STATUS', status: 'REGENERATION', power: 0.1, duration: 2 },
        ],
      },
      strike: STANDARD_ADVANCED_SKILLS.strike!,
      nova: STANDARD_ADVANCED_SKILLS.nova!,
    };
    const battle = createAdvancedBattle({
      units: [unit('caster', 'PLAYER', ['afflict', 'strike']), unit('target', 'ENEMY', ['strike', 'nova'], { initialUltimate: 100 })],
      skills,
    });
    const target = battle.units.find((candidate) => candidate.id === 'target')!;
    resolveAdvancedCommand(battle, { actorId: 'caster', skillId: 'afflict', targetIds: ['target'] }, alwaysHitRng);
    expect(target.statuses.map((status) => status.kind)).toEqual(expect.arrayContaining(['BURN', 'CRACK', 'VULNERABLE', 'SLOW']));
    expect(target.controls.map((control) => control.kind)).toEqual(expect.arrayContaining(['STUN', 'SILENCE']));
    expect(getEffectiveStat(target, 'defense')).toBeLessThan(target.stats.defense);
    expect(getEffectiveStat(target, 'speed')).toBeLessThan(target.stats.speed);
    expect(getUsableSkills(battle, 'target').map((skill) => skill.id)).not.toContain('nova');
    const beforeVulnerableHit = target.hp;
    resolveAdvancedCommand(battle, { actorId: 'caster', skillId: 'strike', targetIds: ['target'] }, alwaysHitRng);
    const vulnerableDamage = beforeVulnerableHit - target.hp;
    const clean = createAdvancedBattle({
      units: [unit('caster', 'PLAYER', ['afflict', 'strike']), unit('target', 'ENEMY', ['strike', 'nova'], { initialUltimate: 100 })],
      skills,
    });
    const cleanTarget = clean.units.find((candidate) => candidate.id === 'target')!;
    resolveAdvancedCommand(clean, { actorId: 'caster', skillId: 'strike', targetIds: ['target'] }, alwaysHitRng);
    expect(vulnerableDamage).toBeGreaterThan(cleanTarget.stats.maxHp - cleanTarget.hp);
    const beforeBurn = target.hp;
    runAdvancedRound(
      battle,
      { commands: { target: { actorId: 'target', skillId: 'strike', targetIds: ['caster'] } } },
      new SeededRng('burn-tick'),
    );
    expect(target.hp).toBeLessThan(beforeBurn);
    expect(battle.log.filter((entry) => entry.turn === 1).some((entry) => entry.actorId === 'target')).toBe(false);

    const sustain = createAdvancedBattle({
      units: [unit('guardian', 'PLAYER', ['sanctuary'], { role: 'GUARDIAN' }), unit('enemy', 'ENEMY', ['strike'])],
      skills,
    });
    const guardian = sustain.units.find((candidate) => candidate.id === 'guardian')!;
    guardian.hp = 500;
    resolveAdvancedCommand(sustain, { actorId: 'guardian', skillId: 'sanctuary' }, new SeededRng('sustain'));
    expect(guardian.shield).toBeGreaterThan(0);
    const beforeRegeneration = guardian.hp;
    runAdvancedRound(sustain, {}, new SeededRng('regen-tick'));
    expect(guardian.hp).toBeGreaterThan(beforeRegeneration);
  });

  it('rejects NaN inputs and clamps finite high-end arithmetic', () => {
    expect(() => createAdvancedBattle({
      units: [unit('bad', 'PLAYER', ['strike'], { stats: stats({ attack: Number.NaN }) }), unit('enemy', 'ENEMY')],
      skills: STANDARD_ADVANCED_SKILLS,
    })).toThrow(/finite/);
    const battle = createAdvancedBattle({
      units: [
        unit('huge', 'PLAYER', ['strike'], { stats: stats({ maxHp: MAX_COMBAT_VALUE, attack: MAX_COMBAT_VALUE, defense: MAX_COMBAT_VALUE }) }),
        unit('target', 'ENEMY', ['strike'], { stats: stats({ maxHp: MAX_COMBAT_VALUE, attack: MAX_COMBAT_VALUE, defense: MAX_COMBAT_VALUE }) }),
      ],
      skills: STANDARD_ADVANCED_SKILLS,
    });
    resolveAdvancedCommand(battle, { actorId: 'huge', skillId: 'strike', targetIds: ['target'] }, new SeededRng('finite'));
    for (const combatant of battle.units) {
      expect(Number.isFinite(combatant.hp)).toBe(true);
      expect(Number.isFinite(combatant.shield)).toBe(true);
      expect(combatant.hp).toBeLessThanOrEqual(MAX_COMBAT_VALUE);
    }
  });

  it('uses accuracy versus resistance for hit checks and crit chance for critical damage', () => {
    const thresholdRng: RandomSource = {
      ...alwaysHitRng,
      chance: (probability) => probability >= 0.5,
      fork: () => thresholdRng,
    };
    const precise = unit('precise', 'PLAYER', ['strike'], { stats: stats({ accuracy: 10_000, critChance: 0.8 }) });
    const evasive = unit('evasive', 'ENEMY', ['strike'], { stats: stats({ resistance: 10_000, maxHp: 10_000 }) });
    const missBattle = createAdvancedBattle({
      units: [unit('inaccurate', 'PLAYER', ['strike'], { stats: stats({ accuracy: 0, critChance: 0.8 }) }), evasive],
      skills: STANDARD_ADVANCED_SKILLS,
    });
    expect(resolveAdvancedCommand(missBattle, { actorId: 'inaccurate', skillId: 'strike', targetIds: ['evasive'] }, thresholdRng).resolutions[0]).toMatchObject({ hit: false, amount: 0 });

    const critBattle = createAdvancedBattle({
      units: [precise, unit('plain', 'ENEMY', ['strike'], { stats: stats({ resistance: 0, maxHp: 10_000 }) })],
      skills: STANDARD_ADVANCED_SKILLS,
    });
    expect(resolveAdvancedCommand(critBattle, { actorId: 'precise', skillId: 'strike', targetIds: ['plain'] }, thresholdRng).resolutions[0]).toMatchObject({ hit: true, critical: true });
  });

  it('rejects an explicit target outside the skill target set', () => {
    const battle = createAdvancedBattle({ units: [unit('hero', 'PLAYER'), unit('enemy', 'ENEMY')], skills: STANDARD_ADVANCED_SKILLS });
    expect(() => resolveAdvancedCommand(
      battle,
      { actorId: 'hero', skillId: 'strike', targetIds: ['hero'] },
      alwaysHitRng,
    )).toThrow(/no valid target/);
  });
});
