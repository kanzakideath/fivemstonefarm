import { describe, expect, it } from 'vitest';
import { SeededRng } from '../rng';
import { createAutoCommandProvider } from './ai';
import {
  createAdvancedBattle,
  runAdvancedBattle,
  STANDARD_ADVANCED_SKILLS,
  type CombatantTemplate,
  type CombatStats,
} from './combat';

const stats = (attack: number, speed: number): CombatStats => ({
  maxHp: 260,
  attack,
  defense: 52,
  speed,
  accuracy: 125,
  resistance: 100,
  critChance: 0.14,
  critDamage: 1.6,
  breakPower: 20,
});

const combatant = (id: string, side: 'PLAYER' | 'ENEMY', attack: number, speed: number): CombatantTemplate => ({
  id,
  name: id,
  side,
  role: side === 'PLAYER' ? 'BREAKER' : 'GUARDIAN',
  family: side,
  level: 10,
  stats: stats(attack, speed),
  skillIds: ['strike'],
});

describe('advanced battle simulation', () => {
  it('resolves and analyzes more than 10,000 full-team battles without non-finite state', { timeout: 30_000 }, () => {
    const samples = 10_240;
    const outcomes = { PLAYER: 0, ENEMY: 0, DRAW: 0 };
    let actions = 0;
    let turns = 0;
    let damage = 0;
    let healing = 0;
    const skillUsage: Record<string, number> = {};
    const rng = new SeededRng('advanced-10240-battles');
    const provider = createAutoCommandProvider('BALANCED');
    for (let index = 0; index < samples; index += 1) {
      const battle = createAdvancedBattle({
        units: [
          { ...combatant('player-striker', 'PLAYER', 72 + index % 9, 104), role: 'STRIKER', skillIds: ['strike', 'sweep', 'nova'], initialUltimate: index % 4 === 0 ? 100 : 35 },
          { ...combatant('player-support', 'PLAYER', 58 + index % 5, 101), role: 'SUPPORT', skillIds: ['strike', 'mend', 'bulwark'] },
          { ...combatant('player-breaker', 'PLAYER', 66 + index % 7, 98), role: 'BREAKER', skillIds: ['strike', 'fracture', 'stun'] },
          { ...combatant('enemy-striker', 'ENEMY', 72 + (index * 7) % 9, 103), role: 'STRIKER', skillIds: ['strike', 'sweep', 'nova'], initialUltimate: index % 5 === 0 ? 100 : 20 },
          { ...combatant('enemy-support', 'ENEMY', 58 + (index * 3) % 5, 100), role: 'SUPPORT', skillIds: ['strike', 'mend', 'bulwark'] },
          { ...combatant('enemy-controller', 'ENEMY', 66 + (index * 5) % 7, 97), role: 'CONTROLLER', skillIds: ['strike', 'eclipse', 'stun'] },
        ],
        skills: STANDARD_ADVANCED_SKILLS,
        maxTurns: 24,
      });
      runAdvancedBattle(battle, provider, rng);
      expect(battle.outcome).not.toBeNull();
      outcomes[battle.outcome as keyof typeof outcomes] += 1;
      actions += battle.log.length;
      turns += battle.turn;
      for (const entry of battle.log) {
        skillUsage[entry.skillId] = (skillUsage[entry.skillId] ?? 0) + 1;
        for (const resolution of entry.resolutions) {
          if (resolution.kind === 'DAMAGE' || resolution.kind === 'DOT') damage += resolution.amount;
          if (resolution.kind === 'HEAL') healing += resolution.amount;
        }
      }
      for (const unit of battle.units) {
        expect(Number.isFinite(unit.hp)).toBe(true);
        expect(Number.isFinite(unit.shield)).toBe(true);
        expect(unit.hp).toBeGreaterThanOrEqual(0);
        expect(unit.hp).toBeLessThanOrEqual(unit.stats.maxHp);
      }
      expect(battle.log.every((entry) => entry.resolutions.every((result) => Number.isFinite(result.amount)))).toBe(true);
    }
    expect(Object.values(outcomes).reduce((sum, count) => sum + count, 0)).toBe(samples);
    expect(actions).toBeGreaterThan(samples);
    expect(turns).toBeGreaterThan(samples);
    expect(damage).toBeGreaterThan(0);
    expect(healing).toBeGreaterThan(0);
    expect(skillUsage.sweep).toBeGreaterThan(0);
    expect(skillUsage.mend).toBeGreaterThan(0);
    expect(skillUsage.nova).toBeGreaterThan(0);
    expect(outcomes.PLAYER + outcomes.ENEMY).toBeGreaterThan(0);
    const summary = {
      samples,
      outcomes,
      winRate: Math.round(outcomes.PLAYER / samples * 100_000) / 1_000,
      averageTurns: Math.round(turns / samples * 1_000) / 1_000,
      damage,
      healing,
      actions,
      skillUsage,
    };
    expect(Object.values(summary).some((value) => typeof value === 'number' && !Number.isFinite(value))).toBe(false);
    console.info(`[advanced-simulation] ${JSON.stringify(summary)}`);
  });
});
