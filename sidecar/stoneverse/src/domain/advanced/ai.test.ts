import { describe, expect, it } from 'vitest';
import { SeededRng } from '../rng';
import { AI_STRATEGIES, explainAiDecision, selectAiCommand } from './ai';
import {
  createAdvancedBattle,
  STANDARD_ADVANCED_SKILLS,
  type AdvancedSkillDefinition,
  type CombatantTemplate,
  type CombatStats,
} from './combat';

const stats = (overrides: Partial<CombatStats> = {}): CombatStats => ({
  maxHp: 1_000,
  attack: 120,
  defense: 80,
  speed: 100,
  accuracy: 130,
  resistance: 100,
  critChance: 0.1,
  critDamage: 1.5,
  breakPower: 20,
  ...overrides,
});

const unit = (id: string, side: 'PLAYER' | 'ENEMY', skillIds: readonly string[], overrides: Partial<CombatantTemplate> = {}): CombatantTemplate => ({
  id,
  name: id,
  side,
  role: side === 'PLAYER' ? 'SUPPORT' : 'STRIKER',
  family: id,
  level: 10,
  stats: stats(),
  skillIds,
  ...overrides,
});

describe('advanced combat AI', () => {
  it('prioritizes an emergency heal', () => {
    const battle = createAdvancedBattle({
      units: [unit('healer', 'PLAYER', ['strike', 'mend', 'nova'], { initialUltimate: 100 }), unit('ally', 'PLAYER', ['strike']), unit('enemy', 'ENEMY', ['strike'])],
      skills: STANDARD_ADVANCED_SKILLS,
    });
    battle.units.find((candidate) => candidate.id === 'ally')!.hp = 250;
    const command = selectAiCommand(battle, 'healer', 'BALANCED', new SeededRng('heal'));
    expect(command).toMatchObject({ skillId: 'mend', targetIds: ['ally'] });
  });

  it('prioritizes AoE against a group', () => {
    const battle = createAdvancedBattle({
      units: [unit('hero', 'PLAYER', ['strike', 'sweep']), ...['a', 'b', 'c'].map((id) => unit(id, 'ENEMY', ['strike']))],
      skills: STANDARD_ADVANCED_SKILLS,
    });
    expect(selectAiCommand(battle, 'hero', 'AGGRESSIVE', new SeededRng('aoe'))?.skillId).toBe('sweep');
  });

  it('spends a ready ultimate', () => {
    const battle = createAdvancedBattle({
      units: [unit('hero', 'PLAYER', ['strike', 'nova'], { initialUltimate: 100 }), unit('enemy', 'ENEMY', ['strike'])],
      skills: STANDARD_ADVANCED_SKILLS,
    });
    expect(selectAiCommand(battle, 'hero', 'AGGRESSIVE', new SeededRng('ultimate'))?.skillId).toBe('nova');
  });

  it('focuses a boss instead of its summon', () => {
    const battle = createAdvancedBattle({
      units: [
        unit('hero', 'PLAYER', ['strike']),
        unit('summon', 'ENEMY', ['strike']),
        unit('boss', 'ENEMY', ['strike'], { boss: { enrageTurn: 10 } }),
      ],
      skills: STANDARD_ADVANCED_SKILLS,
    });
    expect(selectAiCommand(battle, 'hero', 'BOSS_HUNTER', new SeededRng('focus'))?.targetIds).toEqual(['boss']);
    expect(selectAiCommand(battle, 'hero', 'BOSS_FOCUS', new SeededRng('focus-new'))?.targetIds).toEqual(['boss']);
  });

  it('resource-save preserves a ready ultimate while normal aggression spends it', () => {
    const battle = createAdvancedBattle({
      units: [unit('hero', 'PLAYER', ['strike', 'nova'], { initialUltimate: 100 }), unit('enemy', 'ENEMY', ['strike'])],
      skills: STANDARD_ADVANCED_SKILLS,
    });
    expect(selectAiCommand(battle, 'hero', 'RESOURCE_SAVE', new SeededRng('save'))?.skillId).toBe('strike');
    expect(selectAiCommand(battle, 'hero', 'AGGRESSIVE', new SeededRng('spend'))?.skillId).toBe('nova');
  });

  it('does not overwrite an active buff or debuff when uncovered stats are available', () => {
    const contextualSkills: Record<string, AdvancedSkillDefinition> = {
      attackAura: {
        id: 'attackAura',
        name: 'Attack Aura',
        target: 'SELF',
        effects: [{ kind: 'BUFF', stat: 'attack', value: 0.2, duration: 2 }],
        tags: ['DEFENSE'],
      },
      defenseAura: {
        id: 'defenseAura',
        name: 'Defense Aura',
        target: 'SELF',
        effects: [{ kind: 'BUFF', stat: 'defense', value: 0.2, duration: 2 }],
        tags: ['DEFENSE'],
      },
      attackBreak: {
        id: 'attackBreak',
        name: 'Attack Break',
        target: 'ENEMY',
        effects: [{ kind: 'DEBUFF', stat: 'attack', value: 0.2, duration: 2 }],
        tags: ['CONTROL'],
      },
      defenseBreak: {
        id: 'defenseBreak',
        name: 'Defense Break',
        target: 'ENEMY',
        effects: [{ kind: 'DEBUFF', stat: 'defense', value: 0.2, duration: 2 }],
        tags: ['CONTROL'],
      },
      strike: STANDARD_ADVANCED_SKILLS.strike!,
    };
    const battle = createAdvancedBattle({
      units: [unit('hero', 'PLAYER', ['attackAura', 'defenseAura']), unit('enemy', 'ENEMY', ['strike'])],
      skills: contextualSkills,
    });
    const hero = battle.units.find((candidate) => candidate.id === 'hero')!;
    hero.modifiers.push({ stat: 'attack', value: 0.2, turns: 2, sourceId: 'attackAura' });
    const buffDecision = explainAiDecision(battle, hero.id, 'BALANCED', new SeededRng('buff-context'));
    expect(buffDecision.command?.skillId).toBe('defenseAura');
    expect(buffDecision.reasons).toContain('buff-coverage');

    hero.skillIds = ['attackBreak', 'defenseBreak'];
    const enemy = battle.units.find((candidate) => candidate.id === 'enemy')!;
    enemy.modifiers.push({ stat: 'attack', value: -0.2, turns: 2, sourceId: hero.id });
    const debuffDecision = explainAiDecision(battle, hero.id, 'BALANCED', new SeededRng('debuff-context'));
    expect(debuffDecision.command?.skillId).toBe('defenseBreak');
    expect(debuffDecision.reasons).toContain('debuff-coverage');
  });

  it('alternates control and damage-over-time according to active coverage', () => {
    const contextualSkills: Record<string, AdvancedSkillDefinition> = {
      lock: {
        id: 'lock',
        name: 'Lock',
        target: 'ENEMY',
        effects: [{ kind: 'CONTROL', control: 'STUN', duration: 1 }],
        tags: ['CONTROL'],
      },
      scorch: {
        id: 'scorch',
        name: 'Scorch',
        target: 'ENEMY',
        effects: [{ kind: 'DOT', power: 0.04, duration: 3 }],
        tags: ['CONTROL'],
      },
      strike: STANDARD_ADVANCED_SKILLS.strike!,
    };
    const battle = createAdvancedBattle({
      units: [unit('hero', 'PLAYER', ['lock', 'scorch']), unit('enemy', 'ENEMY', ['strike'])],
      skills: contextualSkills,
    });
    const enemy = battle.units.find((candidate) => candidate.id === 'enemy')!;
    enemy.controls.push({ kind: 'STUN', turns: 1, sourceId: 'hero' });
    const dotDecision = explainAiDecision(battle, 'hero', 'BALANCED', new SeededRng('fresh-dot'));
    expect(dotDecision.command?.skillId).toBe('scorch');
    expect(dotDecision.reasons).toContain('dot-window');

    enemy.controls = [];
    enemy.dots.push({ id: 'existing-dot', power: 0.04, turns: 2, sourceId: 'hero' });
    const controlDecision = explainAiDecision(battle, 'hero', 'BALANCED', new SeededRng('fresh-control'));
    expect(controlDecision.command?.skillId).toBe('lock');
    expect(controlDecision.reasons).toContain('control-window');
  });

  it('exploits boss weak points and avoids elementally resisted targets', () => {
    const elementalSkills: Record<string, AdvancedSkillDefinition> = {
      fireHit: { id: 'fireHit', name: 'Fire Hit', target: 'ENEMY', element: 'FIRE', effects: [{ kind: 'DAMAGE', power: 1 }], tags: ['ATTACK'] },
      waterHit: { id: 'waterHit', name: 'Water Hit', target: 'ENEMY', element: 'WATER', effects: [{ kind: 'DAMAGE', power: 1 }], tags: ['ATTACK'] },
      strike: STANDARD_ADVANCED_SKILLS.strike!,
    };
    const bossBattle = createAdvancedBattle({
      units: [
        unit('hero', 'PLAYER', ['fireHit', 'waterHit']),
        unit('boss', 'ENEMY', ['strike'], { element: 'WATER', boss: { weakPoint: 'WATER', weakPointMultiplier: 1.6 } }),
      ],
      skills: elementalSkills,
    });
    const weakPointDecision = explainAiDecision(bossBattle, 'hero', 'BALANCED', new SeededRng('weak-point'));
    expect(weakPointDecision.command?.skillId).toBe('waterHit');
    expect(weakPointDecision.reasons).toContain('element-weak-point');

    const targetBattle = createAdvancedBattle({
      units: [
        unit('hero', 'PLAYER', ['fireHit']),
        unit('water-target', 'ENEMY', ['strike'], { element: 'WATER' }),
        unit('earth-target', 'ENEMY', ['strike'], { element: 'EARTH' }),
      ],
      skills: elementalSkills,
    });
    expect(selectAiCommand(targetBattle, 'hero', 'BALANCED', new SeededRng('element-target'))?.targetIds).toEqual(['earth-target']);

    const resistanceBattle = createAdvancedBattle({
      units: [
        unit('hero', 'PLAYER', ['fireHit']),
        unit('resistant-earth', 'ENEMY', ['strike'], { element: 'EARTH', stats: stats({ resistance: 900 }) }),
        unit('open-earth', 'ENEMY', ['strike'], { element: 'EARTH', stats: stats({ resistance: 30 }) }),
      ],
      skills: elementalSkills,
    });
    expect(selectAiCommand(resistanceBattle, 'hero', 'BALANCED', new SeededRng('resistance-target'))?.targetIds).toEqual(['open-earth']);
  });

  it('recognizes an activated boss phase and overrides resource saving after enrage', () => {
    const contextualSkills: Record<string, AdvancedSkillDefinition> = {
      strike: STANDARD_ADVANCED_SKILLS.strike!,
      finisher: {
        id: 'finisher',
        name: 'Finisher',
        target: 'ENEMY',
        element: 'DARK',
        effects: [{ kind: 'DAMAGE', power: 3 }],
        ultimateCost: 100,
        tags: ['ATTACK', 'ULTIMATE'],
      },
    };
    const battle = createAdvancedBattle({
      units: [
        unit('hero', 'PLAYER', ['strike', 'finisher'], { initialUltimate: 100 }),
        unit('boss', 'ENEMY', ['strike'], { boss: { phases: [{ id: 'phase-two', hpRatio: 0.5 }], enrageTurn: 8 } }),
      ],
      skills: contextualSkills,
    });
    expect(selectAiCommand(battle, 'hero', 'RESOURCE_SAVE', new SeededRng('calm-save'))?.skillId).toBe('strike');

    const boss = battle.units.find((candidate) => candidate.id === 'boss')!;
    boss.bossState!.triggeredPhaseIds.push('phase-two');
    boss.bossState!.enraged = true;
    const escalated = explainAiDecision(battle, 'hero', 'RESOURCE_SAVE', new SeededRng('enraged-spend'));
    expect(escalated.command?.skillId).toBe('finisher');
    expect(escalated.reasons).toEqual(expect.arrayContaining(['ready-ultimate', 'boss-phase-active', 'boss-enraged']));
  });

  it('breaks equal-score ties by stable skill id instead of a random button press', () => {
    const tiedSkills: Record<string, AdvancedSkillDefinition> = {
      alpha: { id: 'alpha', name: 'Alpha', target: 'ENEMY', effects: [{ kind: 'DAMAGE', power: 1 }], tags: ['ATTACK'] },
      beta: { id: 'beta', name: 'Beta', target: 'ENEMY', effects: [{ kind: 'DAMAGE', power: 1 }], tags: ['ATTACK'] },
      strike: STANDARD_ADVANCED_SKILLS.strike!,
    };
    const battle = createAdvancedBattle({
      units: [unit('hero', 'PLAYER', ['beta', 'alpha']), unit('enemy', 'ENEMY', ['strike'])],
      skills: tiedSkills,
    });
    expect(selectAiCommand(battle, 'hero', 'BALANCED', new SeededRng('seed-a'))?.skillId).toBe('alpha');
    expect(selectAiCommand(battle, 'hero', 'BALANCED', new SeededRng('seed-b'))?.skillId).toBe('alpha');
  });

  it('exposes five strategies and every strategy returns a valid command', () => {
    expect(AI_STRATEGIES).toHaveLength(5);
    expect(AI_STRATEGIES).toEqual(expect.arrayContaining(['BOSS_FOCUS', 'RESOURCE_SAVE']));
    const battle = createAdvancedBattle({
      units: [unit('hero', 'PLAYER', ['strike', 'sweep', 'mend', 'bulwark', 'fracture', 'stun']), unit('enemy', 'ENEMY', ['strike'])],
      skills: STANDARD_ADVANCED_SKILLS,
    });
    for (const strategy of AI_STRATEGIES) {
      const command = selectAiCommand(battle, 'hero', strategy, new SeededRng(strategy));
      expect(command).not.toBeNull();
      expect(battle.units[0]!.skillIds).toContain(command?.skillId);
    }
  });
});
